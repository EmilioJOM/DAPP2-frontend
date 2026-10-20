import api from "./api";

/**
 * La bitacora de eventos del Core.
 *
 * El backend ya limita lo que devuelve al modulo autenticado: un equipo ve lo
 * que publico mas lo que le entregaron, y nada del trafico ajeno. El admin ve
 * todo. No hace falta filtrar en el cliente.
 */

/** GET /events — paginado, con filtros. */
export async function listarEventos({
  page = 1,
  size = 25,
  eventType,
  sourceModule,
  status,
  query,
} = {}) {
  const { data } = await api.get("/events", {
    params: { page, size, eventType, sourceModule, status, query },
  });
  return data;
}

/** GET /events/{eventId} — el sobre completo y el estado de cada entrega. */
export async function obtenerEvento(eventId) {
  const { data } = await api.get(`/events/${eventId}`);
  return data;
}

/** GET /events/journey/{correlationId} — el recorrido del tramite. */
export async function obtenerJourney(correlationId) {
  const { data } = await api.get(`/events/journey/${correlationId}`);
  return data;
}

/** GET /dlq — lo que fallo. */
export async function listarDeadLetters({ page = 1, size = 25, status = "OPEN" } = {}) {
  const { data } = await api.get("/dlq", { params: { page, size, status } });
  return data;
}

/**
 * POST /dlq/{id}/retry — reintentar un evento fallido.
 *
 * Es lo que hay detras del boton de reenviar del historial. **Solo el admin**
 * puede: para el resto el Core responde 403.
 */
export async function reintentar(deadLetterId) {
  const { data } = await api.post(`/dlq/${deadLetterId}/retry`);
  return data;
}

/** Como se ve cada estado en la tabla. */
export const estadoDeEvento = {
  ROUTED: { texto: "Entregado", tono: "ok" },
  NO_SUBSCRIBERS: { texto: "Sin suscriptores", tono: "warn" },
  REJECTED: { texto: "Rechazado", tono: "error" },
  DUPLICATE: { texto: "Duplicado", tono: "muted" },
};
