import axios from "axios";
import { session } from "./session";

// El backend del Core. Se configura por entorno para que el deploy no dependa
// de una URL escrita en el codigo.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // El token dura 15 minutos y no hay refresh: cuando vence se vuelve al
    // login en vez de dejar la pantalla rota con errores 401.
    if (error.response?.status === 401 && session.getToken()) {
      session.clear();
      window.dispatchEvent(new Event("core:sesion-expirada"));
    }
    return Promise.reject(error);
  },
);

/**
 * Saca el mensaje legible de un error del Core.
 *
 * El backend responde siempre con la misma forma
 * `{code, message, details, traceId}`, y el `message` esta escrito para
 * mostrarse tal cual al usuario.
 */
export function mensajeDeError(error, porDefecto = "No se pudo completar la operación.") {
  const data = error?.response?.data;
  if (!data) return error?.message === "Network Error"
    ? "No se pudo conectar con el Core. ¿Está levantado?"
    : porDefecto;

  const detalle = Array.isArray(data.details) && data.details.length
    ? ` (${data.details.map((d) => d.field ?? d.campo).filter(Boolean).join(", ")})`
    : "";
  return (data.message || porDefecto) + detalle;
}

export default api;
