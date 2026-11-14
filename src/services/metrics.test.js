import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

// Jest intercepta createRequire; usar el cargador nativo para Babel 8 (ESM).
const { _load } = require('node:module');
const { transformSync } = _load(require.resolve('@babel/core'), null, false);

// Adaptar import.meta solo al cargar este módulo en Jest (CommonJS).
const source = readFileSync(`${__dirname}/metrics.js`, 'utf8');
const { code } = transformSync(source, {
  filename: `${__dirname}/metrics.js`,
  presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  plugins: [
    // El código evaluado también debe aportar su cobertura real a Jest.
    ['babel-plugin-istanbul', {
      nycConfig: {},
      coverageGlobalScope: 'globalThis',
      coverageGlobalScopeFunc: false,
    }],
    ({ types: t }) => ({
      visitor: {
        MetaProperty(path) {
          if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
            path.replaceWith(t.identifier('testImportMeta'));
          }
        },
      },
    }),
  ],
});

// Solo se evalúa CommonJS ya transformado, con require y mocks de Jest.
const ejecutarMetrics = new Script(`(function(require, module, exports, testImportMeta, globalThis) {
${code}
})`, {
  filename: `${__dirname}/metrics.js`,
}).runInThisContext();

function loadMetrics(apiUrl) {
  jest.resetModules();
  const api = require('./api').default;
  const module = { exports: {} };
  ejecutarMetrics(require, module, module.exports, { env: { VITE_API_URL: apiUrl } }, globalThis);
  return { api, metrics: module.exports };
}

describe('services/metrics', () => {
  let api;
  let metrics;
  const data = { total: 12, status: 'ready' };

  beforeEach(() => {
    ({ api, metrics } = loadMetrics());
    api.get.mockResolvedValue({ data });
  });

  test.each([undefined, {}])('T-186: tablero del módulo usa 24 horas con %p', async (options) => {
    await expect(metrics.tableroDelModulo(options)).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/dashboard', { params: { windowHours: 24 } });
  });

  test.each([0, 6, 48])('T-187: tablero global conserva windowHours=%s', async (windowHours) => {
    await expect(metrics.tableroGlobal({ windowHours })).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledWith('/dashboard/global', { params: { windowHours } });
  });

  test('tablero global usa 24 horas por defecto', async () => {
    await expect(metrics.tableroGlobal()).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledWith('/dashboard/global', { params: { windowHours: 24 } });
  });

  test.each([
    ['inventario', { windowHours: 12 }, 12],
    ['ventas', undefined, 24],
    ['compras', {}, 24],
  ])('T-188: consulta el tablero de %s', async (modulo, options, windowHours) => {
    await expect(metrics.tableroDe(modulo, options)).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledWith(`/dashboard/modules/${modulo}`, { params: { windowHours } });
  });

  test('T-189: devuelve las alertas de integración', async () => {
    const alerts = [{ module: 'ventas', message: 'Sin consumidor' }];
    api.get.mockResolvedValue({ data: alerts });
    await expect(metrics.alertasDeIntegracion()).resolves.toBe(alerts);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/dashboard/integration-alerts');
  });

  test.each([
    [undefined, 'http://localhost:8000'],
    ['', 'http://localhost:8000'],
    ['https://core.example/api/v1', 'https://core.example'],
    ['https://core.example/api/v1/', 'https://core.example'],
  ])('T-190/T-191: readiness fuera de /api/v1 para %p', async (apiUrl, base) => {
    const loaded = loadMetrics(apiUrl);
    loaded.api.get.mockResolvedValue({ data });
    await expect(loaded.metrics.estadoDelCore()).resolves.toBe(data);
    expect(loaded.api.get).toHaveBeenCalledTimes(1);
    expect(loaded.api.get).toHaveBeenCalledWith(`${base}/health/ready`, { baseURL: '' });
  });

  test.each([
    ['tableroDelModulo', []],
    ['tableroGlobal', [{ windowHours: 6 }]],
    ['tableroDe', ['ventas', { windowHours: 12 }]],
    ['alertasDeIntegracion', []],
    ['estadoDelCore', []],
  ])('T-192: %s propaga el error de la consulta', async (method, args) => {
    const error = new Error('Servicio no disponible');
    api.get.mockRejectedValue(error);
    await expect(metrics[method](...args)).rejects.toBe(error);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
