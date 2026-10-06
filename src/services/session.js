const CLAVE = "core-sesion-v1";

// sessionStorage y no memoria: si no, refrescar la pagina deslogueaba.
// Y no localStorage: la sesion muere al cerrar la pestaña, que para un panel
// interno es el comportamiento razonable.
function almacen() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // modo privado o storage bloqueado
  }
}

let enMemoria = null;

function leer() {
  if (enMemoria) return enMemoria;
  const target = almacen();
  if (!target) return null;
  try {
    const raw = target.getItem(CLAVE);
    enMemoria = raw ? JSON.parse(raw) : null;
    return enMemoria;
  } catch {
    target.removeItem(CLAVE);
    return null;
  }
}

export const session = {
  /** Guarda lo que devuelve POST /auth/login. */
  start(datos) {
    enMemoria = datos;
    const target = almacen();
    if (target) target.setItem(CLAVE, JSON.stringify(datos));
    return datos;
  },
  get() {
    return leer();
  },
  getToken() {
    return leer()?.accessToken ?? null;
  },
  /** El modulo al que pertenece la persona. Define que datos ve. */
  getModulo() {
    return leer()?.module ?? null;
  },
  /** Solo el equipo 9: ve el trafico de todos los modulos. */
  esAdmin() {
    return Boolean(leer()?.isAdmin);
  },
  clear() {
    enMemoria = null;
    almacen()?.removeItem(CLAVE);
  },
};
