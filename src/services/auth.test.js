import api from './api';
import { session } from './session';
import { authService } from './auth';

jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

jest.mock('./session', () => ({
  session: { start: jest.fn(), clear: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
});

describe('authService', () => {
  test('T-157: login envía credenciales e inicia la sesión con la respuesta', async () => {
    const credentials = { email: 'persona@example.test', password: 'clave-test' };
    const data = { token: 'token-test', user: { email: credentials.email } };
    const startedSession = { email: credentials.email };
    api.post.mockResolvedValue({ data });
    session.start.mockReturnValue(startedSession);

    await expect(authService.login(credentials)).resolves.toBe(startedSession);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/auth/login', credentials);
    expect(session.start).toHaveBeenCalledTimes(1);
    expect(session.start).toHaveBeenCalledWith(data);
  });

  test('T-158: me devuelve los datos del usuario autenticado', async () => {
    const data = { email: 'persona@example.test' };
    api.get.mockResolvedValue({ data });

    await expect(authService.me()).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  test('T-159: cambiarPassword envía la contraseña al usuario indicado', async () => {
    const data = { updated: true };
    api.put.mockResolvedValue({ data });

    await expect(authService.cambiarPassword(42, 'nueva-clave')).resolves.toBe(data);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/users/42/password', { password: 'nueva-clave' });
  });

  test('T-160: listarCuentas devuelve los datos de /users', async () => {
    const data = [{ id: 42, email: 'persona@example.test' }];
    api.get.mockResolvedValue({ data });

    await expect(authService.listarCuentas()).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/users');
  });

  test.each([
    ['T-161', (items) => items],
    ['T-162', (items) => ({ items, total: 2 })],
  ])('%s: miCuenta encuentra el email autenticado en el listado', async (_id, wrap) => {
    const account = { id: 42, email: 'persona@example.test' };
    api.get.mockResolvedValueOnce({ data: { email: account.email } })
      .mockResolvedValueOnce({ data: wrap([{ id: 1, email: 'otra@example.test' }, account]) });

    await expect(authService.miCuenta()).resolves.toBe(account);
    expect(api.get.mock.calls).toEqual([['/auth/me'], ['/users']]);
  });

  test.each([{}, { email: '' }])('T-163: miCuenta omite el listado si falta email (%j)', async (user) => {
    api.get.mockResolvedValue({ data: user });

    await expect(authService.miCuenta()).resolves.toBeNull();
    expect(api.get.mock.calls).toEqual([['/auth/me']]);
  });

  test.each([
    [],
    [{ id: 1, email: 'otra@example.test' }],
    { items: [] },
    {},
  ])('T-163: miCuenta devuelve null sin una cuenta coincidente (%j)', async (accounts) => {
    api.get.mockResolvedValueOnce({ data: { email: 'persona@example.test' } })
      .mockResolvedValueOnce({ data: accounts });

    await expect(authService.miCuenta()).resolves.toBeNull();
    expect(api.get.mock.calls).toEqual([['/auth/me'], ['/users']]);
  });

  test.each([
    ['login', 'post', () => authService.login({ email: 'persona@example.test', password: 'clave' })],
    ['me', 'get', () => authService.me()],
    ['cambiarPassword', 'put', () => authService.cambiarPassword(42, 'clave')],
    ['listarCuentas', 'get', () => authService.listarCuentas()],
    ['miCuenta al consultar sesión', 'get', () => authService.miCuenta()],
  ])('T-164: %s propaga el error de red', async (_name, method, invoke) => {
    const error = new Error('Red no disponible');
    api[method].mockRejectedValue(error);

    await expect(invoke()).rejects.toBe(error);
    expect(session.start).not.toHaveBeenCalled();
  });

  test('T-164: miCuenta propaga el error al listar cuentas', async () => {
    const error = new Error('No se pudieron consultar las cuentas');
    api.get.mockResolvedValueOnce({ data: { email: 'persona@example.test' } })
      .mockRejectedValueOnce(error);

    await expect(authService.miCuenta()).rejects.toBe(error);
    expect(api.get.mock.calls).toEqual([['/auth/me'], ['/users']]);
  });

  test('T-165: logout limpia la sesión sin consultar el backend', () => {
    authService.logout();

    expect(session.clear).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });
});
