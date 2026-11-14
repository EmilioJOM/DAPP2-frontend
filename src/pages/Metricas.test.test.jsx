import { act, fireEvent, render, screen, within } from '@testing-library/react';
import Metricas from './Metricas';
import { alertasDeIntegracion, estadoDelCore, tableroDe, tableroDelModulo, tableroGlobal } from '../services/metrics';
import { session } from '../services/session';

let mockQuery = '';
jest.mock('react-router', () => ({
  useSearchParams: () => [new URLSearchParams(mockQuery)],
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('../services/metrics', () => ({
  alertasDeIntegracion: jest.fn(), estadoDelCore: jest.fn(),
  tableroDe: jest.fn(), tableroDelModulo: jest.fn(), tableroGlobal: jest.fn(),
}));
jest.mock('../services/session', () => ({ session: { esAdmin: jest.fn(), getModulo: jest.fn() } }));
jest.mock('../services/api', () => ({ mensajeDeError: (error, fallback) => error.message || fallback }));
jest.mock('../components/AlertasDeIntegracion', () => ({
  __esModule: true,
  default: ({ alertas }) => <section aria-label="Alertas de integración">{alertas.map((a) => <p key={a.id}>{a.detail}</p>)}</section>,
}));

const stamp = '2026-11-14T12:00:00Z';
const moduleBoard = (extra = {}) => ({
  module: 'propio', windowHours: 24, generatedAt: stamp,
  published: { inWindow: 12, total: 80, topTypes: [{ eventType: 'PedidoCreado', total: 12 }] },
  received: { total: 9, delivered: 7, pendingRetry: 2 },
  deadLetters: { open: 3 }, processing: { avgMs: 15, maxMs: 60 },
  subscriptions: { eventTypes: ['PagoConfirmado'] }, publications: { declared: ['PedidoCreado'] },
  volumeByHour: [], ...extra,
});
const globalBoard = (extra = {}) => ({
  windowHours: 24, generatedAt: stamp,
  events: { total: 100, lastHour: 20, perMinuteLastHour: 0.33,
    processing: { avgMs: 10, maxMs: 50 }, topTypes: [{ eventType: 'Venta', total: 60 }],
    bySourceModule: [{ module: 'ventas', total: 60 }] },
  deliveries: { byStatus: { DELIVERED: 8, RETRYING: 2 } }, deadLetters: { open: 4 },
  modules: [], volumeByHour: [], integrationAlerts: [{ id: 'global', detail: 'Alerta incluida en tablero' }], ...extra,
});
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
async function loaded() { await screen.findByRole('group', { name: 'Ventana de tiempo' }); }
function kpi(title) { return screen.getByText(title, { selector: 'b' }).closest('article'); }

beforeEach(() => {
  jest.resetAllMocks();
  mockQuery = '';
  session.esAdmin.mockReturnValue(false);
  session.getModulo.mockReturnValue('propio');
  tableroDelModulo.mockImplementation(({ windowHours }) => Promise.resolve(moduleBoard({ windowHours })));
  tableroDe.mockImplementation((module, { windowHours }) => Promise.resolve(moduleBoard({ module, windowHours })));
  tableroGlobal.mockResolvedValue(globalBoard());
  alertasDeIntegracion.mockResolvedValue([{ id: 'local', detail: 'Alerta del módulo' }]);
  estadoDelCore.mockResolvedValue({ checks: { broker: { status: 'up' } } });
  jest.spyOn(Date, 'now').mockReturnValue(new Date(stamp).getTime());
});
afterEach(() => jest.restoreAllMocks());

test('T-118: muestra esqueletos de KPIs y tabla hasta recibir datos', async () => {
  const pending = deferred();
  tableroDelModulo.mockReturnValue(pending.promise);
  const { container } = render(<Metricas />);
  expect(screen.getByRole('heading', { name: 'Métricas: propio' })).toBeVisible();
  expect(container.querySelector('.kpi-grid')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelectorAll('.esqueleto-kpi')).toHaveLength(4);
  expect(screen.getByText('Cargando…').closest('section')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelectorAll('.esqueleto-fila')).toHaveLength(4);
  await act(async () => pending.resolve(moduleBoard()));
  await loaded();
  expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
});

test.each([
  ['T-119', false, 'module=ajeno', 'local'],
  ['T-120', true, '', 'global'],
  ['T-121', true, 'module=otro', 'otro'],
  ['T-122', true, 'module=propio', 'local'],
])('%s: selecciona el servicio según permisos y módulo', async (_, admin, query, target) => {
  session.esAdmin.mockReturnValue(admin);
  mockQuery = query;
  render(<Metricas />);
  await loaded();
  expect(tableroGlobal).toHaveBeenCalledTimes(target === 'global' ? 1 : 0);
  expect(tableroDelModulo).toHaveBeenCalledTimes(target === 'local' ? 1 : 0);
  expect(tableroDe).toHaveBeenCalledTimes(target === 'otro' ? 1 : 0);
  if (target === 'otro') expect(tableroDe).toHaveBeenCalledWith('otro', { windowHours: 24 });
  else expect(target === 'global' ? tableroGlobal : tableroDelModulo).toHaveBeenCalledWith({ windowHours: 24 });
  expect(alertasDeIntegracion).toHaveBeenCalledTimes(target === 'global' ? 0 : 1);
  expect(screen.getByText(target === 'global' ? 'Alerta incluida en tablero' : 'Alerta del módulo')).toBeVisible();
});

test('T-123: cambia las tres ventanas y su selección accesible', async () => {
  render(<Metricas />);
  await loaded();
  for (const [label, hours] of [['1 h', 1], ['7 días', 168], ['24 h', 24]]) {
    fireEvent.click(screen.getByRole('button', { name: label }));
    await loaded();
    expect(tableroDelModulo).toHaveBeenLastCalledWith({ windowHours: hours });
    for (const other of ['1 h', '24 h', '7 días']) {
      expect(screen.getByRole('button', { name: other })).toHaveAttribute('aria-pressed', String(other === label));
    }
    expect(screen.getByText(new RegExp(`Ventana de ${hours} h`))).toBeVisible();
  }
});

test('T-124: conserva encabezado ante error y reintenta la consulta', async () => {
  tableroDelModulo.mockRejectedValueOnce(new Error('Servicio temporalmente caído'));
  render(<Metricas />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente caído');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Métricas: propio');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await loaded();
  expect(tableroDelModulo).toHaveBeenCalledTimes(2);
  expect(tableroDelModulo).toHaveBeenLastCalledWith({ windowHours: 24 });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(kpi('Publicados')).toHaveTextContent('12');
});

test('T-125: fallo de salud no impide mostrar métricas', async () => {
  estadoDelCore.mockRejectedValue(new Error('health/ready no disponible'));
  render(<Metricas />);
  await loaded();
  expect(estadoDelCore).toHaveBeenCalledTimes(1);
  expect(kpi('Publicados')).toHaveTextContent('12');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/conectado|caído/)).not.toBeInTheDocument();
});

test.each([['up', 'conectado', 'ok'], ['down', 'caído', 'ko']])('T-126: broker %s', async (status, text, css) => {
  estadoDelCore.mockResolvedValue({ checks: { broker: { status } } });
  render(<Metricas />);
  expect(await screen.findByText(text)).toHaveClass(css);
});

test.each([
  { label: 'con actividad', published: 12, total: 80, received: 9, delivered: 7, retry: 2, dlq: 3, avg: 15, max: 60 },
  { label: 'sin actividad', published: 0, total: 0, received: 0, delivered: 0, retry: 0, dlq: 0, avg: 0, max: 0 },
])('T-127 parcial: KPIs de módulo $label y rankings disponibles', async (values) => {
  const board = moduleBoard();
  board.published = { ...board.published, inWindow: values.published, total: values.total };
  board.received = { total: values.received, delivered: values.delivered, pendingRetry: values.retry };
  board.deadLetters = { open: values.dlq };
  board.processing = { avgMs: values.avg, maxMs: values.max };
  tableroDelModulo.mockResolvedValue(board);
  render(<Metricas />);
  await loaded();
  for (const [title, value] of [
    ['Publicados', String(values.published)], ['Recibidos', String(values.received)],
    ['En dead letter', String(values.dlq)], ['Procesamiento', `${values.avg} ms`],
  ]) {
    expect(within(kpi(title)).getByText(value, { selector: 'strong', exact: true })).toBeVisible();
  }
  expect(kpi('Publicados')).toHaveTextContent(`${values.total} desde siempre`);
  expect(kpi('Recibidos')).toHaveTextContent(`${values.delivered} entregados · ${values.retry} reintentando`);
  expect(kpi('En dead letter').classList.contains('urgente')).toBe(values.dlq > 0);
  expect(kpi('En dead letter')).toHaveTextContent(values.dlq > 0 ? 'Abiertos, esperando reproceso' : 'Nada pendiente de reproceso');
  expect(kpi('Procesamiento')).toHaveTextContent(`máximo ${values.max} ms`);
  expect(screen.getByText('PagoConfirmado')).toBeVisible();
  expect(screen.getAllByText('PedidoCreado')).toHaveLength(2);
});

test('T-128, T-133, T-134: tablero global, estados conocidos y desconocidos, módulos incompletos', async () => {
  session.esAdmin.mockReturnValue(true);
  tableroGlobal.mockResolvedValue(globalBoard({
    deliveries: { byStatus: { DELIVERED: 8, PENDING: 1, RETRYING: 2, DEAD: 3, DISCARDED: 4, NUEVO: 2 } },
    modules: [
      { name: 'activo', displayName: 'Equipo activo', active: true, subscriptions: 0 },
      { name: 'viejo', displayName: 'Equipo inactivo', active: false, team: 'Equipo B', subscriptions: 3,
        lastLoginAt: stamp, lastPublishAt: stamp },
    ],
  }));
  render(<Metricas />);
  await loaded();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Métricas del Core');
  expect(kpi('Eventos en la ventana')).toHaveTextContent('100');
  expect(kpi('Eventos en la ventana')).toHaveTextContent('20 en la última hora');
  expect(kpi('Por minuto')).toHaveTextContent('0.33');
  expect(kpi('Dead letters abiertos')).toHaveTextContent('4');
  expect(kpi('Procesamiento')).toHaveTextContent('10 ms');
  expect(screen.getByText('Venta').closest('li')).toHaveTextContent('60');
  expect(screen.getByText('ventas').closest('li')).toHaveTextContent('60');
  for (const label of ['Entregadas', 'En camino', 'Reintentando', 'En dead letter', 'Descartadas', 'NUEVO']) {
    expect(screen.getByText(label, { selector: 'span' })).toBeVisible();
  }
  expect(screen.getByTitle('NUEVO').closest('li')).toHaveTextContent('2');
  expect(screen.getByTitle('NUEVO').closest('li').style.getPropertyValue('--proporcion')).toBe('10%');
  expect(screen.getByText('1 activo que nunca publicó')).toBeVisible();
  const activeRow = screen.getByRole('link', { name: 'Equipo activo' }).closest('tr');
  for (const label of ['sin equipo', 'ninguna', 'nunca', 'nunca publicó']) expect(within(activeRow).getByText(label)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Equipo activo' })).toHaveAttribute('href', '/metrics?module=activo');
  const inactiveRow = screen.getByRole('link', { name: 'Equipo inactivo' }).closest('tr');
  expect(within(inactiveRow).getByText('inactivo')).toBeVisible();
  expect(within(inactiveRow).getByText('Equipo B')).toBeVisible();
  expect(within(inactiveRow).getByText('3')).toBeVisible();
  expect(inactiveRow.querySelectorAll('time')).toHaveLength(2);
  for (const time of inactiveRow.querySelectorAll('time')) expect(time).toHaveAttribute('datetime', stamp);
});

test('T-129, T-130: volumen muestra pico, horas y rechazos proporcionales', async () => {
  const points = Array.from({ length: 15 }, (_, i) => ({ hour: new Date(Date.UTC(2026, 10, 14, i)).toISOString(), total: i === 0 ? 10 : 5, rejected: i === 0 ? 2 : 0 }));
  tableroDelModulo.mockResolvedValue(moduleBoard({ volumeByHour: points }));
  render(<Metricas />);
  const chart = await screen.findByRole('img', { name: 'Volumen por hora: 80 eventos, pico de 10' });
  expect(within(chart).getByText('10')).toHaveClass('volume-pico');
  const bars = chart.querySelectorAll('.volume-bar');
  expect(bars[0]).toHaveAttribute('title', expect.stringContaining('10 eventos · 2 rechazados'));
  expect(bars[0].querySelector('.volume-bar-fill')).toHaveStyle({ height: '100%' });
  expect(bars[1].querySelector('.volume-bar-fill')).toHaveStyle({ height: '50%' });
  expect(bars[0].querySelector('.volume-bar-rejected')).toHaveStyle({ height: '20%' });
  expect(bars[1].querySelector('.volume-bar-rejected')).toBeNull();
  expect(bars[0].querySelector('small')).toHaveTextContent(String(new Date(points[0].hour).getHours()).padStart(2, '0'));
  expect(bars[1].querySelector('small').textContent).toBe('\u00a0');
});

test('T-129, T-132: módulo vacío muestra mensajes de respaldo', async () => {
  tableroDelModulo.mockResolvedValue(moduleBoard({
    published: { inWindow: 0, total: 0, topTypes: [] }, subscriptions: { eventTypes: [] },
    publications: { declared: [] }, deadLetters: { open: 0 },
  }));
  render(<Metricas />);
  await loaded();
  for (const text of ['Sin eventos en la ventana elegida.', 'No publicó nada en esta ventana.',
    'Sin suscripciones: no va a recibir nada. Elegí tipos en Eventos Suscriptos.',
    'No declaró ninguno: los demás equipos no tienen cómo saber qué publica.', 'Nada pendiente de reproceso']) {
    expect(screen.getByText(text)).toBeVisible();
  }
  expect(kpi('En dead letter')).not.toHaveClass('urgente');
});

test('T-132: rankings y tabla global vacíos', async () => {
  session.esAdmin.mockReturnValue(true);
  const board = globalBoard();
  board.events.topTypes = [];
  board.events.bySourceModule = [];
  board.deliveries = {};
  board.deadLetters.open = 0;
  tableroGlobal.mockResolvedValue(board);
  render(<Metricas />);
  await loaded();
  expect(screen.getAllByText('Sin eventos.')).toHaveLength(2);
  expect(screen.getByText('Todavía no se entregó nada.')).toBeVisible();
  expect(screen.getByText(/0 módulos · todos los activos/)).toBeVisible();
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1);
  expect(kpi('Dead letters abiertos')).not.toHaveClass('urgente');
});

test('T-135: solo admin en vista módulo tiene enlace al hub', async () => {
  session.esAdmin.mockReturnValue(true);
  mockQuery = 'module=otro';
  render(<Metricas />);
  await loaded();
  expect(screen.getByRole('link', { name: 'Ver el hub completo' })).toHaveAttribute('href', '/metrics');
});

test('T-136: una respuesta de ventana anterior no reemplaza el módulo nuevo', async () => {
  session.esAdmin.mockReturnValue(true);
  mockQuery = 'module=primero';
  const oldWindow = deferred();
  tableroDe.mockImplementation((module, { windowHours }) => {
    if (module === 'primero' && windowHours === 1) return oldWindow.promise;
    return Promise.resolve(moduleBoard({ module, windowHours }));
  });
  const view = render(<Metricas />);
  await loaded();
  fireEvent.click(screen.getByRole('button', { name: '1 h' }));
  expect(screen.getByText('Cargando…')).toBeVisible();
  mockQuery = 'module=segundo';
  view.rerender(<Metricas />);
  await loaded();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Métricas: segundo');
  fireEvent.click(screen.getByRole('button', { name: '7 días' }));
  await loaded();
  expect(screen.getByText(/Ventana de 168 h/)).toBeVisible();
  await act(async () => oldWindow.resolve(moduleBoard({ module: 'primero', windowHours: 1 })));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Métricas: segundo');
  expect(screen.getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(/Ventana de 168 h/)).toBeVisible();
});

