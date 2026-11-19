import { act, fireEvent, render, screen, within } from '@testing-library/react';
import Suscripciones from './Suscripciones';
import { catalogoPorModulo } from '../services/catalog';
import { listarSuscripciones, suscribirse, cancelarSuscripcion } from '../services/subscriptions';
import { guardarModulosVisibles } from '../services/subscriptionPreferences';
import { session } from '../services/session';

jest.mock('react-router', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('../services/catalog', () => ({ catalogoPorModulo: jest.fn() }));
jest.mock('../services/subscriptions', () => ({
  listarSuscripciones: jest.fn(), suscribirse: jest.fn(), cancelarSuscripcion: jest.fn(),
  suscripcionesPropias: jest.fn((subs, modulo) => subs.filter((s) => s.moduleName === modulo)),
}));
jest.mock('../services/session', () => ({ session: { esAdmin: jest.fn(), getModulo: jest.fn() } }));
jest.mock('../services/api', () => ({ mensajeDeError: (error, fallback) => error.message || fallback }));
jest.mock('../services/subscriptionPreferences', () => ({
  ...jest.requireActual('../services/subscriptionPreferences'),
  guardarModulosVisibles: jest.fn(jest.requireActual('../services/subscriptionPreferences').guardarModulosVisibles),
}));

const clave = 'core-modulos-visibles-v2';
const catalogo = [
  { id: 'ventas', name: 'Ventas / AR', displayName: 'Ventas', events: [{ name: 'venta.creada' }, { name: 'venta.cancelada' }] },
  { id: 'stock', name: 'Stock', events: [{ name: 'stock.actualizado' }] },
];
const montar = () => render(<Suscripciones />);
const cargar = async () => {
  const vista = montar();
  await screen.findByRole('checkbox', { name: /Ventas/ });
  return vista;
};
const ventas = () => screen.getByRole('checkbox', { name: /Ventas/ });
const stock = () => screen.getByRole('checkbox', { name: /Stock/ });
const aplicar = () => screen.getByRole('button', { name: 'Aplicar' });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  catalogoPorModulo.mockResolvedValue(catalogo);
  listarSuscripciones.mockResolvedValue([
    { moduleName: 'observador', eventType: 'venta.creada', active: true },
    { moduleName: 'observador', eventType: 'venta.creada', active: true },
    { moduleName: 'observador', eventType: 'venta.cancelada', active: false },
    { moduleName: 'observador', eventType: 'desconocido', active: true },
  ]);
  session.esAdmin.mockReturnValue(false);
  session.getModulo.mockReturnValue('observador');
});

test('T-137: muestra carga hasta recibir catálogo y suscripciones', async () => {
  let resolverCatalogo;
  let resolverSubs;
  catalogoPorModulo.mockReturnValue(new Promise(resolve => { resolverCatalogo = resolve; }));
  listarSuscripciones.mockReturnValue(new Promise(resolve => { resolverSubs = resolve; }));
  const { container } = montar();
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await act(async () => resolverCatalogo(catalogo));
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  await act(async () => resolverSubs([]));
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
});

test.each(['catálogo', 'suscripciones'])('T-138: permite recuperar un error de %s', async origen => {
  const servicio = origen === 'catálogo' ? catalogoPorModulo : listarSuscripciones;
  servicio.mockRejectedValueOnce(new Error('Servicio no disponible'));
  montar();
  expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible');
  expect(screen.getByRole('heading', { name: 'No se pudo cargar la lista de módulos' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByRole('checkbox', { name: /Ventas/ });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(catalogoPorModulo).toHaveBeenCalledTimes(2);
  expect(listarSuscripciones).toHaveBeenCalledTimes(2);
});

test('T-139, T-143: sin preferencias mira todos sin marcar ninguno y no permite aplicar', async () => {
  await cargar();
  expect(screen.getByText('Mirando los 2 módulos')).toBeInTheDocument();
  screen.getAllByRole('checkbox').forEach(input => expect(input).not.toBeChecked());
  expect(aplicar()).toBeDisabled();
});

test('T-140, T-143: recupera preferencias persistidas y compara conjuntos sin importar el orden', async () => {
  localStorage.setItem(clave, JSON.stringify(['ventas', 'stock']));
  await cargar();
  expect(ventas()).toBeChecked();
  expect(stock()).toBeChecked();
  expect(screen.getByText('Mirando 2 de 2 módulos')).toBeInTheDocument();
  expect(aplicar()).toBeDisabled();
  fireEvent.click(ventas());
  expect(aplicar()).toBeEnabled();
  fireEvent.click(ventas());
  expect(aplicar()).toBeDisabled();
  expect(guardarModulosVisibles).not.toHaveBeenCalled();
});

test('T-141: tildar y destildar cambia solo el borrador y avisa de cambios', async () => {
  await cargar();
  fireEvent.click(ventas());
  expect(ventas()).toBeChecked();
  expect(screen.getByText('Mirando 1 de 2 módulos')).toBeInTheDocument();
  expect(screen.getByText('Tenés cambios sin aplicar.')).toBeInTheDocument();
  expect(localStorage.getItem(clave)).toBeNull();
  expect(guardarModulosVisibles).not.toHaveBeenCalled();
  fireEvent.click(ventas());
  expect(ventas()).not.toBeChecked();
  expect(screen.queryByText('Tenés cambios sin aplicar.')).not.toBeInTheDocument();
  expect(aplicar()).toBeDisabled();
});

test('T-142, T-144, T-147: aplica preferencias locales, muestra enlace y evita ids duplicados', async () => {
  const vista = await cargar();
  fireEvent.click(ventas());
  fireEvent.click(aplicar());
  expect(guardarModulosVisibles).toHaveBeenLastCalledWith(['ventas']);
  expect(JSON.parse(localStorage.getItem(clave))).toEqual(['ventas']);
  expect(aplicar()).toBeDisabled();
  expect(within(screen.getByRole('status')).getByRole('link', { name: 'Eventos Suscriptos' })).toHaveAttribute('href', '/eventos-suscriptos');
  fireEvent.click(ventas());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.click(aplicar());
  expect(JSON.parse(localStorage.getItem(clave))).toEqual([]);
  fireEvent.click(ventas());
  fireEvent.click(aplicar());
  expect(JSON.parse(localStorage.getItem(clave))).toEqual(['ventas']);
  expect(guardarModulosVisibles).toHaveBeenCalledTimes(3);
  expect(suscribirse).not.toHaveBeenCalled();
  expect(cancelarSuscripcion).not.toHaveBeenCalled();
  expect(listarSuscripciones).toHaveBeenCalledTimes(1);
  vista.unmount();
  await cargar();
  expect(ventas()).toBeChecked();
  expect(stock()).not.toBeChecked();
  expect(aplicar()).toBeDisabled();
});

test('T-145: cuenta tipos y suscripciones activas únicas por módulo', async () => {
  await cargar();
  expect(within(ventas().closest('article')).getByText('2 tipos de evento · estás suscripto a 1')).toBeInTheDocument();
  expect(within(stock().closest('article')).getByText('1 tipos de evento · no estás suscripto a ninguno')).toBeInTheDocument();
});

test.each([false, true])('T-146: enlaces de métricas según permiso admin=%s', async admin => {
  session.esAdmin.mockReturnValue(admin);
  await cargar();
  const links = screen.queryAllByRole('link', { name: 'Ver métricas →' });
  expect(links).toHaveLength(admin ? 2 : 0);
  if (admin) {
    expect(links[0]).toHaveAttribute('href', '/metrics?module=Ventas%20%2F%20AR');
    expect(links[1]).toHaveAttribute('href', '/metrics?module=Stock');
  }
});
