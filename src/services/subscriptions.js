import api from "./api";

/**
 * Suscripciones reales contra el Core.
 *
 * Antes la seleccion de eventos se guardaba en localStorage, asi que no hacia
 * nada: el modulo no recibia los eventos elegidos. Ahora cada tilde crea o
 * borra una suscripcion de verdad, y el Core declara la cola y su binding en
 * RabbitMQ en el acto.
 */

/** GET /subscriptions — las del modulo autenticado. El admin ve todas. */
export async function listarSuscripciones() {
  const { data } = await api.get("/subscriptions");
  return data;
}

/** POST /subscriptions */
export async function suscribirse(eventType, { maxAttempts = 4 } = {}) {
  const { data } = await api.post("/subscriptions", { eventType, maxAttempts });
  return data;
}

/** DELETE /subscriptions/{id} */
export async function cancelarSuscripcion(id) {
  await api.delete(`/subscriptions/${id}`);
}

/** POST /subscriptions/{id}/toggle — pausar sin perder la suscripcion. */
export async function pausarSuscripcion(id, activa) {
  const { data } = await api.post(`/subscriptions/${id}/toggle`, null, {
    params: { active: activa },
  });
  return data;
}

/**
 * Lleva las suscripciones del modulo al conjunto de tipos elegido: da de alta
 * lo que falta y baja lo que sobra. Devuelve que cambio, para poder avisarlo.
 */
export async function sincronizar(tiposElegidos) {
  const actuales = await listarSuscripciones();
  const porTipo = new Map(actuales.map((s) => [s.eventType, s]));
  const elegidos = new Set(tiposElegidos);

  const aAgregar = [...elegidos].filter((t) => !porTipo.has(t));
  // Una suscripcion pausada sigue existiendo: volver a tildarla la reactiva en
  // vez de crear una segunda, que el Core rechazaria por duplicada.
  const aReactivar = [...elegidos]
    .map((t) => porTipo.get(t))
    .filter((s) => s && !s.active);
  const aQuitar = actuales.filter((s) => !elegidos.has(s.eventType));

  await Promise.all([
    ...aAgregar.map((t) => suscribirse(t)),
    ...aReactivar.map((s) => pausarSuscripcion(s.id, true)),
    ...aQuitar.map((s) => cancelarSuscripcion(s.id)),
  ]);

  return { agregadas: aAgregar.length + aReactivar.length, quitadas: aQuitar.length };
}
