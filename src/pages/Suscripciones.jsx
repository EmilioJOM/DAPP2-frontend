import { useEffect, useState } from "react";
import { Link } from "react-router";
import { catalogoPorModulo } from "../services/catalog";
import { listarSuscripciones } from "../services/subscriptions";
import { guardarModulosVisibles, modulosVisibles } from "../services/subscriptionPreferences";
import { EsqueletoTarjetas } from "../components/Esqueleto";
import { ErrorDeCarga } from "../components/Estados";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";

/**
 * Elegir que modulos mirar. Es una preferencia local: no cambia a que esta
 * suscripto el modulo, solo filtra lo que se muestra en la pantalla siguiente.
 * Las suscripciones de verdad se eligen en Eventos Suscriptos.
 *
 * Que dos pantallas se llamen parecido y tengan las dos un boton "Aplicar" es
 * la confusion mas cara del panel, asi que acá se dice en todos lados —titulo,
 * bajada y pie— que esto no toca el Core.
 */
export default function Suscripciones() {
  // Lo que esta guardado en localStorage, contra lo que se compara para saber
  // si quedo algo sin aplicar.
  const [guardados, setGuardados] = useState(() => modulosVisibles());
  const [elegidos, setElegidos] = useState(guardados);
  const [guardado, setGuardado] = useState(false);

  // Mismo patron que el resto: `clave` es lo pedido y `datos.clave` lo que ya
  // respondio. "Reintentar" incrementa el intento y vuelve a disparar.
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState(null);
  const cargando = datos?.intento !== intento;
  const error = datos?.error ?? "";
  const modulos = datos?.modulos ?? [];
  const suscriptos = datos?.suscriptos ?? new Set();

  useEffect(() => {
    let vigente = true;
    Promise.all([catalogoPorModulo(), listarSuscripciones()])
      .then(([catalogo, subs]) => {
        if (!vigente) return;
        setDatos({
          intento,
          modulos: catalogo,
          suscriptos: new Set(subs.filter((s) => s.active).map((s) => s.eventType)),
        });
      })
      .catch((e) => {
        if (!vigente) return;
        setDatos({ intento, error: mensajeDeError(e, "No se pudo cargar el catálogo.") });
      });
    return () => { vigente = false; };
  }, [intento]);

  const alternar = (id) => {
    setGuardado(false);
    setElegidos((actual) =>
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id],
    );
  };

  const aplicar = () => {
    const limpio = guardarModulosVisibles(elegidos);
    setElegidos(limpio);
    setGuardados(limpio);
    setGuardado(true);
  };

  const encabezado = (
    <>
      <div className="crumb">Observatory / Suscripciones / Selección de módulos</div>
      <header className="page-head">
        <div>
          <h1>Suscripciones</h1>
        </div>
      </header>
    </>
  );

  if (cargando) {
    return (
      <div className="screen subscriptions">
        {encabezado}
        <EsqueletoTarjetas cantidad={9} alto={120} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen subscriptions">
        {encabezado}
        <ErrorDeCarga
          titulo="No se pudo cargar la lista de módulos"
          mensaje={error}
          onReintentar={() => setIntento((i) => i + 1)}
        />
      </div>
    );
  }

  // Marcar ninguno equivale a mirar todos, asi que el contador tiene que decir
  // eso y no "9 de 9", que suena a que estan los nueve tildados.
  const mirandoTodos = elegidos.length === 0;
  const sinGuardar =
    elegidos.length !== guardados.length || elegidos.some((id) => !guardados.includes(id));

  return (
    <div className="screen subscriptions">
      <div className="crumb">Observatory / Suscripciones / Selección de módulos</div>
      <header className="page-head">
        <div>
          <h1>Suscripciones</h1>
          <p>
            Elegí qué módulos querés mirar. Es una preferencia tuya y solo filtra
            lo que ves: <strong>no da ni quita suscripciones</strong>. Eso se hace
            en <Link to="/eventos-suscriptos">Eventos Suscriptos</Link>.
          </p>
        </div>
        <span className="badge">
          {mirandoTodos
            ? `Mirando los ${modulos.length} módulos`
            : `Mirando ${elegidos.length} de ${modulos.length} módulos`}
        </span>
      </header>

      <div className="subscription-selector-grid">
        {modulos.map((modulo) => {
          const activos = modulo.events.filter((e) => suscriptos.has(e.name)).length;
          const marcado = elegidos.includes(modulo.id);
          return (
            <article className={`module-choice ${marcado ? "selected" : ""}`} key={modulo.id}>
              <label className="module-choice-main">
                <input type="checkbox" checked={marcado} onChange={() => alternar(modulo.id)} />
                <span>
                  <strong>{modulo.displayName ?? modulo.name}</strong>
                  <code>{modulo.name}</code>
                  <small>
                    {modulo.events.length} tipos de evento
                    {activos > 0
                      ? ` · estás suscripto a ${activos}`
                      : " · no estás suscripto a ninguno"}
                  </small>
                </span>
              </label>
              {session.esAdmin() && (
                <Link className="module-metrics-link" to={`/metrics?module=${encodeURIComponent(modulo.name)}`}>
                  Ver métricas →
                </Link>
              )}
            </article>
          );
        })}
      </div>

      <div className="selection-actions">
        <span className="selection-summary">
          {/* Sin esto, tildar algo y navegar a otra pantalla perdia la seleccion
              en silencio: el boton no decia que faltaba tocarlo. */}
          {sinGuardar
            ? "Tenés cambios sin aplicar."
            : "Sin ninguno marcado se muestran todos."}
        </span>
        <button className="primary" type="button" onClick={aplicar} disabled={!sinGuardar}>
          Aplicar
        </button>
      </div>
      {guardado && !sinGuardar && (
        <p className="selection-status success" role="status">
          Listo. Seguí en <Link to="/eventos-suscriptos">Eventos Suscriptos</Link> para
          elegir a qué eventos suscribirte.
        </p>
      )}
    </div>
  );
}
