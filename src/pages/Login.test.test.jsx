import { act, fireEvent, render, screen } from '@testing-library/react';
import Login from './Login';
import { authService } from '../services/auth';
import { mensajeDeError } from '../services/api';

jest.mock('../services/auth', () => ({ authService: { login: jest.fn() } }));
jest.mock('../services/api', () => ({ mensajeDeError: jest.fn() }));

const session = { token: 'test-token', user: { email: 'persona@example.com' } };

function fillCredentials(email = 'persona@example.com', password = 'clave') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
}

function submit() {
  fireEvent.submit(screen.getByRole('button', { name: 'Iniciar sesión' }).closest('form'));
}

beforeEach(() => {
  jest.resetAllMocks();
  authService.login.mockResolvedValue(session);
});

test('T-110: muestra los controles de acceso sin registro abierto', () => {
  render(<Login onLogin={jest.fn()} />);
  expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email');
  expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  expect(screen.getByText(/Las cuentas las crea tu equipo/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /registr/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /registr/i })).not.toBeInTheDocument();
});

test.each([
  ['', ''],
  ['', 'clave'],
  ['   ', 'clave'],
  ['persona@example.com', ''],
])('T-111: rechaza credenciales incompletas (%j, %j)', (email, password) => {
  const onLogin = jest.fn();
  render(<Login onLogin={onLogin} />);
  fillCredentials(email, password);
  submit();
  expect(screen.getByRole('status')).toHaveTextContent('Completá tu correo y tu contraseña.');
  expect(authService.login).not.toHaveBeenCalled();
  expect(onLogin).not.toHaveBeenCalled();
});

test('T-112: recorta el correo y conserva exactamente la contraseña', async () => {
  render(<Login onLogin={jest.fn()} />);
  fillCredentials('  persona@example.com  ', '  clave con espacios  ');
  submit();
  expect(await screen.findByText('Acceso correcto.')).toBeInTheDocument();
  expect(authService.login).toHaveBeenCalledTimes(1);
  expect(authService.login).toHaveBeenCalledWith({
    email: 'persona@example.com', password: '  clave con espacios  ',
  });
});

test('T-113: entrega una sola vez la sesión devuelta', async () => {
  const onLogin = jest.fn();
  render(<Login onLogin={onLogin} />);
  fillCredentials();
  submit();
  expect(await screen.findByText('Acceso correcto.')).toBeInTheDocument();
  expect(onLogin).toHaveBeenCalledTimes(1);
  expect(onLogin).toHaveBeenCalledWith(session);
});

test('T-114: muestra el mensaje convertido del error de backend', async () => {
  const error = new Error('Credenciales rechazadas');
  authService.login.mockRejectedValueOnce(error);
  mensajeDeError.mockReturnValue('Correo o contraseña incorrectos.');
  const onLogin = jest.fn();
  render(<Login onLogin={onLogin} />);
  fillCredentials();
  submit();
  expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
  expect(mensajeDeError).toHaveBeenCalledWith(error, 'No se pudo iniciar sesión.');
  expect(onLogin).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
});

test('T-115: mantiene el botón deshabilitado hasta resolver la petición', async () => {
  let resolveLogin;
  authService.login.mockReturnValueOnce(new Promise((resolve) => { resolveLogin = resolve; }));
  const onLogin = jest.fn();
  render(<Login onLogin={onLogin} />);
  fillCredentials();
  submit();
  expect(screen.getByRole('status')).toHaveTextContent('Ingresando...');
  expect(screen.getByRole('button', { name: 'Ingresando...' })).toBeDisabled();
  expect(onLogin).not.toHaveBeenCalled();
  await act(async () => { resolveLogin(session); });
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent('Acceso correcto.');
});

test('T-116: muestra el aviso de expiración y lo reemplaza al enviar', () => {
  render(<Login onLogin={jest.fn()} aviso="Tu sesión expiró." />);
  expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró.');
  expect(authService.login).not.toHaveBeenCalled();
  submit();
  expect(screen.queryByText('Tu sesión expiró.')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Completá tu correo y tu contraseña.');
});

test('T-117: reemplaza el error al reintentar y permite ingresar', async () => {
  authService.login.mockRejectedValueOnce(new Error('rechazado'));
  mensajeDeError.mockReturnValue('Credenciales incorrectas.');
  const onLogin = jest.fn();
  render(<Login onLogin={onLogin} />);
  fillCredentials();
  submit();
  expect(await screen.findByText('Credenciales incorrectas.')).toBeInTheDocument();
  expect(onLogin).not.toHaveBeenCalled();
  fillCredentials('persona@example.com', 'clave corregida');
  submit();
  expect(screen.queryByText('Credenciales incorrectas.')).not.toBeInTheDocument();
  expect(await screen.findByText('Acceso correcto.')).toBeInTheDocument();
  expect(authService.login).toHaveBeenCalledTimes(2);
  expect(authService.login).toHaveBeenLastCalledWith({ email: 'persona@example.com', password: 'clave corregida' });
  expect(onLogin).toHaveBeenCalledTimes(1);
  expect(onLogin).toHaveBeenCalledWith(session);
});
