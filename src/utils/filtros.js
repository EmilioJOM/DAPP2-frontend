import { estadoDeEvento } from "../services/events";

/** Filtros del historial (HU-06). */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SIN_FILTROS = { eventId: "", desde: "", hasta: "", estado: "" };

/** "2026-11-01" → el instante en que empieza (o termina) ese dia en la hora local. */
export function limiteDelDia(fecha, fin = false) {
  if (!fecha) return undefined;
  const dia = new Date(`${fecha}T${fin ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(dia.getTime()) ? undefined : dia.toISOString();
}

/** Devuelve el problema del filtro, o "" si se puede aplicar. */
export function validarFiltros({ eventId, desde, hasta }) {
  if (eventId && !UUID.test(eventId)) return "El identificador tiene que ser un eventId completo (UUID).";
  if (desde && hasta && desde > hasta) return "La fecha «desde» es posterior a «hasta».";
  return "";
}

export const hayFiltros = (f) => Object.values(f).some(Boolean);

/** «ticket» · estado Rechazado · desde 2026-11-01 — lo que se ve en el chip. */
export function describirFiltros(busqueda, { eventId, desde, hasta, estado }) {
  const partes = [];
  if (eventId) partes.push(`eventId ${eventId}`);
  if (busqueda) partes.push(`«${busqueda}»`);
  if (estado) partes.push(`estado ${estadoDeEvento[estado]?.texto ?? estado}`);
  if (desde) partes.push(`desde ${desde}`);
  if (hasta) partes.push(`hasta ${hasta}`);
  return partes.join(" · ");
}
