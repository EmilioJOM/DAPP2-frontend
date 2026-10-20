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
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";

const VENTANAS = [
  { horas: 1, etiqueta: "1 h" },
  { horas: 24, etiqueta: "24 h" },
  { horas: 168, etiqueta: "7 días" },
];

function Kpi({ titulo, valor, detalle, urgente = false }) {
  return (
    <article className={`kpi ${urgente ? "urgente" : ""}`}>
      <b>{titulo}</b>
      <strong className="kpi-value">{valor}</strong>
      {detalle && <p>{detalle}</p>}
    </article>
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
            <small>{i % cada === 0 ? String(hora.getHours()).padStart(2, "0") : "\u00a0"}</small>
          </div>
        );
      })}
    </div>
  );
}

function Lista({ titulo, filas, clave, valor, vacio }) {
  return (
    <div className="fake-chart">
      <b>{titulo}</b>
      {filas?.length ? (
        <ul className="plain-list">
          {filas.map((fila) => (
            <li key={fila[clave]}>
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

export default function Metricas() {
  const [searchParams] = useSearchParams();
  const moduloPedido = searchParams.get("module");
  const esAdmin = session.esAdmin();

  const [ventana, setVentana] = useState(24);

  // Solo el admin puede mirar otro modulo: sin `?module=` ve el hub completo,
  // y con `?module=` el tablero de ese equipo. El resto siempre ve lo suyo.
  const global = esAdmin && !moduloPedido;
  const otroModulo = esAdmin && moduloPedido && moduloPedido !== session.getModulo();

  // `clave` es la consulta pedida y `datos.clave` la que ya respondio: mientras
  // no coinciden la pantalla esta cargando. Asi el indicador no depende de que
  // cada rama se acuerde de apagarlo.
  const clave = `${global}|${moduloPedido ?? ""}|${ventana}`;
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

  if (cargando) {
    return (
      <div className="screen metrics">
        <div className="crumb">Observatory / Telemetría</div>
        <header className="page-head"><div><h1>Métricas</h1></div></header>
        <EsqueletoKpis />
        <EsqueletoTabla filas={4} columnas={5} />
      </div>
    );
  }
  if (error) return <div className="screen metrics"><div className="notice error" role="alert">{error}</div></div>;
  if (!tablero) return null;

  const titulo = global ? "Métricas del Core" : `Métricas: ${tablero.module}`;

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
                <strong className={salud.checks?.broker?.status === "up" ? "ok" : "ko"}>
                  {salud.checks?.broker?.status === "up" ? "conectado" : "caído"}
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

      {alertas.length > 0 && <Alertas alertas={alertas} />}
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
        <Kpi titulo="En dead letter" valor={deadLetters.open} detalle="Abiertos, esperando reproceso" urgente={deadLetters.open > 0} />
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
        <div className="fake-chart">
          <b>Suscripciones activas ({subscriptions.active})</b>
          {subscriptions.eventTypes.length ? (
            <ul className="plain-list">
              {subscriptions.eventTypes.map((tipo) => <li key={tipo}><span>{tipo}</span></li>)}
            </ul>
          ) : (
            <p className="empty-note">Sin suscripciones. Elegí tipos en Eventos Suscriptos.</p>
          )}
        </div>
        <div className="fake-chart">
          <b>Tipos declarados para publicar ({publications.declared.length})</b>
          {publications.declared.length ? (
            <ul className="plain-list">
              {publications.declared.map((tipo) => <li key={tipo}><span>{tipo}</span></li>)}
            </ul>
          ) : (
            <p className="empty-note">No declaró ninguno.</p>
          )}
        </div>
      </div>
    </>
  );
}

function VistaGlobal({ tablero }) {
  const { events, deliveries, deadLetters, modules } = tablero;
  return (
    <>
      <div className="kpi-grid">
        <Kpi titulo="Eventos en la ventana" valor={events.total} detalle={`${events.lastHour} en la última hora`} />
        <Kpi titulo="Por minuto" valor={events.perMinuteLastHour} detalle="Promedio de la última hora" />
        <Kpi titulo="Dead letters abiertos" valor={deadLetters.open} detalle="A reprocesar o descartar" urgente={deadLetters.open > 0} />
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
          <b>Entregas por estado</b>
          <ul className="plain-list">
            {Object.entries(deliveries.byStatus).map(([estado, total]) => (
              <li key={estado}><span>{estado}</span><strong>{total}</strong></li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="section-title">Módulos</h3>
      <table className="module-table">
        <thead>
          <tr>
            <th>Módulo</th><th>Equipo</th><th>Suscripciones</th>
            <th>Último login</th><th>Última publicación</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.name} className={m.active ? "" : "inactive"}>
              <td>
                <Link to={`/metrics?module=${encodeURIComponent(m.name)}`}>{m.displayName}</Link>
                <code>{m.name}</code>
              </td>
              <td>{m.team ?? "—"}</td>
              <td>{m.subscriptions}</td>
              <td>{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : "nunca"}</td>
              <td>{m.lastPublishAt ? new Date(m.lastPublishAt).toLocaleString() : "nunca"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * Las alertas de integracion, agrupadas por severidad.
 *
 * Son el calculo mas valioso del Core —los agujeros entre equipos que aparecen
 * solos cruzando quien publica que con quien consume que— pero hoy son 66. En
 * una lista plana no se leen. Las que piden accion van primero y abiertas; las
 * informativas arrancan plegadas.
 */
function Alertas({ alertas }) {
  const grupos = [
    { clave: "warning", titulo: "Requieren atención", abiertoPorDefecto: true },
    { clave: "info", titulo: "Informativas", abiertoPorDefecto: false },
  ]
    .map((g) => ({ ...g, items: alertas.filter((a) => a.severity === g.clave) }))
    .filter((g) => g.items.length);

  // Cualquier severidad que no sea warning/info igual tiene que verse.
  const otras = alertas.filter((a) => !["warning", "info"].includes(a.severity));
  if (otras.length) grupos.push({ clave: "info", titulo: "Otras", items: otras, abiertoPorDefecto: false });

  return (
    <section className="alerts-panel">
      <h3 className="section-title">Alertas de integración ({alertas.length})</h3>
      {grupos.map((grupo, i) => (
        <GrupoDeAlertas key={`${grupo.titulo}-${i}`} {...grupo} />
      ))}
    </section>
  );
}

function GrupoDeAlertas({ clave, titulo, items, abiertoPorDefecto }) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  return (
    <div className={`alertas-grupo ${clave}`}>
      <button
        type="button"
        className="alertas-cabecera"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="flecha" aria-hidden="true">›</span>
        {titulo}
        <span className="cuenta">{items.length}</span>
      </button>
      {abierto && (
        <ul className="alert-list">
          {items.map((alerta, i) => (
            <li className={`alert ${alerta.severity}`} key={`${alerta.kind}-${alerta.eventType}-${i}`}>
              <span className="alert-kind">{alerta.kind}</span>
              <code>{alerta.eventType}</code>
              <p>{alerta.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
