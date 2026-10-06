import { useEffect, useState } from "react";
import { Link } from "react-router";
import { catalogoPorModulo } from "../services/catalog";
import { listarSuscripciones } from "../services/subscriptions";
import { guardarModulosVisibles, modulosVisibles } from "../services/subscriptionPreferences";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";

/**
 * Elegir que modulos mirar. Es una preferencia local: no cambia a que esta
 * suscripto el modulo, solo filtra lo que se muestra en la pantalla siguiente.
 * Las suscripciones de verdad se eligen en Eventos Suscriptos.
 */
export default function Suscripciones() {
  const [modulos, setModulos] = useState([]);
  const [suscriptos, setSuscriptos] = useState(new Set());
  const [elegidos, setElegidos] = useState(modulosVisibles());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [catalogo, subs] = await Promise.all([
          catalogoPorModulo(),
          listarSuscripciones(),
        ]);
        setModulos(catalogo);
        setSuscriptos(new Set(subs.filter((s) => s.active).map((s) => s.eventType)));
      } catch (e) {
        setError(mensajeDeError(e, "No se pudo cargar el catálogo."));
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const alternar = (id) => {
    setGuardado(false);
    setElegidos((actual) =>
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id],
    );
  };

  const aplicar = () => {
    setElegidos(guardarModulosVisibles(elegidos));
    setGuardado(true);
  };

  if (cargando) return <div className="screen subscriptions"><div className="notice">Cargando catálogo...</div></div>;
  if (error) return <div className="screen subscriptions"><div className="notice error" role="alert">{error}</div></div>;

  return (
    <div className="screen subscriptions">
      <div className="crumb">Observatory / Suscripciones / Selección de módulos</div>
      <header className="page-head">
        <div>
          <h1>Suscripciones</h1>
          <p>
            Elegí qué módulos querés mirar. En <Link to="/eventos-suscriptos">Eventos
            Suscriptos</Link> seleccionás a qué eventos suscribirte de verdad.
          </p>
        </div>
        <span className="badge">
          {elegidos.length || modulos.length} de {modulos.length} módulos
        </span>
      </header>

      <div className="subscription-selector-grid">
        {modulos.map((modulo) => {
          const activos = modulo.events.filter((e) => suscriptos.has(e.name)).length;
          const marcado = elegidos.length === 0 || elegidos.includes(modulo.id);
          return (
            <article className={`module-choice ${marcado ? "selected" : ""}`} key={modulo.id}>
              <label className="module-choice-main">
                <input
                  type="checkbox"
                  checked={elegidos.includes(modulo.id)}
                  onChange={() => alternar(modulo.id)}
                />
                <span>
                  <strong>{modulo.displayName ?? modulo.name}</strong>
                  <code>{modulo.name}</code>
                  <small>
                    {modulo.events.length} tipos de evento
                    {activos > 0 && ` · ${activos} suscripto${activos > 1 ? "s" : ""}`}
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
          Sin ninguno marcado se muestran todos. Esto no da ni quita suscripciones.
        </span>
        <button className="primary" type="button" onClick={aplicar}>Aplicar</button>
      </div>
      {guardado && (
        <p className="selection-status success" role="status">
          Listo. Seguí en Eventos Suscriptos para elegir los eventos.
        </p>
      )}
    </div>
  );
}
