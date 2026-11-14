import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EventosSuscriptos from './EventosSuscriptos';
import { catalogoPorModulo } from '../services/catalog';
import { listarSuscripciones, sincronizar } from '../services/subscriptions';
import { modulosVisibles } from '../services/subscriptionPreferences';

jest.mock('react-router', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../services/catalog', () => ({ catalogoPorModulo: jest.fn() }));
jest.mock('../services/subscriptions', () => ({ listarSuscripciones: jest.fn(), sincronizar: jest.fn() }));
jest.mock('../services/subscriptionPreferences', () => ({ modulosVisibles: jest.fn() }));
jest.mock('../services/session', () => ({ session: { getModulo: () => 'observador' } }));
jest.mock('../services/api', () => ({ mensajeDeError: (error, fallback) => error.message || fallback }));

const catalogo = [
  { id: 'tickets', name: 'tickets', displayName: 'Tickets', events: [
    { id: 1, name: 'ticketCreated', description: 'Nuevo ticket' },
    { id: 2, name: 'ticketClosed', discovered: true },
  ] },
  { id: 'users', name: 'users', events: [{ name: 'userCreated' }] },
];
const subs = [{ active: true, eventType: 'ticketCreated' }, { active: false, eventType: 'userCreated' }];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const checkbox = (name) => screen.getByRole('checkbox', { name });
const aplicar = () => screen.getByRole('button', { name: 'Aplicar' });
async function cargar() {
  render(<EventosSuscriptos />);
  await screen.findByRole('checkbox', { name: 'ticketCreated' });
}
beforeEach(() => {
  jest.resetAllMocks();
  catalogoPorModulo.mockResolvedValue(catalogo);
  listarSuscripciones.mockResolvedValue(subs);
  modulosVisibles.mockReturnValue([]);
  sincronizar.mockResolvedValue({ agregadas: 1, quitadas: 0 });
});

test('T-071: muestra esqueleto durante carga y conserva encabezado al fallar', async () => {
  const carga = deferred();
  catalogoPorModulo.mockReturnValue(carga.promise);
  const { container } = render(<EventosSuscriptos />);
  expect(screen.getByRole('heading', { name: 'Eventos Suscriptos' })).toBeInTheDocument();
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  await act(async () => carga.reject(new Error('Core apagado')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Core apagado');
  expect(screen.getByRole('heading', { name: 'Eventos Suscriptos' })).toBeInTheDocument();
  expect(screen.queryByText('No hay módulos para mostrar')).not.toBeInTheDocument();
});

test.each(['catálogo', 'suscripciones'])('T-072: reintenta ambas consultas al fallar %s', async (origen) => {
  (origen === 'catálogo' ? catalogoPorModulo : listarSuscripciones).mockRejectedValueOnce(new Error('Sin conexión'));
  render(<EventosSuscriptos />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  await screen.findByRole('checkbox', { name: 'ticketCreated' });
  expect(catalogoPorModulo).toHaveBeenCalledTimes(2);
  expect(listarSuscripciones).toHaveBeenCalledTimes(2);
});

test('T-073: catálogo vacío ofrece ir a suscripciones', async () => {
  catalogoPorModulo.mockResolvedValue([]);
  render(<EventosSuscriptos />);
  expect(await screen.findByRole('heading', { name: 'No hay módulos para mostrar' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ir a Suscripciones' })).toHaveAttribute('href', '/suscripciones');
});

test('T-074: preferencias ocultan únicamente módulos no elegidos', async () => {
  modulosVisibles.mockReturnValue(['tickets']);
  await cargar();
  expect(checkbox(/ticketClosed/)).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'userCreated' })).not.toBeInTheDocument();
  expect(screen.getByText('1 de 2 tipos')).toBeInTheDocument();
});

test('T-075, T-079, T-084, T-085: agrupa catálogo, refleja Core y explica estado sin cambios y cola', async () => {
  await cargar();
  const tickets = screen.getByRole('heading', { name: /Tickets/ }).closest('section');
  expect(within(tickets).getAllByRole('checkbox')).toHaveLength(2);
  expect(screen.getByRole('heading', { name: /users/ })).toBeInTheDocument();
  expect(checkbox('ticketCreated')).toBeChecked();
  expect(checkbox('userCreated')).not.toBeChecked();
  expect(screen.getByText('1 de 3 tipos')).toBeInTheDocument();
  expect(aplicar()).toBeDisabled();
  expect(screen.getByText('Sin cambios: lo tildado es lo que el Core ya tiene.')).toBeInTheDocument();
  expect(screen.getByTitle('Apareció por el hub sin que nadie lo declarara')).toHaveTextContent('sin declarar');
  expect(screen.getByText('q.observador')).toBeInTheDocument();
});

test('T-076, T-077: filtra sin distinguir mayúsculas ni espacios y restaura catálogo', async () => {
  await cargar();
  const filtro = screen.getByRole('searchbox');
  fireEvent.change(filtro, { target: { value: '  TICKET  ' } });
  expect(screen.getByRole('status')).toHaveTextContent('2 de 3 coinciden');
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.change(filtro, { target: { value: 'inexistente' } });
  expect(screen.getByRole('status')).toHaveTextContent('0 de 3 coinciden');
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Ver todo el catálogo' }));
  expect(filtro).toHaveValue('');
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
});

test('T-078: anticipa altas y bajas y permite revertir selección', async () => {
  await cargar();
  fireEvent.click(checkbox('userCreated'));
  fireEvent.click(checkbox('ticketCreated'));
  expect(screen.getByText('+1 para suscribir')).toBeInTheDocument();
  expect(screen.getByText('−1 para dar de baja')).toBeInTheDocument();
  expect(aplicar()).toBeEnabled();
  fireEvent.click(checkbox('userCreated'));
  fireEvent.click(checkbox('ticketCreated'));
  expect(aplicar()).toBeDisabled();
});

test('T-080, T-083: sincroniza selección, muestra progreso y recarga estado real', async () => {
  const guardado = deferred();
  sincronizar.mockReturnValue(guardado.promise);
  await cargar();
  fireEvent.click(checkbox('userCreated'));
  fireEvent.click(aplicar());
  expect(sincronizar).toHaveBeenCalledWith(['ticketCreated', 'userCreated']);
  expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
  expect(catalogoPorModulo).toHaveBeenCalledTimes(1);
  catalogoPorModulo.mockResolvedValue([catalogo[0]]);
  listarSuscripciones.mockResolvedValue([{ active: true, eventType: 'ticketClosed' }]);
  await act(async () => guardado.resolve({ agregadas: 1, quitadas: 0 }));
  await waitFor(() => expect(checkbox(/ticketClosed/)).toBeChecked());
  expect(checkbox('ticketCreated')).not.toBeChecked();
  expect(screen.queryByRole('checkbox', { name: 'userCreated' })).not.toBeInTheDocument();
  expect(catalogoPorModulo).toHaveBeenCalledTimes(2);
  expect(listarSuscripciones).toHaveBeenCalledTimes(2);
  expect(aplicar()).toBeDisabled();
});

test.each([
  [1, 0, 'Listo: 1 suscripción nueva.'],
  [2, 0, 'Listo: 2 suscripciones nuevas.'],
  [0, 1, 'Listo: 1 dada de baja.'],
  [0, 2, 'Listo: 2 dadas de baja.'],
  [1, 2, 'Listo: 1 suscripción nueva y 2 dadas de baja.'],
  [0, 0, 'No había cambios para aplicar.'],
])('T-081: resultado con %i altas y %i bajas', async (agregadas, quitadas, mensaje) => {
  sincronizar.mockResolvedValue({ agregadas, quitadas });
  await cargar();
  fireEvent.click(checkbox('userCreated'));
  fireEvent.click(aplicar());
  expect(await screen.findByRole('status')).toHaveTextContent(mensaje);
});

test('T-082: fallo conserva selección y permite reintentar sin recargar', async () => {
  sincronizar.mockRejectedValueOnce(new Error('Guardado rechazado'));
  await cargar();
  fireEvent.click(checkbox('userCreated'));
  fireEvent.click(aplicar());
  expect(await screen.findByRole('alert')).toHaveTextContent('Guardado rechazado');
  expect(checkbox('userCreated')).toBeChecked();
  expect(checkbox('ticketCreated')).toBeChecked();
  expect(aplicar()).toBeEnabled();
  expect(catalogoPorModulo).toHaveBeenCalledTimes(1);
  fireEvent.click(aplicar());
  expect(await screen.findByRole('status')).toHaveTextContent('Listo: 1 suscripción nueva.');
  expect(sincronizar).toHaveBeenNthCalledWith(2, ['ticketCreated', 'userCreated']);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
