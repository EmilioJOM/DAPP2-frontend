import api from "./api";

/**
 * La bitacora de eventos del Core.
 *
 * El backend ya limita lo que devuelve al modulo autenticado: un equipo ve lo
 * que publico mas lo que le entregaron, y nada del trafico ajeno. El admin ve
 * todo. No hace falta filtrar en el cliente.
 */

/**
 * GET /events — paginado, con filtros.
 *
 * `since` y `until` son instantes ISO con zona horaria: el Core compara contra
 * `receivedAt`. Los filtros vacios no se mandan.
 */
export async function listarEventos({
  page = 1,
  size = 25,
  eventType,
  sourceModule,
  status,
  query,
  since,
  until,
} = {}) {
  const { data } = await api.get("/events", {
    params: { page, size, eventType, sourceModule, status, query, since, until },
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

/**
 * GET /dlq — lo que fallo. El Core ya limita a las del modulo (como origen o
 * destino). `status` vacio trae todos los estados.
 */
export async function listarDeadLetters({ page = 1, size = 25, status = "OPEN" } = {}) {
  const { data } = await api.get("/dlq", { params: { page, size, status: status || undefined } });
  return data;
}

/** GET /dlq/{id} — motivo, detalle del error, datos enviados e historial de reintentos. */
export async function obtenerDeadLetter(deadLetterId) {
  const { data } = await api.get(`/dlq/${deadLetterId}`);
  return data;
}

/**
 * POST /dlq/{id}/retry — reintentar un evento fallido.
 *
 * Lo puede pedir el admin o el modulo involucrado (origen o destino). Queda
 * auditado con la persona que lo pidio.
 */
export async function reintentar(deadLetterId) {
  const { data } = await api.post(`/dlq/${deadLetterId}/retry`);
  return data;
}

/** Como se ve el estado de una dead letter. */
export const estadoDeDeadLetter = {
  OPEN: { texto: "Abierta", tono: "error" },
  RETRIED: { texto: "Reintentada", tono: "ok" },
  DISCARDED: { texto: "Descartada", tono: "muted" },
};

/** Que significa cada motivo, en palabras del representante. */
export const motivoDeDeadLetter = {
  SCHEMA_VIOLATION: "Los datos no cumplen el schema del tipo de evento.",
  DELIVERY_FAILED: "El módulo destino agotó sus intentos de entrega.",
  MALFORMED_MESSAGE: "El mensaje no era JSON válido. No se puede reintentar: corregilo en el módulo origen.",
};

/** Un mensaje malformado no tiene sobre valido: el Core rechaza reintentarlo (409). */
export function esReintentable(deadLetter) {
  return deadLetter?.status === "OPEN" && deadLetter?.reasonCode !== "MALFORMED_MESSAGE";
}

/** Como se ve cada estado en la tabla. */
export const estadoDeEvento = {
  ROUTED: { texto: "Entregado", tono: "ok" },
  NO_SUBSCRIBERS: { texto: "Sin suscriptores", tono: "warn" },
  REJECTED: { texto: "Rechazado", tono: "error" },
  DUPLICATE: { texto: "Duplicado", tono: "muted" },
};
