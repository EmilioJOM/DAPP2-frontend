import api from './api';
import {
  listarEventos,
  obtenerEvento,
  obtenerJourney,
  listarDeadLetters,
  reintentar,
  estadoDeEvento,
} from './events';

jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

beforeEach(() => jest.resetAllMocks());

test('T-174: listarEventos usa la paginación predeterminada y devuelve data', async () => {
  const data = { items: [], total: 0 };
  api.get.mockResolvedValue({ data });
  await expect(listarEventos()).resolves.toBe(data);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/events', {
    params: {
      page: 1, size: 25, eventType: undefined, sourceModule: undefined,
      status: undefined, query: undefined,
    },
  });
});

test('T-175 (parcial): transmite los filtros disponibles y paginación explícita', async () => {
  const params = {
    page: 3, size: 10, eventType: 'ORDER_CREATED', sourceModule: 'orders',
    status: 'ROUTED', query: 'order-123',
  };
  const data = { items: [{ eventId: 'event-123' }] };
  api.get.mockResolvedValue({ data });
  await expect(listarEventos(params)).resolves.toBe(data);
  expect(api.get).toHaveBeenCalledWith('/events', { params });
});

test.each([
  ['T-176', obtenerEvento, 'event-123', '/events/event-123'],
  ['T-177', obtenerJourney, 'correlation-456', '/events/journey/correlation-456'],
])('%s: consulta el identificador solicitado y devuelve data', async (_id, call, id, path) => {
  const data = { id, deliveries: [] };
  api.get.mockResolvedValue({ data });
  await expect(call(id)).resolves.toBe(data);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith(path);
});

test('T-178: listarDeadLetters usa OPEN y paginación predeterminada', async () => {
  const data = { items: [], total: 0 };
  api.get.mockResolvedValue({ data });
  await expect(listarDeadLetters()).resolves.toBe(data);
  expect(api.get).toHaveBeenCalledWith('/dlq', {
    params: { page: 1, size: 25, status: 'OPEN' },
  });
});

test('listarDeadLetters transmite paginación y estado explícitos', async () => {
  api.get.mockResolvedValue({ data: [] });
  await listarDeadLetters({ page: 2, size: 5, status: 'RESOLVED' });
  expect(api.get).toHaveBeenCalledWith('/dlq', {
    params: { page: 2, size: 5, status: 'RESOLVED' },
  });
});

test('T-181: reintentar hace POST al recurso solicitado y devuelve data', async () => {
  const data = { id: 'dlq-123', status: 'RETRIED' };
  api.post.mockResolvedValue({ data });
  await expect(reintentar('dlq-123')).resolves.toBe(data);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/dlq/dlq-123/retry');
});

test('T-184 (parcial): estadoDeEvento expone las etiquetas y tonos esperados', () => {
  expect(estadoDeEvento).toEqual({
    ROUTED: { texto: 'Entregado', tono: 'ok' },
    NO_SUBSCRIBERS: { texto: 'Sin suscriptores', tono: 'warn' },
    REJECTED: { texto: 'Rechazado', tono: 'error' },
    DUPLICATE: { texto: 'Duplicado', tono: 'muted' },
  });
});

describe.each([
  ['listarEventos', () => listarEventos(), 'get'],
  ['obtenerEvento', () => obtenerEvento('event-123'), 'get'],
  ['obtenerJourney', () => obtenerJourney('correlation-456'), 'get'],
  ['listarDeadLetters', () => listarDeadLetters(), 'get'],
  ['reintentar', () => reintentar('dlq-123'), 'post'],
])('T-185: %s propaga errores', (_name, call, method) => {
  test.each([404, 409, 500])('preserva el error HTTP %i', async (status) => {
    const error = Object.assign(new Error(`HTTP ${status}`), {
      response: { status, data: { message: 'Error del Core' } },
    });
    api[method].mockRejectedValue(error);
    await expect(call()).rejects.toBe(error);
    expect(api[method]).toHaveBeenCalledTimes(1);
  });
});
