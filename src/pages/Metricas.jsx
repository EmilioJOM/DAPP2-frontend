import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  alertasDeIntegracion,
  estadoDelCore,
  tableroDe,
  tableroDelModulo,
  tableroGlobal,
} from "../services/metrics";
import { EsqueletoKpis, EsqueletoTabla } from "../components/Esqueleto";
import { ErrorDeCarga } from "../components/Estados";
import AlertasDeIntegracion from "../components/AlertasDeIntegracion";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";
import { esFecha, fechaExacta, haceCuanto } from "../utils/tiempo";

const VENTANAS = [
  { horas: 1, etiqueta: "1 h" },
  { horas: 24, etiqueta: "24 h" },
  { horas: 168, etiqueta: "7 días" },
];

/**
 * Los estados de entrega vienen del enum del Core. En la pantalla iban crudos
 * —`RETRYING`, `DEAD`— y había que conocer el enum para leerlos. Uno que no
 * esté acá se muestra tal cual, que es lo que pasaba con todos.
 */
const ESTADO_DE_ENTREGA = {
  DELIVERED: "Entregadas",
  PENDING: "En camino",
  RETRYING: "Reintentando",
  DEAD: "En dead letter",
  DISCARDED: "Descartadas",
};

function Kpi({ titulo, valor, detalle, urgente = false }) {
  return (
    <article className={`kpi ${urgente ? "urgente" : ""}`}>
      <b>{titulo}</b>
      <strong className="kpi-value">{valor}</strong>
      {detalle && <p>{detalle}</p>}
    </article>
  );
}

/** Una marca de tiempo: se lee el relativo, el dato fino queda en el `title`. */
function Cuando({ iso, nunca = "nunca" }) {
  if (!esFecha(iso)) return <span className="dato-ausente">{nunca}</span>;
  return (
    <time dateTime={iso} title={fechaExacta(iso)}>
      {haceCuanto(iso)}
    </time>
  );
}

/**
 * Volumen por hora. Sin libreria: son 24 barras y una grilla de fondo en CSS.
 *
 * Solo se etiqueta una hora de cada tres y se anota el pico: con las 24 puestas
 * el eje se vuelve ruido y el ojo deja de ver la forma, que es lo unico que
 * importa en un grafico de esta altura.
 */
function VolumenPorHora({ puntos }) {
  if (!puntos?.length) {
    return <p className="empty-note">Sin eventos en la ventana elegida.</p>;
  }
  const maximo = Math.max(...puntos.map((p) => p.total), 1);
  const indicePico = puntos.findIndex((p) => p.total === maximo);
  const cada = puntos.length > 14 ? 3 : 1;

  return (
    <div className="volume-chart" role="img"
         aria-label={`Volumen por hora: ${puntos.reduce((n, p) => n + p.total, 0)} eventos, pico de ${maximo}`}>
      {puntos.map((punto, i) => {
        const hora = new Date(punto.hour);
        return (
          <div
            className="volume-bar"
            key={punto.hour}
            title={`${hora.toLocaleString()} · ${punto.total} eventos${
              punto.rejected ? ` · ${punto.rejected} rechazados` : ""
            }`}
          >
            <span className="volume-bar-fill" style={{ height: `${(punto.total / maximo) * 100}%` }}>
              {i === indicePico && <span className="volume-pico">{maximo}</span>}
            </span>
            {punto.rejected > 0 && (
              <span
                className="volume-bar-rejected"
                style={{ height: `${(punto.rejected / maximo) * 100}%` }}
              />
            )}
            <small>{i % cada === 0 ? String(hora.getHours()).padStart(2, "0") : " "}</small>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Un ranking.
 *
 * Cada fila lleva una barrita proporcional al mayor del grupo. Una columna de
 * números sueltos obliga a comparar de memoria: con la barra se ve de un
 * vistazo si el primero duplica al segundo o si están todos parejos.
 */
function Lista({ titulo, filas, clave, valor, vacio }) {
  const maximo = Math.max(...(filas ?? []).map((f) => Number(f[valor]) || 0), 1);

  return (
    <div className="fake-chart">
      <b>
        {titulo}
        {filas?.length ? <span className="fake-chart-cuenta">{filas.length}</span> : null}
      </b>
      {filas?.length ? (
        <ul className="plain-list plain-list--proporcional">
          {filas.map((fila) => (
            <li
              key={fila[clave]}
              style={{ "--proporcion": `${((Number(fila[valor]) || 0) / maximo) * 100}%` }}
            >
              <span>{fila[clave]}</span>
              <strong>{fila[valor]}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">{vacio}</p>
      )}
    </div>
  );
}

/** Una lista de nombres sin número al lado: tipos suscriptos, tipos declarados. */
function ListaDeTipos({ titulo, tipos = [], vacio }) {
  return (
    <div className="fake-chart">
      <b>
        {titulo}
        <span className="fake-chart-cuenta">{tipos.length}</span>
      </b>
      {tipos.length ? (
        <ul className="plain-list">
          {tipos.map((tipo) => (
            <li key={tipo}>
              <span>{tipo}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">{vacio}</p>
      )}
    </div>
  );
}

export default function Metricas() {
  const [searchParams] = useSearchParams();
  const moduloPedido = searchParams.get("module");
  const esAdmin = session.esAdmin();

  const [ventana, setVentana] = useState(24);
  // Se incrementa al tocar "Reintentar": entra en la clave y vuelve a disparar
  // el pedido sin recargar la pagina entera.
  const [intento, setIntento] = useState(0);

  // Solo el admin puede mirar otro modulo: sin `?module=` ve el hub completo,
  // y con `?module=` el tablero de ese equipo. El resto siempre ve lo suyo.
  const global = esAdmin && !moduloPedido;
  const otroModulo = esAdmin && moduloPedido && moduloPedido !== session.getModulo();

  // `clave` es la consulta pedida y `datos.clave` la que ya respondio: mientras
  // no coinciden la pantalla esta cargando. Asi el indicador no depende de que
  // cada rama se acuerde de apagarlo.
  const clave = `${global}|${moduloPedido ?? ""}|${ventana}|${intento}`;
  const [datos, setDatos] = useState(null);
  const cargando = datos?.clave !== clave;
  const error = datos?.error ?? "";
  const tablero = datos?.tablero ?? null;
  const alertas = datos?.alertas ?? [];
  const salud = datos?.salud ?? null;

  useEffect(() => {
    let vigente = true;
    const pedido = global
      ? tableroGlobal({ windowHours: ventana })
      : otroModulo
        ? tableroDe(moduloPedido, { windowHours: ventana })
        : tableroDelModulo({ windowHours: ventana });

    pedido
      .then(async (tablero) => [
        tablero,
        // El tablero global ya trae las alertas adentro; el de un modulo no.
        global ? (tablero.integrationAlerts ?? []) : await alertasDeIntegracion(),
        await estadoDelCore().catch(() => null),
      ])
      .then(([tablero, alertas, salud]) => {
        if (vigente) setDatos({ clave, tablero, alertas, salud });
      })
      .catch((e) => {
        if (vigente) {
          setDatos({ clave, error: mensajeDeError(e, "No se pudieron cargar las métricas.") });
        }
      });

    return () => { vigente = false; };
  }, [clave, global, otroModulo, moduloPedido, ventana]);

  // El encabezado se arma una vez y se usa tambien mientras carga y cuando
  // falla: una pantalla que pierde su titulo al fallar se lee como rota.
  const dondeEstoy = global ? "Hub completo" : (moduloPedido ?? session.getModulo() ?? "");
  const encabezado = (
    <>
      <div className="crumb">Observatory / Telemetría / {dondeEstoy}</div>
      <header className="page-head">
        <div>
          <h1>{global ? "Métricas del Core" : `Métricas: ${dondeEstoy}`}</h1>
        </div>
      </header>
    </>
  );

  if (cargando) {
    return (
      <div className="screen metrics">
        {encabezado}
        <EsqueletoKpis />
        <EsqueletoTabla filas={4} columnas={5} />
      </div>
    );
  }

  // El error ya no se come la pantalla: quedan el titulo y la navegacion, y hay
  // un reintento a mano. En desarrollo el caso normal es que el Core todavia no
  // arranco, y para eso volver a pedir alcanza.
  if (error) {
    return (
      <div className="screen metrics">
        {encabezado}
        <ErrorDeCarga
          titulo="No se pudieron cargar las métricas"
          mensaje={error}
          onReintentar={() => setIntento((i) => i + 1)}
        />
      </div>
    );
  }
  if (!tablero) return null;

  const titulo = global ? "Métricas del Core" : `Métricas: ${tablero.module}`;
  const brokerArriba = salud?.checks?.broker?.status === "up";

  return (
    <div className="screen metrics">
      <div className="crumb">
        Observatory / Telemetría / {global ? "Hub completo" : tablero.module}
      </div>

      <header className="page-head">
        <div>
          <h1>{titulo}</h1>
          <p>
            Ventana de {tablero.windowHours} h · actualizado{" "}
            {new Date(tablero.generatedAt).toLocaleString()}
            {salud && (
              <>
                {" · broker "}
                <strong className={brokerArriba ? "ok" : "ko"}>
                  {brokerArriba ? "conectado" : "caído"}
                </strong>
              </>
            )}
          </p>
        </div>
        <div className="metrics-head-actions">
          <div className="window-picker" role="group" aria-label="Ventana de tiempo">
            {VENTANAS.map((v) => (
              <button
                key={v.horas}
                type="button"
                className={ventana === v.horas ? "selected" : ""}
                aria-pressed={ventana === v.horas}
                onClick={() => setVentana(v.horas)}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
          {esAdmin && !global && <Link className="metrics-global-link" to="/metrics">Ver el hub completo</Link>}
        </div>
      </header>

      {global ? <VistaGlobal tablero={tablero} /> : <VistaDeModulo tablero={tablero} />}

      <section className="chart-panel">
        <h2>Volumen por hora</h2>
        <VolumenPorHora puntos={tablero.volumeByHour} />
      </section>

      <AlertasDeIntegracion alertas={alertas} />
    </div>
  );
}

function VistaDeModulo({ tablero }) {
  const { published, received, deadLetters, subscriptions, publications, processing } = tablero;
  return (
    <>
      <div className="kpi-grid">
        <Kpi titulo="Publicados" valor={published.inWindow} detalle={`${published.total} desde siempre`} />
        <Kpi
          titulo="Recibidos"
          valor={received.total}
          detalle={`${received.delivered} entregados · ${received.pendingRetry} reintentando`}
        />
        <Kpi
          titulo="En dead letter"
          valor={deadLetters.open}
          detalle={deadLetters.open > 0 ? "Abiertos, esperando reproceso" : "Nada pendiente de reproceso"}
          urgente={deadLetters.open > 0}
        />
        <Kpi
          titulo="Procesamiento"
          valor={`${processing.avgMs} ms`}
          detalle={`máximo ${processing.maxMs} ms`}
        />
      </div>

      <div className="chart-grid">
        <Lista
          titulo="Tipos que más publicó"
          filas={published.topTypes}
          clave="eventType"
          valor="total"
          vacio="No publicó nada en esta ventana."
        />
        <ListaDeTipos
          titulo="Suscripciones activas"
          tipos={subscriptions.eventTypes}
          vacio="Sin suscripciones: no va a recibir nada. Elegí tipos en Eventos Suscriptos."
        />
        <ListaDeTipos
          titulo="Tipos declarados para publicar"
          tipos={publications.declared}
          vacio="No declaró ninguno: los demás equipos no tienen cómo saber qué publica."
        />
      </div>
    </>
  );
}

function VistaGlobal({ tablero }) {
  const { events, deliveries, deadLetters, modules } = tablero;
  const entregas = Object.entries(deliveries.byStatus ?? {});
  const totalEntregas = entregas.reduce((n, [, total]) => n + total, 0);
  const callados = modules.filter((m) => m.active && !m.lastPublishAt).length;

  return (
    <>
      <div className="kpi-grid">
        <Kpi titulo="Eventos en la ventana" valor={events.total} detalle={`${events.lastHour} en la última hora`} />
        <Kpi titulo="Por minuto" valor={events.perMinuteLastHour} detalle="Promedio de la última hora" />
        <Kpi
          titulo="Dead letters abiertos"
          valor={deadLetters.open}
          detalle={deadLetters.open > 0 ? "A reprocesar o descartar" : "Nada pendiente"}
          urgente={deadLetters.open > 0}
        />
        <Kpi
          titulo="Procesamiento"
          valor={`${events.processing.avgMs} ms`}
          detalle={`máximo ${events.processing.maxMs} ms`}
        />
      </div>

      <div className="chart-grid">
        <Lista titulo="Tipos más frecuentes" filas={events.topTypes} clave="eventType" valor="total" vacio="Sin eventos." />
        <Lista titulo="Quién publica más" filas={events.bySourceModule} clave="module" valor="total" vacio="Sin eventos." />
        <div className="fake-chart">
          <b>
            Entregas por estado
            <span className="fake-chart-cuenta">{totalEntregas}</span>
          </b>
          {entregas.length ? (
            <ul className="plain-list plain-list--proporcional">
              {entregas.map(([estado, total]) => (
                <li
                  key={estado}
                  style={{ "--proporcion": `${(total / Math.max(totalEntregas, 1)) * 100}%` }}
                >
                  {/* El enum crudo obligaba a conocer el enum. El codigo queda en
                      el `title`, que es lo que se busca en los logs. */}
                  <span title={estado}>{ESTADO_DE_ENTREGA[estado] ?? estado}</span>
                  <strong>{total}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Todavía no se entregó nada.</p>
          )}
        </div>
      </div>

      <h3 className="section-title">Módulos</h3>
      {/* El número solo no dice nada: lo que importa de esta tabla es cuántos
          equipos activos todavía no mandaron un solo evento. */}
      <p className="tabla-resumen">
        {modules.length} módulos ·{" "}
        {callados > 0 ? (
          <strong className="dato-aviso">
            {callados} {callados === 1 ? "activo que nunca publicó" : "activos que nunca publicaron"}
          </strong>
        ) : (
          "todos los activos ya publicaron algo"
        )}
      </p>
      <div className="tabla-scroll">
        <table className="module-table">
          <thead>
            <tr>
              <th scope="col">Módulo</th><th scope="col">Equipo</th><th scope="col">Suscripciones</th>
              <th scope="col">Último login</th><th scope="col">Última publicación</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.name}>
                <td>
                  <Link to={`/metrics?module=${encodeURIComponent(m.name)}`}>{m.displayName}</Link>
                  {/* Antes la fila inactiva iba con `opacity: .45`, que deja el
                      texto en 2:1 de contraste. Ahora lo dice una etiqueta. */}
                  {!m.active && <span className="pill pill--apagada">inactivo</span>}
                  <code>{m.name}</code>
                </td>
                <td>{m.team ?? <span className="dato-ausente">sin equipo</span>}</td>
                <td>{m.subscriptions > 0 ? m.subscriptions : <span className="dato-aviso">ninguna</span>}</td>
                <td><Cuando iso={m.lastLoginAt} /></td>
                <td><Cuando iso={m.lastPublishAt} nunca="nunca publicó" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
