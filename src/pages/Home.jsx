import { useEffect, useState } from "react";
import { Link } from "react-router";
import JsonModal from "../components/JsonModal";
import { EsqueletoTabla } from "../components/Esqueleto";
import { ErrorDeCarga, SinDatos } from "../components/Estados";
import { estadoDeEvento, listarEventos, obtenerEvento } from "../services/events";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";
import { demora, esFecha, fechaExacta, haceCuanto } from "../utils/tiempo";
import { SIN_FILTROS, describirFiltros, hayFiltros, limiteDelDia, validarFiltros } from "../utils/filtros";

const TAMANIO = 25;

export default function Home() {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  // Lo que se esta escribiendo y lo que ya se aplico van separados: la tabla
  // cambia al tocar "Aplicar", no con cada tecla.
  const [borrador, setBorrador] = useState(SIN_FILTROS);
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [problema, setProblema] = useState("");
  const [json, setJson] = useState(null);
  // Se incrementa al tocar "Reintentar" y vuelve a disparar el pedido.
  const [intento, setIntento] = useState(0);

  // `clave` identifica la consulta pedida; `datos.clave`, la que ya respondio.
  // Mientras no coinciden la pantalla esta cargando, asi que no hace falta un
  // estado aparte que haya que acordarse de apagar en cada rama.
  const clave = `${pagina}|${busqueda}|${JSON.stringify(filtros)}|${intento}`;
  const [datos, setDatos] = useState(null);
  const cargando = datos?.clave !== clave;
  const error = datos?.error ?? "";
  const eventos = datos?.items ?? [];
  const total = datos?.total ?? 0;
  const paginas = datos?.paginas ?? 0;
  const filtrando = Boolean(busqueda) || hayFiltros(filtros);

  useEffect(() => {
    let vigente = true;
    // Un eventId es unico: se pide ese evento y no hace falta paginar.
    const pedido = filtros.eventId
      ? obtenerEvento(filtros.eventId).then(
          (evento) => ({ items: [evento], total: 1, pages: 1 }),
          (e) => {
            if (e?.response?.status === 404) return { items: [], total: 0, pages: 0 };
            throw e;
          },
        )
      : listarEventos({
          page: pagina,
          size: TAMANIO,
          query: busqueda || undefined,
          status: filtros.estado || undefined,
          since: limiteDelDia(filtros.desde),
          until: limiteDelDia(filtros.hasta, true),
        });
    pedido
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
  }, [clave, pagina, busqueda, filtros, intento]);

  const buscar = (e) => {
    e.preventDefault();
    setPagina(1);
    setBusqueda(filtro.trim());
  };

  const aplicarFiltros = (e) => {
    e.preventDefault();
    const limpio = { ...borrador, eventId: borrador.eventId.trim() };
    const motivo = validarFiltros(limpio);
    setProblema(motivo);
    if (motivo) return;
    setPagina(1);
    setFiltros(limpio);
  };

  const limpiarBusqueda = () => {
    setFiltro("");
    setBusqueda("");
    setBorrador(SIN_FILTROS);
    setFiltros(SIN_FILTROS);
    setProblema("");
    setPagina(1);
  };

  const cambiar = (campo) => (e) => setBorrador((b) => ({ ...b, [campo]: e.target.value }));

  const verJson = async (evento) => {
    // El listado viene liviano a proposito; el sobre completo se pide al abrir.
    try {
      setJson(await obtenerEvento(evento.eventId));
    } catch {
      setJson(evento);
    }
  };

  const desde = (pagina - 1) * TAMANIO + 1;
  const hasta = Math.min(pagina * TAMANIO, total);

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
        <form className="history-search" onSubmit={buscar} role="search">
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por tipo o módulo..."
            aria-label="Buscar eventos"
          />
          <button type="submit">Buscar</button>
        </form>
      </header>

      <form className="history-filters" onSubmit={aplicarFiltros} aria-label="Filtros del historial">
        <label>
          <span>Identificador (eventId)</span>
          <input
            value={borrador.eventId}
            onChange={cambiar("eventId")}
            placeholder="UUID del evento"
            spellCheck={false}
          />
        </label>
        <label>
          <span>Desde</span>
          <input type="date" value={borrador.desde} onChange={cambiar("desde")} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={borrador.hasta} onChange={cambiar("hasta")} />
        </label>
        <label>
          <span>Estado</span>
          <select value={borrador.estado} onChange={cambiar("estado")}>
            <option value="">Todos</option>
            {Object.entries(estadoDeEvento).map(([valor, { texto }]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Aplicar filtros</button>
      </form>
      {problema && (
        <p className="auth-status error" role="alert">
          {problema}
        </p>
      )}

      {/* Un filtro activo tiene que verse: si no, una tabla filtrada y una
          tabla vacia se parecen demasiado y uno cree que no hay eventos. */}
      {filtrando && (
        <p className="busqueda-activa">
          Filtrando por <strong>{describirFiltros(busqueda, filtros)}</strong>
          <button type="button" className="chip-quitar" onClick={limpiarBusqueda}>
            Quitar filtros
          </button>
        </p>
      )}

      {cargando && <EsqueletoTabla filas={8} columnas={7} />}

      {!cargando && error && (
        <ErrorDeCarga
          titulo="No se pudo cargar el historial"
          mensaje={error}
          onReintentar={() => setIntento((i) => i + 1)}
        />
      )}

      {/* Dos vacios distintos. Antes los dos decian "todavia no hay eventos",
          asi que una busqueda sin resultados se leia como un hub sin trafico. */}
      {!cargando && !error && eventos.length === 0 && filtrando && (
        <SinDatos
          titulo={`Ningún evento coincide con ${describirFiltros(busqueda, filtros)}`}
          accion={
            <button type="button" onClick={limpiarBusqueda}>
              Ver todos los eventos
            </button>
          }
        >
          La búsqueda de texto mira el tipo de evento y el módulo de origen: probá
          con una parte del nombre, como <code>ticketCreated</code>. Las fechas se
          comparan con el momento en que el evento llegó al hub.
        </SinDatos>
      )}

      {!cargando && !error && eventos.length === 0 && !filtrando && (
        <SinDatos titulo="Todavía no hay eventos">
          Cuando tu módulo publique o reciba su primer evento, va a aparecer acá.
          Revisá en <Link to="/suscripciones">Suscripciones</Link> que estés
          escuchando los tipos que te interesan.
        </SinDatos>
      )}

      {!cargando && eventos.length > 0 && (
        <section className="panel">
          <h3>
            Eventos <code>{total} en total</code>
          </h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Tipo de evento</th>
                <th scope="col">Módulo origen</th>
                <th scope="col">Ocurrió</th>
                <th scope="col">Demora al hub</th>
                <th scope="col">Estado</th>
                <th scope="col">Entregas</th>
                <th scope="col">Json</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <FilaDeEvento key={evento.id} evento={evento} onVerJson={verJson} />
              ))}
            </tbody>
          </table>
          <div className="pager">
            <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
            {/* "Pagina 2 de 4" no dice cuantos eventos hay delante ni detras. */}
            <span>
              {desde}–{hasta} de {total} · página {pagina} de {paginas || 1}
            </span>
            <button disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
          </div>
        </section>
      )}

      {json && <JsonModal data={json} onClose={() => setJson(null)} />}
    </div>
  );
}

function FilaDeEvento({ evento, onVerJson }) {
  const estado = estadoDeEvento[evento.status] ?? { texto: evento.status, tono: "muted" };
  const tardanza = demora(evento.occurredAt, evento.receivedAt);

  const entregadas = Number(evento.deliveredCount ?? 0);
  const esperadas = Number(evento.deliveryCount ?? 0);
  // Un "1/3" en gris no dice si esta bien. Completo es neutro; incompleto avisa.
  const tonoEntrega = esperadas === 0 ? "muted" : entregadas < esperadas ? "warn" : "ok";

  return (
    <tr>
      <td>{evento.eventType}</td>
      <td>{evento.sourceModule}</td>
      <td>
        {esFecha(evento.occurredAt) ? (
          <time dateTime={evento.occurredAt} title={fechaExacta(evento.occurredAt)}>
            {haceCuanto(evento.occurredAt)}
          </time>
        ) : (
          <span className="dato-ausente">—</span>
        )}
      </td>
      <td title={esFecha(evento.receivedAt) ? `Recibido ${fechaExacta(evento.receivedAt)}` : undefined}>
        {tardanza ?? <span className="dato-ausente">—</span>}
      </td>
      <td className="estado-celda">
        <span className={`estado estado--${estado.tono}`}>{estado.texto}</span>
        {evento.rejectionCode && <small className="estado-motivo">{evento.rejectionCode}</small>}
      </td>
      <td className={`entregas entregas--${tonoEntrega}`}>
        {esperadas === 0 ? (
          // La columna Estado ya dice "Sin suscriptores" al lado: repetirlo acá
          // es la misma frase dos veces en la misma fila.
          <span className="dato-ausente" title="Ningún módulo estaba suscripto a este tipo">
            —
          </span>
        ) : (
          <span title={`${entregadas} de ${esperadas} suscripciones recibieron este evento`}>
            {entregadas}/{esperadas}
          </span>
        )}
      </td>
      <td>
        <button className="json-btn" onClick={() => onVerJson(evento)}>
          {"{}"} JSON
        </button>
      </td>
    </tr>
  );
}
