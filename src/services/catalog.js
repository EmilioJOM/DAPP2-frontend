import api from "./api";

/**
 * El catalogo de modulos y tipos de evento, leido del Core.
 *
 * Antes estaba escrito a mano en el front, con los nombres en castellano del
 * enunciado (`ReclamoCreado`). Los equipos despues acordaron ingles camelCase
 * (`ticketCreated`), asi que la lista quedo desactualizada y mostraba eventos
 * que ya no existen. Ahora sale del Core, que es el que manda.
 */

/** GET /modules — los 9 modulos de la plataforma. */
export async function listarModulos() {
  const { data } = await api.get("/modules");
  return data;
}

/** GET /event-types — todos los tipos que circulan por el hub. */
export async function listarTiposDeEvento() {
  const { data } = await api.get("/event-types", { params: { size: 200 } });
  return data.items ?? [];
}

/**
 * Los tipos agrupados por el modulo que los publica, que es como los muestra
 * la pantalla de suscripciones.
 */
export async function catalogoPorModulo() {
  const [modulos, tipos] = await Promise.all([listarModulos(), listarTiposDeEvento()]);

  const porModulo = new Map(
    modulos.map((m) => [m.name, { ...m, id: m.name, events: [] }]),
  );

  // Los tipos que se auto-registraron al aparecer por el hub pueden no tener
  // dueno declarado: van juntos para que se vean y alguien los acomode.
  const huerfanos = { id: "__sin-duenio", name: "Sin módulo propietario", events: [] };

  for (const tipo of tipos) {
    const destino = porModulo.get(tipo.ownerModule) ?? huerfanos;
    destino.events.push(tipo);
  }

  const resultado = [...porModulo.values()].filter((m) => m.events.length > 0);
  if (huerfanos.events.length) resultado.push(huerfanos);
  return resultado;
}

/** GET /event-types/map — quien publica y quien consume cada tipo. */
export async function mapaDeIntegracion() {
  const { data } = await api.get("/event-types/map");
  return data;
}
