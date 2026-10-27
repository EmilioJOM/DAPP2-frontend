import { useEffect, useState } from "react";
import { Link } from "react-router";
import { catalogoPorModulo } from "../services/catalog";
import { listarSuscripciones, sincronizar } from "../services/subscriptions";
import { modulosVisibles } from "../services/subscriptionPreferences";
import { EsqueletoTarjetas } from "../components/Esqueleto";
import { ErrorDeCarga, SinDatos } from "../components/Estados";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";

/**
 * Elegir a que tipos de evento suscribirse.
 *
 * Cada tilde es una suscripcion real: al aplicar, el Core da de alta o de baja
 * las que correspondan y declara la cola y el binding en RabbitMQ en el acto.
 * Por eso la pantalla muestra siempre, antes de tocar el boton, exactamente que
 * va a pasar: cuantas se crean y cuantas se dan de baja.
 */
export default function EventosSuscriptos() {
  const [elegidos, setElegidos] = useState(new Set());
  const [guardando, setGuardando] = useState(false);
  // El resultado de aplicar, aparte del error de carga: si el Core rechaza el
  // guardado no se puede borrar la pantalla, porque se perderia lo tildado.
  const [resultado, setResultado] = useState({ tipo: "", texto: "" });
  const [filtro, setFiltro] = useState("");

  // Se incrementa despues de aplicar para volver a leer el estado real del Core
  // en vez de confiar en lo que el usuario tildo. Tambien lo usa "Reintentar".
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState(null);
  const cargando = datos?.version !== version;
  const error = datos?.error ?? "";
  const modulos = datos?.modulos ?? [];
  // Lo que el Core tiene hoy, para poder decir que cambia respecto de eso.
  const enElCore = datos?.suscriptas ?? new Set();

  useEffect(() => {
    let vigente = true;
    const visibles = modulosVisibles();

    Promise.all([catalogoPorModulo(), listarSuscripciones()])
      .then(([catalogo, subs]) => {
        if (!vigente) return;
        // Las suscripciones vigentes son las del Core, no las que quedaron
        // tildadas en la pantalla.
        const activas = new Set(subs.filter((s) => s.active).map((s) => s.eventType));
        setDatos({
          version,
          suscriptas: activas,
          modulos: visibles.length ? catalogo.filter((m) => visibles.includes(m.id)) : catalogo,
        });
        setElegidos(activas);
      })
      .catch((e) => {
        if (!vigente) return;
        setDatos({ version, error: mensajeDeError(e, "No se pudo cargar el catálogo.") });
      });

    return () => { vigente = false; };
  }, [version]);

  const alternar = (tipo) => {
    setResultado({ tipo: "", texto: "" });
    setElegidos((actual) => {
      const siguiente = new Set(actual);
      siguiente.has(tipo) ? siguiente.delete(tipo) : siguiente.add(tipo);
      return siguiente;
    });
  };

  const aplicar = async () => {
    setGuardando(true);
    try {
      const { agregadas, quitadas } = await sincronizar([...elegidos]);
      const partes = [];
      if (agregadas) partes.push(`${agregadas} ${agregadas === 1 ? "suscripción nueva" : "suscripciones nuevas"}`);
      if (quitadas) partes.push(`${quitadas} ${quitadas === 1 ? "dada de baja" : "dadas de baja"}`);
      setResultado({
        tipo: "success",
        texto: partes.length ? `Listo: ${partes.join(" y ")}.` : "No había cambios para aplicar.",
      });
      setVersion((v) => v + 1);
    } catch (e) {
      // Un fallo al guardar se muestra al lado del botón y deja la selección
      // donde está. Mandarlo al error de pantalla completa haría perder todo lo
      // que la persona venía tildando, que es justo lo que no hay que hacer.
      setResultado({
        tipo: "error",
        texto: mensajeDeError(e, "No se pudieron guardar las suscripciones."),
      });
    } finally {
      setGuardando(false);
    }
  };

  const encabezado = (
    <div className="crumb">Observatory / Eventos Suscriptos</div>
  );

  if (cargando) {
    return (
      <div className="screen subscribed">
        {encabezado}
        <header className="page-head"><div><h1>Eventos Suscriptos</h1></div></header>
        <EsqueletoTarjetas cantidad={6} alto={240} />
      </div>
    );
  }

  // El error va antes que el vacio. Al reves, un Core apagado se mostraba como
  // "no hay modulos para mostrar, elegi alguno en Suscripciones", que manda a
  // hacer algo que no arregla nada.
  if (error) {
    return (
      <div className="screen subscribed">
        {encabezado}
        <header className="page-head"><div><h1>Eventos Suscriptos</h1></div></header>
        <ErrorDeCarga
          titulo="No se pudo cargar el catálogo de eventos"
          mensaje={error}
          onReintentar={() => setVersion((v) => v + 1)}
        />
      </div>
    );
  }

  if (!modulos.length) {
    return (
      <div className="screen subscribed">
        {encabezado}
        <SinDatos
          titulo="No hay módulos para mostrar"
          accion={<Link className="boton-enlace primary" to="/suscripciones">Ir a Suscripciones</Link>}
        >
          En Suscripciones elegiste mirar módulos que hoy no tienen ningún tipo de
          evento publicado. Sacá la selección para ver todo el catálogo.
        </SinDatos>
      </div>
    );
  }

  const buscado = filtro.trim().toLowerCase();
  const visibles = buscado
    ? modulos
        .map((m) => ({ ...m, events: m.events.filter((t) => (t.name ?? "").toLowerCase().includes(buscado)) }))
        .filter((m) => m.events.length)
    : modulos;

  const aAgregar = [...elegidos].filter((t) => !enElCore.has(t));
  const aQuitar = [...enElCore].filter((t) => !elegidos.has(t));
  const hayCambios = aAgregar.length > 0 || aQuitar.length > 0;
  const tiposEnTotal = modulos.reduce((n, m) => n + m.events.length, 0);

  return (
    <div className="screen subscribed">
      {encabezado}
      <header className="page-head subscribed-head">
        <div>
          <h1>Eventos Suscriptos</h1>
          <p>
            Lo que tildes acá es a lo que se suscribe <strong>{session.getModulo()}</strong>.
            Los eventos van a llegar a la cola <code>q.{session.getModulo()}</code>.
          </p>
        </div>
        <span className="badge">
          {elegidos.size} de {tiposEnTotal} tipos
        </span>
      </header>

      <div className="catalogo-controles">
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar un tipo de evento..."
          aria-label="Buscar un tipo de evento"
        />
        {buscado && (
          <span className="catalogo-coincidencias" role="status">
            {visibles.reduce((n, m) => n + m.events.length, 0)} de {tiposEnTotal} coinciden
          </span>
        )}
      </div>

      {visibles.length === 0 ? (
        <SinDatos
          titulo={`Ningún tipo contiene «${filtro.trim()}»`}
          accion={<button type="button" onClick={() => setFiltro("")}>Ver todo el catálogo</button>}
        >
          Los nombres del hub están en inglés camelCase, como <code>ticketCreated</code>.
        </SinDatos>
      ) : (
        <div className="module-grid">
          {visibles.map((modulo) => {
            const tildados = modulo.events.filter((t) => elegidos.has(t.name)).length;
            return (
              <section className="module-card" key={modulo.id}>
                <h3>
                  {modulo.displayName ?? modulo.name}
                  {/* Cuantos de este modulo estan tildados: en una grilla de
                      nueve tarjetas, saberlo sin contar a ojo. */}
                  <span className={`module-card-cuenta ${tildados ? "activa" : ""}`}>
                    {tildados}/{modulo.events.length}
                  </span>
                </h3>
                <div className="module-card-code">{modulo.name}</div>
                {modulo.events.map((tipo) => (
                  <label key={tipo.id ?? tipo.name} title={tipo.description || undefined}>
                    <input
                      type="checkbox"
                      checked={elegidos.has(tipo.name)}
                      onChange={() => alternar(tipo.name)}
                    />
                    <span>
                      {tipo.name}
                      {tipo.discovered && <small title="Apareció por el hub sin que nadie lo declarara"> · sin declarar</small>}
                    </span>
                  </label>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/* La barra queda a la vista mientras se recorre la grilla: el boton
          estaba al final de nueve tarjetas y habia que ir a buscarlo. Y dice
          que va a pasar antes de tocarlo, porque cada tilde toca RabbitMQ. */}
      <div className="barra-aplicar">
        <span className="barra-aplicar-resumen">
          {hayCambios ? (
            <>
              {aAgregar.length > 0 && (
                <strong className="cambio-alta">+{aAgregar.length} para suscribir</strong>
              )}
              {aAgregar.length > 0 && aQuitar.length > 0 && " · "}
              {aQuitar.length > 0 && (
                <strong className="cambio-baja">−{aQuitar.length} para dar de baja</strong>
              )}
            </>
          ) : (
            "Sin cambios: lo tildado es lo que el Core ya tiene."
          )}
        </span>
        <button
          className="primary"
          type="button"
          onClick={aplicar}
          disabled={guardando || !hayCambios}
        >
          {guardando ? "Guardando..." : "Aplicar"}
        </button>
      </div>
      {resultado.texto && (
        <p
          className={`selection-status ${resultado.tipo}`}
          role={resultado.tipo === "error" ? "alert" : "status"}
        >
          {resultado.texto}
        </p>
      )}
    </div>
  );
}
