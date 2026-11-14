const CLAVE = 'core-sesion-v1';

function cargarSession() {
  let session;
  jest.isolateModules(() => {
    session = require('./session').session;
  });
  return session;
}

describe('session', () => {
  let storage;
  let descriptor;
  let session;
  const datos = { accessToken: 'token-a', module: 'equipo-9', isAdmin: true };

  beforeEach(() => {
    descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    const valores = new Map();
    storage = {
      getItem: jest.fn((key) => valores.get(key) ?? null),
      setItem: jest.fn((key, value) => valores.set(key, String(value))),
      removeItem: jest.fn((key) => valores.delete(key)),
    };
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage });
    session = cargarSession();
  });

  afterEach(() => {
    Object.defineProperty(window, 'sessionStorage', descriptor);
  });

  test('T-193: start persiste la sesión y devuelve el objeto recibido', () => {
    expect(session.start(datos)).toBe(datos);
    expect(storage.getItem(CLAVE)).toBe(JSON.stringify(datos));
  });

  test('T-194: los getters devuelven los datos de la sesión', () => {
    session.start(datos);
    expect(session.get()).toEqual(datos);
    expect(session.getToken()).toBe('token-a');
    expect(session.getModulo()).toBe('equipo-9');
    expect(session.esAdmin()).toBe(true);
  });

  test('T-195: sin sesión devuelve null y false', () => {
    expect(session.get()).toBeNull();
    expect(session.getToken()).toBeNull();
    expect(session.getModulo()).toBeNull();
    expect(session.esAdmin()).toBe(false);
  });

  test('T-196: una nueva instancia del módulo restaura la sesión persistida', () => {
    session.start(datos);
    const restaurada = cargarSession();
    expect(restaurada.get()).toEqual(datos);
    expect(restaurada.getToken()).toBe(datos.accessToken);
    expect(restaurada.getModulo()).toBe(datos.module);
    expect(restaurada.esAdmin()).toBe(true);
  });

  test('T-197: descarta JSON corrupto y permite iniciar otra sesión', () => {
    storage.setItem(CLAVE, '{json inválido');
    expect(session.get()).toBeNull();
    expect(storage.getItem(CLAVE)).toBeNull();
    expect(session.getToken()).toBeNull();
    session.start(datos);
    expect(session.get()).toEqual(datos);
  });

  test('T-198: con acceso a storage bloqueado usa memoria y permite limpiarla', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('Storage bloqueado'); },
    });
    expect(session.get()).toBeNull();
    expect(session.start(datos)).toBe(datos);
    expect(session.get()).toEqual(datos);
    expect(session.getToken()).toBe(datos.accessToken);
    expect(session.getModulo()).toBe(datos.module);
    expect(session.esAdmin()).toBe(true);
    session.clear();
    expect(session.get()).toBeNull();
    expect(session.esAdmin()).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('T-199: clear elimina la sesión en memoria y persistida', () => {
    session.start(datos);
    session.clear();
    expect(storage.getItem(CLAVE)).toBeNull();
    expect(session.get()).toBeNull();
    expect(session.getToken()).toBeNull();
    expect(session.getModulo()).toBeNull();
    expect(session.esAdmin()).toBe(false);
    expect(cargarSession().get()).toBeNull();
  });

  test.each([false, 0, '', null, undefined])('T-200: isAdmin=%p no concede administración', (isAdmin) => {
    session.start({ ...datos, isAdmin });
    expect(session.esAdmin()).toBe(false);
  });

  test('T-201: iniciar otra sesión reemplaza todas las credenciales anteriores', () => {
    session.start(datos);
    const siguiente = { accessToken: 'token-b' };
    session.start(siguiente);
    expect(session.get()).toEqual(siguiente);
    expect(session.getToken()).toBe('token-b');
    expect(session.getModulo()).toBeNull();
    expect(session.esAdmin()).toBe(false);
    expect(storage.getItem(CLAVE)).toBe(JSON.stringify(siguiente));
    expect(cargarSession().get()).toEqual(siguiente);
  });
});
