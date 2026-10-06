import { useEffect, useState } from "react";
import { Link } from "react-router";
import JsonModal from "../components/JsonModal";
import { estadoDeEvento, listarEventos, obtenerEvento } from "../services/events";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";

const TAMANIO = 25;

function fecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Home() {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [json, setJson] = useState(null);

  // `clave` identifica la consulta pedida; `datos.clave`, la que ya respondio.
  // Mientras no coinciden la pantalla esta cargando, asi que no hace falta un
  // estado aparte que haya que acordarse de apagar en cada rama.
  const clave = `${pagina}|${busqueda}`;
  const [datos, setDatos] = useState(null);
  const cargando = datos?.clave !== clave;
  const error = datos?.error ?? "";
  const eventos = datos?.items ?? [];
  const total = datos?.total ?? 0;
  const paginas = datos?.paginas ?? 0;

  useEffect(() => {
    let vigente = true;
    listarEventos({ page: pagina, size: TAMANIO, query: busqueda || undefined })
      .then((data) => {
        if (!vigente) return;
        setDatos({
          clave,
          items: data.items ?? [],
          total: data.total ?? 0,
          paginas: data.pages ?? 0,
        });
      })
      .catch((e) => {
        if (!vigente) return;
        setDatos({ clave, items: [], error: mensajeDeError(e, "No se pudo cargar el historial.") });
      });
    return () => { vigente = false; };
  }, [clave, pagina, busqueda]);

  const buscar = (e) => {
    e.preventDefault();
    setPagina(1);
    setBusqueda(filtro.trim());
  };

  const verJson = async (evento) => {
    // El listado viene liviano a proposito; el sobre completo se pide al abrir.
    try {
      setJson(await obtenerEvento(evento.eventId));
    } catch {
      setJson(evento);
    }
  };

  return (
    <div className="screen history">
      <div className="crumb">Observatory / Historial de eventos</div>
      <header className="page-head">
        <div>
          <h1>Historial de eventos</h1>
          <p>
            {session.esAdmin()
              ? "Todo el tráfico del hub."
              : `Lo que publicó y lo que recibió ${session.getModulo()}.`}
          </p>
        </div>
        <form className="history-search" onSubmit={buscar}>
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por tipo o módulo..."
            aria-label="Buscar eventos"
          />
          <button type="submit">Buscar</button>
        </form>
      </header>

      {error && <div className="notice error" role="alert">{error}</div>}

      {cargando && <div className="notice">Cargando eventos...</div>}

      {!cargando && !error && eventos.length === 0 && (
        <div className="empty-selection">
          <h2>Todavía no hay eventos</h2>
          <p>
            Cuando tu módulo publique o reciba su primer evento, va a aparecer acá.
            Revisá en <Link to="/suscripciones">Suscripciones</Link> que estés
            escuchando los tipos que te interesan.
          </p>
        </div>
      )}

      {!cargando && eventos.length > 0 && (
        <section className="panel">
          <h3>EVENTOS <code>{total} en total</code></h3>
          <table>
            <thead>
              <tr>
                <th>Tipo de evento</th>
                <th>Módulo origen</th>
                <th>Ocurrió</th>
                <th>Recibido</th>
                <th>Estado</th>
                <th>Entregas</th>
                <th>Json</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => {
                const estado = estadoDeEvento[evento.status] ?? { texto: evento.status, tono: "muted" };
                return (
                  <tr key={evento.id}>
                    <td>{evento.eventType}</td>
                    <td>{evento.sourceModule}</td>
                    <td>{fecha(evento.occurredAt)}</td>
                    <td>{fecha(evento.receivedAt)}</td>
                    <td className={`estado estado--${estado.tono}`}>● {estado.texto}</td>
                    <td>
                      {evento.deliveredCount}/{evento.deliveryCount}
                      {evento.rejectionCode && <small> · {evento.rejectionCode}</small>}
                    </td>
                    <td>
                      <button className="json-btn" onClick={() => verJson(evento)}>
                        {"{}"} JSON
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="pager">
            <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
            <span>Página {pagina} de {paginas || 1}</span>
            <button disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
          </div>
        </section>
      )}

      {json && <JsonModal data={json} onClose={() => setJson(null)} />}
    </div>
  );
}
