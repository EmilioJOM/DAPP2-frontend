import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';
import { session } from './services/session';

Object.assign(globalThis, { TextEncoder, TextDecoder });
// Jest intercepta createRequire; _load permite cargar ESM en Node 20.
// El router y React Testing Library deben compartir la misma instancia de React.
jest.mock('react', () => require('node:module')._load(require.resolve('react'), null, false));
jest.mock('react-router', () => require('node:module')._load(require.resolve('react-router'), null, false));
const { MemoryRouter } = require('react-router');
const App = require('./App').default;

jest.mock('./App.css', () => ({}));
jest.mock('./pages/Home', () => () => <h1>Pantalla historial</h1>);
jest.mock('./pages/EventosSuscriptos', () => () => <h1>Pantalla eventos</h1>);
jest.mock('./pages/Metricas', () => () => <h1>Pantalla métricas</h1>);
jest.mock('./pages/Suscripciones', () => () => <h1>Pantalla suscripciones</h1>);
jest.mock('./pages/Login', () => ({ aviso, onLogin }) => (
  <section aria-label="Login">
    {aviso && <p role="status">{aviso}</p>}
    <button onClick={() => onLogin({ actor: 'ana', displayName: 'Ana', isAdmin: false })}>Ingresar</button>
  </section>
));
jest.mock('./components/UserProfile', () => ({ sesion, onClose, onLogout }) => (
  <section role="dialog" aria-label="Perfil">
    <p>{sesion.displayName}</p>
    <button onClick={onClose}>Cerrar perfil</button>
    <button onClick={onLogout}>Cerrar sesión</button>
  </section>
));

const datos = { actor: 'ana', displayName: 'Ana Pérez', isAdmin: true };
const montar = (ruta = '/') => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>);
const abrirPerfil = () => fireEvent.click(screen.getByRole('button', { name: 'Ver datos del usuario' }));
const expirar = () => act(() => window.dispatchEvent(new Event('core:sesion-expirada')));

beforeEach(() => {
  session.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  session.clear();
});

test('T-001: sin sesión muestra Login y oculta navegación y pantallas protegidas', () => {
  montar('/metrics');
  expect(screen.getByRole('region', { name: 'Login' })).toBeInTheDocument();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('T-002: onLogin muestra la sesión recibida en la misma instancia de App', () => {
  montar();
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  expect(screen.queryByRole('region', { name: 'Login' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Pantalla historial' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver datos del usuario' })).toHaveTextContent('Ana');
  expect(screen.getByText('Módulo')).toBeInTheDocument();
});

test.each([true, false])('T-003: sesión activa muestra usuario, navegación y rol admin=%s', (isAdmin) => {
  session.start({ ...datos, isAdmin });
  montar();
  const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' });
  expect(within(sidebar).getByText('Core Observatory')).toBeInTheDocument();
  expect(within(sidebar).getByText(datos.displayName)).toBeInTheDocument();
  expect(within(sidebar).getByText(isAdmin ? 'Administrador' : 'Módulo')).toBeInTheDocument();
  expect(within(sidebar).getAllByRole('link').map(link => link.getAttribute('href')))
    .toEqual(['/', '/eventos-suscriptos', '/metrics', '/suscripciones']);
});

test('T-004 (parcial): la navegación monta las cuatro pantallas declaradas', () => {
  session.start(datos);
  montar();
  for (const [enlace, pantalla] of [
    ['Métricas', 'Pantalla métricas'],
    ['Eventos Suscriptos', 'Pantalla eventos'],
    ['Suscripciones', 'Pantalla suscripciones'],
    ['Historial de eventos', 'Pantalla historial'],
  ]) {
    fireEvent.click(screen.getByRole('link', { name: enlace }));
    expect(screen.getByRole('heading', { name: pantalla })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('link', { name: enlace })).toHaveAttribute('aria-current', 'page');
  }
});

test.each([[' ana ', 'A'], ['', '·'], ['   ', '·'], [undefined, '·']])(
  'T-005: actor %s produce inicial %s', (actor, inicial) => {
    session.start({ ...datos, actor });
    montar();
    const usuario = screen.getByRole('button', { name: 'Ver datos del usuario' });
    expect(within(usuario).getByText(inicial, { exact: true })).toBeInTheDocument();
  },
);

test('T-006: abre el perfil con la sesión actual y permite cerrarlo y reabrirlo', () => {
  session.start(datos);
  montar();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  abrirPerfil();
  expect(within(screen.getByRole('dialog')).getByText(datos.displayName)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar perfil' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  abrirPerfil();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('T-007: logout elimina la sesión almacenada, cierra perfil y muestra Login', () => {
  session.start(datos);
  montar();
  expect(sessionStorage.getItem('core-sesion-v1')).not.toBeNull();
  abrirPerfil();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(sessionStorage.getItem('core-sesion-v1')).toBeNull();
  expect(session.get()).toBeNull();
  expect(screen.getByRole('region', { name: 'Login' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('T-008: evento de expiración oculta sesión y perfil, y muestra aviso', () => {
  session.start(datos);
  montar();
  abrirPerfil();
  expirar();
  expect(screen.getByRole('region', { name: 'Login' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró. Volvé a entrar.');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});

test('T-009: reingresar limpia el aviso y mantiene cerrado el perfil anterior', () => {
  session.start(datos);
  montar();
  abrirPerfil();
  expirar();
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  expect(screen.getByRole('complementary')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  abrirPerfil();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(screen.getByRole('region', { name: 'Login' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('T-010: recupera una sesión preexistente en sessionStorage al montar', () => {
  sessionStorage.setItem('core-sesion-v1', JSON.stringify(datos));
  montar('/metrics');
  expect(screen.queryByRole('region', { name: 'Login' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Pantalla métricas' })).toBeInTheDocument();
  expect(screen.getByText(datos.displayName)).toBeInTheDocument();
});
