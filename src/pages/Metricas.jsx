import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  alertasDeIntegracion,
  estadoDelCore,
  tableroDe,
  tableroDelModulo,
  tableroGlobal,
} from "../services/metrics";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";

const VENTANAS = [
  { horas: 1, etiqueta: "1 h" },
  { horas: 24, etiqueta: "24 h" },
  { horas: 168, etiqueta: "7 días" },
];

function Kpi({ titulo, valor, detalle }) {
  return (
    <article className="kpi">
      <b>{titulo}</b>
      <strong className="kpi-value">{valor}</strong>
      {detalle && <p>{detalle}</p>}
    </article>
  );
}

/** Barras del volumen por hora. Sin libreria: son 24 barras. */
function VolumenPorHora({ puntos }) {
  if (!puntos?.length) {
    return <p className="empty-note">Sin eventos en la ventana elegida.</p>;
  }
  const maximo = Math.max(...puntos.map((p) => p.total), 1);
  return (
    <div className="volume-chart">
      {puntos.map((punto) => {
        const hora = new Date(punto.hour);
        return (
          <div
            className="volume-bar"
            key={punto.hour}
            title={`${hora.toLocaleString()} · ${punto.total} eventos${
              punto.rejected ? ` · ${punto.rejected} rechazados` : ""
            }`}
          >
            <span
              className="volume-bar-fill"
              style={{ height: `${Math.round((punto.total / maximo) * 100)}%` }}
            />
            {punto.rejected > 0 && (
              <span
                className="volume-bar-rejected"
                style={{ height: `${Math.round((punto.rejected / maximo) * 100)}%` }}
              />
            )}
            <small>{String(hora.getHours()).padStart(2, "0")}</small>
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

  if (cargando) return <div className="screen metrics"><div className="notice">Cargando métricas...</div></div>;
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

      {alertas.length > 0 && (
        <section className="alerts-panel">
          <h3 className="section-title">Alertas de integración ({alertas.length})</h3>
          <ul className="alert-list">
            {alertas.map((alerta, i) => (
              <li className={`alert ${alerta.severity}`} key={`${alerta.kind}-${alerta.eventType}-${i}`}>
                <span className="alert-kind">{alerta.kind}</span>
                <code>{alerta.eventType}</code>
                <p>{alerta.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
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
        <Kpi titulo="En dead letter" valor={deadLetters.open} detalle="Abiertos, esperando reproceso" />
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
        <Kpi titulo="Dead letters abiertos" valor={deadLetters.open} detalle="A reprocesar o descartar" />
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
