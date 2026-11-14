import path from 'node:path';
import { execFileSync } from 'node:child_process';
import axios from 'axios';

// Jest ejecuta CommonJS; sustituimos solo el entorno de Vite al cargar el
// archivo real. Axios conserva sus interceptores y usa un adaptador sin red.
function cargarApi(env = {}) {
  const filename = path.join(__dirname, 'api.js');
  const code = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { transformSync } from '@babel/core';
    import fs from 'node:fs';
    const { filename, env } = JSON.parse(fs.readFileSync(0, 'utf8'));
    const { code } = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    plugins: [({ types: t }) => ({
      visitor: {
        MemberExpression(nodePath) {
          const { object, property } = nodePath.node;
          if (t.isMetaProperty(object) && object.meta.name === 'import'
            && object.property.name === 'meta' && t.isIdentifier(property, { name: 'env' })) {
            nodePath.replaceWith(t.valueToNode(env));
          }
        },
      },
    })],
    });
    process.stdout.write(code);
  `], { input: JSON.stringify({ filename, env }), encoding: 'utf8', timeout: 10000 });
  const session = { getToken: jest.fn().mockReturnValue(null), clear: jest.fn() };
  const module = { exports: {} };
  const mockRequire = (name) => {
    if (name === 'axios') return axios;
    if (name === './session') return { session };
    throw new Error(`Import inesperado: ${name}`);
  };
  new Function('require', 'module', 'exports', code)(mockRequire, module, module.exports);
  return { api: module.exports.default, mensajeDeError: module.exports.mensajeDeError, session };
}

function respuesta(config, status = 200) {
  return { config, status, statusText: 'OK', headers: {}, data: { ok: true } };
}

describe('cliente API', () => {
  let api;
  let session;
  let adapter;

  beforeEach(() => {
    ({ api, session } = cargarApi());
    adapter = jest.fn(async (config) => respuesta(config));
    api.defaults.adapter = adapter;
  });

  test.each([
    [{}, 'http://localhost:8000/api/v1'],
    [{ VITE_API_URL: '' }, 'http://localhost:8000/api/v1'],
    [{ VITE_API_URL: 'https://core.example/api' }, 'https://core.example/api'],
  ])('T-148: configura URL y JSON para %j', async (env, baseURL) => {
    const { api: cliente } = cargarApi(env);
    cliente.defaults.adapter = adapter;
    await cliente.get('/eventos');
    const config = adapter.mock.calls[0][0];
    expect(config.baseURL).toBe(baseURL);
    expect(config.headers.get('Content-Type')).toBe('application/json');
  });

  test('T-149: envía el token Bearer de la sesión', async () => {
    session.getToken.mockReturnValue('token-de-prueba');
    await api.get('/eventos');
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  test('T-150: sin token omite Authorization', async () => {
    await api.get('/eventos');
    expect(adapter.mock.calls[0][0].headers.has('Authorization')).toBe(false);
  });

  test('T-151: devuelve la misma respuesta exitosa', async () => {
    let original;
    adapter.mockImplementation(async (config) => {
      original = respuesta(config);
      return original;
    });
    expect(await api.get('/eventos')).toBe(original);
  });

  test.each([
    [401, 'token-de-prueba', true],
    [401, null, false],
    [403, 'token-de-prueba', false],
    [500, 'token-de-prueba', false],
    [undefined, 'token-de-prueba', false],
  ])('T-152/T-153: error %s con token %s, expira=%s', async (status, token, expira) => {
    session.getToken.mockReturnValue(token);
    const error = new Error('Petición rechazada');
    if (status !== undefined) error.response = { status };
    adapter.mockRejectedValue(error);
    const listener = jest.fn();
    window.addEventListener('core:sesion-expirada', listener);
    try {
      await expect(api.get('/eventos')).rejects.toBe(error);
      expect(session.clear).toHaveBeenCalledTimes(expira ? 1 : 0);
      expect(listener).toHaveBeenCalledTimes(expira ? 1 : 0);
      if (expira) expect(listener.mock.calls[0][0]).toBeInstanceOf(Event);
    } finally {
      window.removeEventListener('core:sesion-expirada', listener);
    }
  });
});

describe('mensajeDeError', () => {
  const { mensajeDeError } = cargarApi();

  test('T-154: combina mensaje y campos, acepta campo y omite entradas sin nombre', () => {
    expect(mensajeDeError({ response: { data: {
      message: 'Datos inválidos',
      details: [{ field: 'email' }, { campo: 'nombre' }, {}, { field: '', campo: 'ignorado' }],
    } } })).toBe('Datos inválidos (email, nombre)');
  });

  test.each([undefined, [], {}, null])('T-155: detalles vacíos o inválidos %j', (details) => {
    expect(mensajeDeError({ response: { data: { message: 'Error del Core', details } } }))
      .toBe('Error del Core');
  });

  test('T-155: usa fallback predeterminado o personalizado sin mensaje', () => {
    expect(mensajeDeError({ response: { data: {} } })).toBe('No se pudo completar la operación.');
    expect(mensajeDeError({ response: { data: { message: '', details: [] } } }, 'Reintentar'))
      .toBe('Reintentar');
    expect(mensajeDeError({ response: { data: { details: [{ campo: 'email' }] } } }, 'Reintentar'))
      .toBe('Reintentar (email)');
  });

  test('T-156: explica error de conexión', () => {
    expect(mensajeDeError(new Error('Network Error'), 'Otro mensaje'))
      .toBe('No se pudo conectar con el Core. ¿Está levantado?');
  });

  test.each([undefined, null, new Error('Fallo'), { response: {} }])(
    'T-156: error sin datos usa fallback (%j)', (error) => {
      expect(mensajeDeError(error)).toBe('No se pudo completar la operación.');
      expect(mensajeDeError(error, 'Reintentar')).toBe('Reintentar');
    },
  );
});
