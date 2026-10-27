import { useState } from "react";

/**
 * Las alertas de integración del Core.
 *
 * Son el cálculo más valioso del panel —los agujeros entre equipos aparecen
 * solos, cruzando quién publica qué con quién consume qué— y eran lo más
 * ilegible de la pantalla: cuarenta y siete renglones casi idénticos, cada uno
 * repitiendo la misma frase de dos líneas. Lo único que cambiaba de un renglón
 * al siguiente era el nombre del evento y un par de números, y eso quedaba
 * ahogado en el texto repetido.
 *
 * Lo que se hizo: la explicación va una sola vez, arriba del grupo, y cada
 * renglón trae solamente lo que cambia.
 *
 * Agrupa por `kind` y no por severidad porque el `kind` es lo que define qué
 * hay que hacer. "Nadie lo escucha" y "nadie lo publica" son los dos lados
 * opuestos del mismo agujero y se arreglan en puntas distintas; mezclarlos bajo
 * "Requieren atención" obliga a leer cada renglón para saber a cuál de los dos
 * pertenece. La severidad sigue mandando en el orden y en el color, que es para
 * lo que sirve.
 *
 * El Core va a seguir agregando `kind`s —el último fue `NO_PRODUCER_DECLARED`—.
 * Uno que no esté en este catálogo no rompe nada ni se esconde: arma su propio
 * grupo con el código crudo de título y muestra el `detail` tal como vino, que
 * es exactamente lo que se veía antes para todos. Lo mismo con una severidad
 * desconocida: cae en su propio cajón al final, sin color inventado.
 */

/** `1 módulo espera` / `3 módulos esperan`, para no dejar "modulo(s)" en pantalla. */
function plural(cantidad, uno, varios) {
  return `${cantidad} ${Number(cantidad) === 1 ? uno : varios}`;
}

/**
 * Qué significa cada tipo de alerta y qué es lo que cambia entre un renglón y
 * otro.
 *
 * `resumen` saca de la frase del Core los dos o tres datos que distinguen a una
 * alerta de su vecina. Si el backend cambia el texto el regex deja de matchear,
 * devuelve `null` y el renglón muestra la frase completa: se pierde la síntesis,
 * no el dato.
 */
const CATALOGO = {
  NO_SUBSCRIBERS: {
    titulo: "Llegan y no los escucha nadie",
    significa:
      "El hub recibió eventos de estos tipos y ningún módulo está suscripto, así que no se entregan a nadie. Suele faltar la suscripción, o el nombre no coincide con el que espera el consumidor.",
    resumen: (detalle) => {
      const recibidos = /Se recibieron (\d+)/.exec(detalle)?.[1];
      return recibidos
        ? `${plural(recibidos, "evento recibido", "eventos recibidos")} · sin suscriptores`
        : null;
    },
  },
  NO_PRODUCER_DECLARED: {
    titulo: "Alguien los espera y nadie los publica",
    significa:
      "Hay módulos suscriptos, pero ningún módulo declaró que publica estos tipos. Es el agujero que se rompe en silencio —nadie reclama un evento que nunca vio llegar— y el que queda cuando un equipo corrige el nombre de su evento y el consumidor se queda con el viejo.",
    resumen: (detalle) => {
      const esperan = /^(\d+) modulo/.exec(detalle)?.[1];
      return esperan
        ? `${plural(esperan, "módulo espera", "módulos esperan")} · nadie lo publica`
        : null;
    },
  },
  NO_CONSUMER_DECLARED: {
    titulo: "Se publican y no los escucha nadie",
    significa:
      "Estos tipos tienen productor declarado y ningún suscriptor. Todavía no se rompió nada: el día que se publique el primero no va a llegar a ninguna parte.",
    resumen: (detalle) => {
      const publican = /lo publica (\d+)/.exec(detalle)?.[1];
      return publican
        ? `${plural(publican, "módulo lo publica", "módulos lo publican")} · sin suscriptores`
        : null;
    },
  },
  SIMILAR_NAMES: {
    titulo: "Nombres casi iguales",
    significa:
      "Dos tipos con nombres sospechosamente parecidos. Con nueve equipos bautizando eventos por su cuenta es la falla de integración más común y la más difícil de ver a ojo: si son el mismo evento, hay que acordar un solo nombre.",
    resumen: (detalle) => {
      const otro = /^'[^']*' y '([^']+)'/.exec(detalle)?.[1];
      return otro ? `parecido a ${otro}` : null;
    },
  },
  NEVER_RECEIVED: {
    titulo: "Declarados de los dos lados, todavía sin tráfico",
    significa:
      "Hay quien los espera y quien se comprometió a publicarlos, pero no llegó ninguno todavía. Mientras el módulo que publica no haya arrancado es lo esperable; si ya arrancó, es un agujero.",
    resumen: (detalle) => {
      const partes = /^(\d+) modulo\(s\) esperan '[^']*' y (\d+)/.exec(detalle);
      return partes
        ? `${plural(partes[1], "módulo espera", "módulos esperan")} · ${plural(
            partes[2],
            "lo declara",
            "lo declaran",
          )} · ninguno llegó`
        : null;
    },
  },
  UNDECLARED_TYPE: {
    titulo: "Se registraron solos al aparecer",
    significa:
      "Nadie declaró estos tipos: el hub los dio de alta la primera vez que los vio pasar. Conviene que el equipo dueño los declare con su descripción y su esquema, así se validan.",
    resumen: (detalle) => {
      const origen = /origen: ([^)]+)\)/.exec(detalle)?.[1];
      return origen ? `origen: ${origen}` : null;
    },
  },
};

/** De más accionable a menos. Dentro de cada severidad manda este orden. */
const ORDEN_DE_KIND = [
  "NO_SUBSCRIBERS",
  "NO_PRODUCER_DECLARED",
  "NO_CONSUMER_DECLARED",
  "SIMILAR_NAMES",
  "NEVER_RECEIVED",
  "UNDECLARED_TYPE",
];

const SEVERIDADES = {
  warning: { orden: 0, plural: "Requieren atención", tono: "warning" },
  info: { orden: 1, plural: "Informativas", tono: "info" },
};

/** Para una severidad que el panel no conoce: su propio cajón, sin color inventado. */
const SEVERIDAD_DESCONOCIDA = { orden: 2, plural: "Sin clasificar", tono: "otra" };

const posicion = (kind) => {
  const i = ORDEN_DE_KIND.indexOf(kind);
  return i === -1 ? ORDEN_DE_KIND.length : i;
};

/** Una entrada por `kind`, ordenadas por severidad y después por accionabilidad. */
function agrupar(alertas) {
  const grupos = new Map();

  for (const alerta of alertas) {
    const kind = alerta.kind || "SIN_TIPO";
    if (!grupos.has(kind)) {
      grupos.set(kind, {
        kind,
        meta: CATALOGO[kind] ?? null,
        severidad: SEVERIDADES[alerta.severity] ?? SEVERIDAD_DESCONOCIDA,
        items: [],
      });
    }
    grupos.get(kind).items.push(alerta);
  }

  return [...grupos.values()].sort(
    (a, b) =>
      a.severidad.orden - b.severidad.orden ||
      posicion(a.kind) - posicion(b.kind) ||
      a.kind.localeCompare(b.kind),
  );
}

export default function AlertasDeIntegracion({ alertas = [] }) {
  const [filtro, setFiltro] = useState("");
  const buscado = filtro.trim().toLowerCase();

  if (!alertas.length) {
    return (
      <section className="alerts-panel">
        <h3 className="section-title">Alertas de integración</h3>
        <p className="alertas-sin-nada">
          <strong>Ninguna.</strong> Todo lo que se publica tiene quien lo escuche, y todo
          lo que alguien espera tiene quien lo publique.
        </p>
      </section>
    );
  }

  const grupos = agrupar(alertas)
    .map((grupo) => ({
      ...grupo,
      visibles: buscado
        ? grupo.items.filter((a) =>
            `${a.eventType ?? ""} ${a.detail ?? ""}`.toLowerCase().includes(buscado),
          )
        : grupo.items,
    }))
    .filter((grupo) => grupo.visibles.length > 0);

  const aAtender = alertas.filter((a) => a.severity === "warning").length;
  const encontradas = grupos.reduce((n, g) => n + g.visibles.length, 0);

  return (
    <section className="alerts-panel">
      <div className="alertas-encabezado">
        <div>
          <h3 className="section-title">Alertas de integración</h3>
          {/* El total solo no dice si está bien o mal. Lo que importa es cuántas
              piden que alguien haga algo. */}
          <p className="alertas-resumen">
            <strong>{alertas.length}</strong> en total ·{" "}
            <strong className={aAtender ? "alertas-urgentes" : ""}>{aAtender}</strong>{" "}
            {aAtender === 1 ? "requiere" : "requieren"} atención
          </p>
        </div>
        {alertas.length > 8 && (
          <input
            className="alertas-filtro"
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por tipo de evento..."
            aria-label="Filtrar alertas por tipo de evento"
          />
        )}
      </div>

      {buscado && (
        <p className="alertas-coincidencias" role="status">
          {encontradas
            ? `${encontradas} de ${alertas.length} coinciden con «${filtro.trim()}».`
            : `Ninguna alerta menciona «${filtro.trim()}».`}
        </p>
      )}

      {grupos.map((grupo, i) => (
        <div key={`${grupo.kind}|${buscado ? "filtrado" : "todo"}`}>
          {/* La severidad se dice una sola vez, arriba del primer grupo que la
              tiene, en vez de repetirse como etiqueta en cada cabecera: con
              cuatro grupos seguidos de warning, "requiere atención" cuatro
              veces es el mismo ruido que se vino a sacar. */}
          {grupo.severidad.orden !== grupos[i - 1]?.severidad.orden && (
            <h4 className={`alertas-corte ${grupo.severidad.tono}`}>
              {grupo.severidad.plural}
            </h4>
          )}
          {/* `abrir` depende del filtro, y la `key` del contenedor cambia con
              él: así al filtrar los grupos se remontan abiertos, porque buscar
              algo y encontrarlo plegado no sirve de nada. */}
          <GrupoDeAlertas
            grupo={grupo}
            abrir={Boolean(buscado) || grupo.severidad.tono === "warning"}
          />
        </div>
      ))}
    </section>
  );
}

function GrupoDeAlertas({ grupo, abrir }) {
  const [abierto, setAbierto] = useState(abrir);
  const { kind, meta, severidad, visibles } = grupo;
  const idLista = `alertas-${kind}`;

  return (
    <div className={`alertas-grupo ${severidad.tono}`}>
      <button
        type="button"
        className="alertas-cabecera"
        aria-expanded={abierto}
        aria-controls={idLista}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="flecha" aria-hidden="true">
          ›
        </span>
        <span className="alertas-titulo">
          {/* Un kind que el panel no conoce se muestra tal cual, en mono: no se
              pierde ni se disfraza de otra cosa. */}
          {meta ? meta.titulo : <code>{kind}</code>}
        </span>
        <span className="cuenta">{visibles.length}</span>
      </button>

      {abierto && (
        <div className="alertas-cuerpo" id={idLista}>
          {/* La frase que antes se repetía en cada renglón, dicha una sola vez. */}
          <p className="alertas-significa">
            {meta
              ? meta.significa
              : "El Core informa este tipo de alerta y el panel todavía no tiene una explicación para él. Abajo va el texto completo que mandó."}
          </p>
          <ul className="alert-list">
            {visibles.map((alerta, i) => {
              const detalle = alerta.detail ?? "";
              const resumen = meta?.resumen?.(detalle) ?? null;
              return (
                <li
                  className="alerta"
                  key={`${alerta.eventType ?? ""}-${i}`}
                  title={detalle || undefined}
                >
                  <code className="alerta-tipo">{alerta.eventType || "—"}</code>
                  <span className={`alerta-dato ${resumen ? "" : "alerta-dato--crudo"}`}>
                    {resumen ?? detalle}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
