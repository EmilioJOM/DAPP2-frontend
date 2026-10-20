import api from "./api";

/**
 * Metricas del dashboard.
 *
 * Hay dos vistas y la eleccion depende de quien entro: un modulo ve solo su
 * trafico, el equipo 9 ve el hub completo.
 */

/** GET /dashboard — el tablero del modulo autenticado. */
export async function tableroDelModulo({ windowHours = 24 } = {}) {
  const { data } = await api.get("/dashboard", { params: { windowHours } });
  return data;
}

/** GET /dashboard/global — solo admin. */
export async function tableroGlobal({ windowHours = 24 } = {}) {
  const { data } = await api.get("/dashboard/global", { params: { windowHours } });
  return data;
}

/** GET /dashboard/modules/{nombre} — el admin puede pedir el de cualquiera. */
export async function tableroDe(modulo, { windowHours = 24 } = {}) {
  const { data } = await api.get(`/dashboard/modules/${modulo}`, {
    params: { windowHours },
  });
  return data;
}

/**
 * GET /dashboard/integration-alerts — los agujeros de integracion que el Core
 * detecta cruzando quien publica que con quien consume que.
 */
export async function alertasDeIntegracion() {
  const { data } = await api.get("/dashboard/integration-alerts");
  return data;
}

/** GET /health/ready — estado del Core y del broker. */
export async function estadoDelCore() {
  const base = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1")
    .replace(/\/api\/v1\/?$/, "");
  const { data } = await api.get(`${base}/health/ready`, { baseURL: "" });
  return data;
}
