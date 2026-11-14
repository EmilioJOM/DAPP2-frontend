import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserProfile from './UserProfile';
import { authService } from '../services/auth';
import { mensajeDeError } from '../services/api';

jest.mock('../services/auth', () => ({
  authService: { miCuenta: jest.fn(), cambiarPassword: jest.fn() },
}));
jest.mock('../services/api', () => ({ mensajeDeError: jest.fn() }));

const sesion = { actor: 'ana.sesion', displayName: 'Ventas', module: 'ventas', isAdmin: false };
const cuenta = { id: 42, fullName: 'Ana Pérez', email: 'ana@example.test' };

function montar(overrides = {}) {
  const callbacks = { onClose: jest.fn(), onLogout: jest.fn() };
  render(<UserProfile sesion={sesion} {...callbacks} {...overrides} />);
  return callbacks;
}

async function cuentaCargada() {
  await screen.findByRole('heading', { name: cuenta.fullName });
}

function completar(password = 'segura12', repetida = password) {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repetir'), { target: { value: repetida } });
}

function enviar() {
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

beforeEach(() => {
  jest.resetAllMocks();
  authService.miCuenta.mockResolvedValue(cuenta);
  authService.cambiarPassword.mockResolvedValue(undefined);
});

test('T-041: muestra sesión, módulo, cola y alcance normal sin datos de cuenta', async () => {
  authService.miCuenta.mockResolvedValue(null);
  montar();
  await act(async () => {});
  expect(screen.getByRole('dialog', { name: sesion.actor })).toBeInTheDocument();
  expect(screen.getByText(sesion.actor, { selector: 'p' })).toBeInTheDocument();
  expect(screen.getByText('Ventas')).toBeInTheDocument();
  expect(screen.getByText('ventas', { selector: 'code' })).toBeInTheDocument();
  expect(screen.getByText('q.ventas')).toBeInTheDocument();
  expect(screen.getByText('Ve solo el tráfico de su módulo')).toBeInTheDocument();
});

test('T-042: muestra alcance global para administrador', async () => {
  montar({ sesion: { ...sesion, isAdmin: true } });
  await cuentaCargada();
  expect(screen.getByText('Administrador: ve el tráfico de todos los módulos')).toBeInTheDocument();
});

test('T-043: reemplaza los datos de sesión al cargar la cuenta', async () => {
  let resolver;
  authService.miCuenta.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  montar();
  expect(screen.getByRole('heading', { name: sesion.actor })).toBeInTheDocument();
  expect(screen.getByText(sesion.actor, { selector: 'p' })).toBeInTheDocument();
  await act(async () => { resolver(cuenta); });
  expect(screen.getByRole('heading', { name: cuenta.fullName })).toBeInTheDocument();
  expect(screen.getByText(cuenta.email)).toBeInTheDocument();
  expect(screen.queryByText(sesion.actor)).not.toBeInTheDocument();
  expect(authService.miCuenta).toHaveBeenCalledTimes(1);
});

test.each(['falla', 'no encuentra'])('T-044: sigue renderizando si miCuenta %s', async modo => {
  if (modo === 'falla') authService.miCuenta.mockRejectedValue(new Error('Sin conexión'));
  else authService.miCuenta.mockResolvedValue(null);
  montar();
  await act(async () => {});
  expect(screen.getByRole('dialog', { name: sesion.actor })).toBeInTheDocument();
  expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled();
});

test('T-045: cierra con fondo y X, pero no dentro del diálogo', async () => {
  const { onClose } = montar();
  await cuentaCargada();
  const dialog = screen.getByRole('dialog');
  fireEvent.mouseDown(screen.getByRole('heading', { name: cuenta.fullName }));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.mouseDown(dialog.parentElement);
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar', exact: true }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test.each([
  ['T-046', 'corta12', 'corta12', 'La contraseña debe tener al menos 8 caracteres.'],
  ['T-047', 'segura12', 'distinta12', 'Las dos contraseñas no coinciden.'],
])('%s: rechaza contraseñas inválidas sin llamar al servicio', async (_id, password, repetida, mensaje) => {
  montar();
  await cuentaCargada();
  completar(password, repetida);
  enviar();
  expect(screen.getByRole('status')).toHaveTextContent(mensaje);
  expect(authService.cambiarPassword).not.toHaveBeenCalled();
});

test('T-048: no cambia contraseña sin cuenta identificada', async () => {
  authService.miCuenta.mockResolvedValue(null);
  montar();
  await act(async () => {});
  completar();
  enviar();
  expect(screen.getByRole('status')).toHaveTextContent('No se pudo identificar tu cuenta en el Core.');
  expect(authService.cambiarPassword).not.toHaveBeenCalled();
});

test('T-049: cambia con el id correcto, limpia campos y confirma el éxito', async () => {
  montar();
  await cuentaCargada();
  expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  completar();
  enviar();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Contraseña actualizada.'));
  expect(authService.cambiarPassword).toHaveBeenCalledTimes(1);
  expect(authService.cambiarPassword).toHaveBeenCalledWith(42, 'segura12');
  expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('');
  expect(screen.getByLabelText('Repetir')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
});

test('T-050: deshabilita envíos mientras el cambio está pendiente', async () => {
  let resolver;
  authService.cambiarPassword.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  montar();
  await cuentaCargada();
  completar();
  enviar();
  expect(screen.getByRole('status')).toHaveTextContent('Actualizando contraseña...');
  expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  enviar();
  expect(authService.cambiarPassword).toHaveBeenCalledTimes(1);
  await act(async () => { resolver(); });
  expect(screen.getByRole('status')).toHaveTextContent('Contraseña actualizada.');
});

test('T-051: muestra el error del Core y conserva ambas entradas', async () => {
  const error = { response: { data: { message: 'Contraseña rechazada por el Core' } } };
  authService.cambiarPassword.mockRejectedValue(error);
  mensajeDeError.mockReturnValue(error.response.data.message);
  montar();
  await cuentaCargada();
  completar();
  enviar();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(error.response.data.message));
  expect(mensajeDeError).toHaveBeenCalledWith(error, 'No se pudo cambiar la contraseña.');
  expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('segura12');
  expect(screen.getByLabelText('Repetir')).toHaveValue('segura12');
  expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeEnabled();
});

test('T-052: invoca onLogout al cerrar sesión', async () => {
  const { onLogout, onClose } = montar();
  await cuentaCargada();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(onLogout).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});
