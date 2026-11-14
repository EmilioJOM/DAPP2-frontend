import {
  guardarModulosVisibles,
  modulosVisibles,
} from './subscriptionPreferences';

const CLAVE = 'core-modulos-visibles-v2';

describe('preferencias de módulos visibles', () => {
  let storage;

  beforeEach(() => {
    const valores = new Map();
    storage = {
      getItem: jest.fn((clave) => valores.get(clave) ?? null),
      setItem: jest.fn((clave, valor) => valores.set(clave, valor)),
      removeItem: jest.fn((clave) => valores.delete(clave)),
    };
    jest.spyOn(window, 'localStorage', 'get').mockReturnValue(storage);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('T-202: sin preferencia devuelve la selección vacía que representa todos', () => {
    expect(modulosVisibles()).toEqual([]);
    expect(storage.getItem).toHaveBeenCalledWith(CLAVE);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('T-203: guarda los ids y permite recuperar la selección persistida', () => {
    expect(guardarModulosVisibles(['eventos', 'metricas'])).toEqual([
      'eventos', 'metricas',
    ]);
    expect(storage.setItem).toHaveBeenCalledWith(
      CLAVE, JSON.stringify(['eventos', 'metricas']),
    );
    expect(modulosVisibles()).toEqual(['eventos', 'metricas']);
  });

  test('T-204: elimina duplicados y valores falsy conservando el orden', () => {
    expect(guardarModulosVisibles([
      'metricas', null, '', false, undefined, 0, NaN, 'eventos', 'metricas',
    ])).toEqual(['metricas', 'eventos']);
    expect(modulosVisibles()).toEqual(['metricas', 'eventos']);
  });

  test.each([null, undefined])('T-204: normaliza una entrada %s a selección vacía', (ids) => {
    expect(guardarModulosVisibles(ids)).toEqual([]);
    expect(storage.setItem).toHaveBeenCalledWith(CLAVE, '[]');
  });

  test('T-205: restaura una preferencia previamente almacenada', () => {
    storage.setItem(CLAVE, '["eventos","metricas"]');
    expect(modulosVisibles()).toEqual(['eventos', 'metricas']);
  });

  test('T-206: elimina JSON corrupto y devuelve una selección vacía sin lanzar', () => {
    storage.setItem(CLAVE, '{invalido');
    expect(modulosVisibles()).toEqual([]);
    expect(storage.removeItem).toHaveBeenCalledWith(CLAVE);
    expect(storage.getItem(CLAVE)).toBeNull();
    expect(modulosVisibles()).toEqual([]);
  });

  test.each(['{}', 'null', '"eventos"', '42', 'true'])(
    'T-207: descarta el JSON que no es un arreglo: %s', (valor) => {
      storage.setItem(CLAVE, valor);
      expect(modulosVisibles()).toEqual([]);
    },
  );

  test('T-208: permite leer y obtener la selección normalizada con storage inaccesible', () => {
    jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Acceso denegado');
    });
    expect(modulosVisibles()).toEqual([]);
    expect(guardarModulosVisibles(['eventos', null, 'eventos'])).toEqual(['eventos']);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
