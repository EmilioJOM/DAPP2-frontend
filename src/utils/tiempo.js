/**
 * Cómo se escriben las marcas de tiempo del panel.
 *
 * En una tabla de 25 renglones las fechas son todas del mismo rato: repetir
 * `06/10/2026 12:00` veinticinco veces llena la columna y tapa lo único que
 * cambia, que es hace cuánto. Por eso lo que se ve es el relativo y la fecha
 * exacta queda en el `title` y en el `dateTime`, para cuando hace falta el dato
 * fino.
 */

const RELATIVO = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

const ABSOLUTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Las escalas de menor a mayor, con cuántas de cada una entran en la siguiente. */
const ESCALAS = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
  ["year", Infinity],
];

function aFecha(iso) {
  if (!iso) return null;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Si la fecha existe y es válida. Sirve para decidir si poner un `<time>`. */
export function esFecha(iso) {
  return aFecha(iso) !== null;
}

/** `06/10/2026 12:00:01`. La que va en el `title` de la celda. */
export function fechaExacta(iso) {
  const fecha = aFecha(iso);
  return fecha ? ABSOLUTA.format(fecha) : "—";
}

/** `hace 3 minutos`, `ayer`, `hace 2 meses`. */
export function haceCuanto(iso, ahora = Date.now()) {
  const fecha = aFecha(iso);
  if (!fecha) return "—";

  let valor = (fecha.getTime() - ahora) / 1000;
  for (const [unidad, tope] of ESCALAS) {
    if (Math.abs(valor) < tope) return RELATIVO.format(Math.round(valor), unidad);
    valor /= tope;
  }
  return "—";
}

/**
 * Cuánto tardó el evento en llegar al hub.
 *
 * Es el dato que la columna "Recibido" escondía: la hora de recepción es casi
 * siempre la misma que la de ocurrencia, así que la columna repetía la de al
 * lado y la diferencia —lo único que delata una demora— había que restarla a
 * ojo. Devuelve `null` cuando no se puede calcular o cuando daría negativo:
 * con los relojes de nueve máquinas distintas eso pasa, y un número inventado
 * es peor que ninguno.
 */
export function demora(desdeIso, hastaIso) {
  const desde = aFecha(desdeIso);
  const hasta = aFecha(hastaIso);
  if (!desde || !hasta) return null;

  const ms = hasta.getTime() - desde.getTime();
  if (ms < 0) return null;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${Math.round(ms / 3_600_000)} h`;
}
