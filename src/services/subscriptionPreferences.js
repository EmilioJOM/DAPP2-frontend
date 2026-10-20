/**
 * Preferencias de visualizacion, nada mas.
 *
 * Antes este archivo tenia el catalogo de modulos y eventos escrito a mano, y
 * ademas guardaba la seleccion de eventos como si fuera una suscripcion. Las
 * suscripciones de verdad ahora viven en el Core (`services/subscriptions.js`);
 * lo unico que queda aca es que modulos eligio mirar la persona, que es una
 * preferencia local y no tiene por que ir al backend.
 */

const CLAVE = "core-modulos-visibles-v2";

function almacen() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Los modulos que la persona eligio mirar. Vacio = todos. */
export function modulosVisibles() {
  const target = almacen();
  if (!target) return [];
  try {
    const raw = target.getItem(CLAVE);
    const valor = raw ? JSON.parse(raw) : [];
    return Array.isArray(valor) ? valor : [];
  } catch {
    target.removeItem(CLAVE);
    return [];
  }
}

export function guardarModulosVisibles(ids) {
  const limpio = [...new Set((ids ?? []).filter(Boolean))];
  almacen()?.setItem(CLAVE, JSON.stringify(limpio));
  return limpio;
}
