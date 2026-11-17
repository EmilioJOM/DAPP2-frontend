import { useEffect, useState } from "react";
import { EsqueletoTabla } from "../components/Esqueleto";
import { ErrorDeCarga, SinDatos } from "../components/Estados";
import { mensajeDeError } from "../services/api";
import {
  esReintentable,
  estadoDeDeadLetter,
  listarDeadLetters,
  motivoDeDeadLetter,
  obtenerDeadLetter,
  reintentar,
} from "../services/events";
import { session } from "../services/session";
import { esFecha, fechaExacta, haceCuanto } from "../utils/tiempo";

const TAMANIO = 25;

const FILTROS = [
  { valor: "OPEN", etiqueta: "Abiertas" },
  { valor: "RETRIED", etiqueta: "Reintentadas" },
  { valor: "DISCARDED", etiqueta: "Descartadas" },
  { valor: "", etiqueta: "Todas" },
];

const MODO = { AUTOMATIC: "Automático", MANUAL: "Manual" };

function Cuando({ iso }) {
  if (!esFecha(iso)) return <span className="dato-ausente">—</span>;
  return (
    <time dateTime={iso} title={fechaExacta(iso)}>
      {haceCuanto(iso)}
    </time>
  );
}

function Estado({ valor }) {
  const estado = estadoDeDeadLetter[valor] ?? { texto: valor, tono: "muted" };
  return <span className={`estado estado--${estado.tono}`}>{estado.texto}</span>;
}

/**
 * Cola de fallas (HU-07).
 *
 * El representante ve las dead letters de su modulo —el Core ya filtra por
 * origen o destino—, entiende por que fallaron y pide el reintento. El Core
 * audita quien lo pidio; aca solo se muestra el resultado.
 */
export default function Dlq() {
  const [estado, setEstado] = useState("OPEN");
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const clave = `${estado}|${pagina}|${intento}`;
  const [datos, setDatos] = useState(null);
  const cargando = datos?.clave !== clave;
  const error = datos?.error ?? "";
  const items = datos?.items ?? [];
  const total = datos?.total ?? 0;
  const paginas = datos?.paginas ?? 0;

  const [detalle, setDetalle] = useState(null);
  // Un solo reintento a la vez: el boton queda deshabilitado mientras tanto, asi
  // un doble clic no dispara dos pedidos.
  const [enCurso, setEnCurso] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let vigente = true;
    listarDeadLetters({ page: pagina, size: TAMANIO, status: estado })
      .then((data) => {
        if (!vigente) return;
        setDatos({ clave, items: data.items ?? [], total: data.total ?? 0, paginas: data.pages ?? 0 });
      })
      .catch((e) => {
        if (!vigente) return;
        setDatos({ clave, items: [], error: mensajeDeError(e, "No se pudo cargar la cola de fallas.") });
      });
    return () => {
      vigente = false;
    };
  }, [clave, estado, pagina, intento]);

  const elegirEstado = (valor) => {
    setEstado(valor);
    setPagina(1);
  };

  const verDetalle = async (id) => {
    setDetalle({ id, cargando: true });
    try {
      setDetalle({ id, data: await obtenerDeadLetter(id) });
    } catch (e) {
      setDetalle({ id, error: mensajeDeError(e, "No se pudo cargar el detalle.") });
    }
  };

  const pedirReintento = async (deadLetter) => {
    if (enCurso) return;
    setEnCurso(deadLetter.id);
    setResultado(null);
    try {
      const r = await reintentar(deadLetter.id);
      setResultado({
        tipo: r.success ? "success" : "error",
        mensaje: r.success
          ? `Reintento ${r.attemptNumber} de ${deadLetter.eventType}: ${r.message}`
          : `El reintento de ${deadLetter.eventType} volvió a fallar: ${r.message}`,
      });
    } catch (e) {
      setResultado({ tipo: "error", mensaje: mensajeDeError(e, "No se pudo pedir el reintento.") });
    } finally {
      setEnCurso(null);
      setIntento((i) => i + 1);
      if (detalle?.id === deadLetter.id) verDetalle(deadLetter.id);
    }
  };

  const desde = (pagina - 1) * TAMANIO + 1;
  const hasta = Math.min(pagina * TAMANIO, total);

  return (
    <div className="screen dlq">
      <div className="crumb">Observatory / Cola de fallas</div>
      <header className="page-head">
        <div>
          <h1>Cola de fallas (DLQ)</h1>
          <p>
            {session.esAdmin()
              ? "Los eventos que fallaron definitivamente en todo el hub."
              : `Los eventos que fallaron definitivamente y que involucran a ${session.getModulo()}.`}
          </p>
        </div>
        <div className="window-picker" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.etiqueta}
              type="button"
              className={estado === f.valor ? "selected" : ""}
              aria-pressed={estado === f.valor}
              onClick={() => elegirEstado(f.valor)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </header>

      {resultado && (
        <p className={`selection-status ${resultado.tipo}`} role="status">
          {resultado.mensaje}
        </p>
      )}

      {cargando && <EsqueletoTabla filas={6} columnas={7} />}

      {!cargando && error && (
        <ErrorDeCarga
          titulo="No se pudo cargar la cola de fallas"
          mensaje={error}
          onReintentar={() => setIntento((i) => i + 1)}
        />
      )}

      {!cargando && !error && items.length === 0 && (
        <SinDatos titulo={estado === "OPEN" ? "No hay eventos fallidos pendientes" : "No hay eventos en este estado"}>
          Cuando un evento de tu módulo no pueda procesarse o entregarse después de
          todos sus intentos, va a aparecer acá con el motivo.
        </SinDatos>
      )}

      {!cargando && items.length > 0 && (
        <section className="panel">
          <h3>
            Eventos fallidos <code>{total} en total</code>
          </h3>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tipo de evento</th>
                  <th scope="col">Origen → destino</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Intentos</th>
                  <th scope="col">Falló</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((dl) => (
                  <tr key={dl.id}>
                    <td>{dl.eventType ?? <span className="dato-ausente">—</span>}</td>
                    <td>
                      {dl.sourceModule ?? "—"} → {dl.targetModule ?? <span className="dato-ausente">sin destino</span>}
                    </td>
                    <td title={dl.reason}>
                      <code>{dl.reasonCode}</code>
                    </td>
                    <td>{dl.attempts}</td>
                    <td>
                      <Cuando iso={dl.createdAt} />
                    </td>
                    <td>
                      <Estado valor={dl.status} />
                    </td>
                    <td className="acciones-dlq">
                      <button type="button" onClick={() => verDetalle(dl.id)} aria-label={`Ver detalle de ${dl.eventType ?? "la falla"}`}>
                        Ver detalle
                      </button>
                      {esReintentable(dl) && (
                        <button
                          type="button"
                          className="primary"
                          disabled={enCurso !== null}
                          onClick={() => pedirReintento(dl)}
                          aria-label={`Reintentar ${dl.eventType ?? "evento"}`}
                        >
                          {enCurso === dl.id ? "Reintentando..." : "Reintentar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
            <span>
              {desde}–{hasta} de {total} · página {pagina} de {paginas || 1}
            </span>
            <button disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
          </div>
        </section>
      )}

      {detalle && (
        <DetalleDeFalla
          detalle={detalle}
          enCurso={enCurso}
          onReintentar={pedirReintento}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  );
}

function DetalleDeFalla({ detalle, enCurso, onReintentar, onCerrar }) {
  const dl = detalle.data;
  return (
    <section className="panel dlq-detalle" aria-labelledby="dlq-detalle-titulo">
      <div className="dlq-detalle-cabecera">
        <h2 id="dlq-detalle-titulo">Detalle de la falla{dl?.eventType ? `: ${dl.eventType}` : ""}</h2>
        <button type="button" onClick={onCerrar}>
          Cerrar detalle
        </button>
      </div>

      {detalle.cargando && <p role="status">Cargando detalle...</p>}
      {detalle.error && <p className="auth-status error" role="alert">{detalle.error}</p>}

      {dl && (
        <>
          <dl className="profile-facts">
            <div>
              <dt>Motivo</dt>
              <dd>
                <code>{dl.reasonCode}</code> — {motivoDeDeadLetter[dl.reasonCode] ?? "Motivo sin descripción."}
              </dd>
            </div>
            <div>
              <dt>Error</dt>
              <dd>{dl.reason}</dd>
            </div>
            <div>
              <dt>eventId</dt>
              <dd>
                <code>{dl.eventId ?? "—"}</code>
              </dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <Estado valor={dl.status} />
                {dl.resolvedBy && ` por ${dl.resolvedBy}`}
              </dd>
            </div>
          </dl>

          {dl.details?.length > 0 && (
            <>
              <h3>Detalle del error</h3>
              <pre className="dlq-json">{JSON.stringify(dl.details, null, 2)}</pre>
            </>
          )}

          <h3>Datos enviados</h3>
          <pre className="dlq-json">
            {dl.rawPayload ? JSON.stringify(dl.rawPayload, null, 2) : dl.rawBody ?? "Sin datos."}
          </pre>

          <h3>Historial de reintentos</h3>
          {dl.retries?.length ? (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Quién</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Cuándo</th>
                    <th scope="col">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {dl.retries.map((r) => (
                    <tr key={r.id}>
                      <td>{r.attemptNumber}</td>
                      <td>{MODO[r.mode] ?? r.mode}</td>
                      <td>{r.actor}</td>
                      <td>
                        <span className={`estado estado--${r.result === "SUCCESS" ? "ok" : "error"}`}>
                          {r.result === "SUCCESS" ? "Éxito" : "Falló"}
                        </span>
                      </td>
                      <td>
                        <Cuando iso={r.createdAt} />
                      </td>
                      <td>{r.error ?? <span className="dato-ausente">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-note">Todavía no hubo reintentos.</p>
          )}

          {esReintentable(dl) && (
            <button
              type="button"
              className="primary"
              disabled={enCurso !== null}
              onClick={() => onReintentar(dl)}
            >
              {enCurso === dl.id ? "Reintentando..." : "Reintentar este evento"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
