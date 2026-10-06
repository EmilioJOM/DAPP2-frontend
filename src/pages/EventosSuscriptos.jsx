import { useEffect, useState } from "react";
import { Link } from "react-router";
import { catalogoPorModulo } from "../services/catalog";
import { listarSuscripciones, sincronizar } from "../services/subscriptions";
import { modulosVisibles } from "../services/subscriptionPreferences";
import { EsqueletoTarjetas } from "../components/Esqueleto";
import { mensajeDeError } from "../services/api";
import { session } from "../services/session";

/**
 * Elegir a que tipos de evento suscribirse.
 *
 * Cada tilde es una suscripcion real: al aplicar, el Core da de alta o de baja
 * las que correspondan y declara la cola y el binding en RabbitMQ en el acto.
 */
export default function EventosSuscriptos() {
  const [elegidos, setElegidos] = useState(new Set());
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  // Se incrementa despues de aplicar para volver a leer el estado real del Core
  // en vez de confiar en lo que el usuario tildo.
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState(null);
  const cargando = datos?.version !== version;
  const error = datos?.error ?? "";
  const modulos = datos?.modulos ?? [];

  useEffect(() => {
    let vigente = true;
    const visibles = modulosVisibles();

    Promise.all([catalogoPorModulo(), listarSuscripciones()])
      .then(([catalogo, subs]) => {
        if (!vigente) return;
        setDatos({
          version,
          modulos: visibles.length ? catalogo.filter((m) => visibles.includes(m.id)) : catalogo,
        });
        // Las suscripciones vigentes son las del Core, no las que quedaron
        // tildadas en la pantalla.
        setElegidos(new Set(subs.filter((s) => s.active).map((s) => s.eventType)));
      })
      .catch((e) => {
        if (!vigente) return;
        setDatos({ version, error: mensajeDeError(e, "No se pudo cargar el catálogo.") });
      });

    return () => { vigente = false; };
  }, [version]);

  const alternar = (tipo) => {
    setAviso("");
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
      setAviso(
        agregadas || quitadas
          ? `Listo: ${agregadas} suscripción(es) nueva(s) y ${quitadas} dada(s) de baja.`
          : "No había cambios para aplicar.",
      );
      setVersion((v) => v + 1);
    } catch (e) {
      setAviso("");
      setDatos((d) => ({
        ...d,
        error: mensajeDeError(e, "No se pudieron guardar las suscripciones."),
      }));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="screen subscribed">
        <div className="crumb">Observatory / Eventos Suscriptos</div>
        <header className="page-head"><div><h1>Eventos Suscriptos</h1></div></header>
        <EsqueletoTarjetas cantidad={6} alto={240} />
      </div>
    );
  }

  if (!modulos.length) {
    return (
      <div className="screen subscribed">
        <div className="crumb">Observatory / Eventos Suscriptos</div>
        <div className="empty-selection">
          <h2>No hay módulos para mostrar</h2>
          <p>Elegí al menos uno en Suscripciones.</p>
          <Link className="primary empty-selection-link" to="/suscripciones">Ir a Suscripciones</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen subscribed">
      <div className="crumb">Observatory / Eventos Suscriptos</div>
      <header className="page-head subscribed-head">
        <div>
          <h1>Eventos Suscriptos</h1>
          <p>
            Lo que tildes acá es a lo que se suscribe <strong>{session.getModulo()}</strong>.
            Los eventos van a llegar a la cola <code>q.{session.getModulo()}</code>.
          </p>
        </div>
        <span className="badge">{elegidos.size} suscripciones</span>
      </header>

      {error && <div className="notice error" role="alert">{error}</div>}

      <div className="module-grid">
        {modulos.map((modulo) => (
          <section className="module-card" key={modulo.id}>
            <h3>{modulo.displayName ?? modulo.name}</h3>
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
        ))}
      </div>

      <button className="primary apply" type="button" onClick={aplicar} disabled={guardando}>
        {guardando ? "Guardando..." : "Aplicar"}
      </button>
      {aviso && <p className="selection-status success" role="status">{aviso}</p>}
    </div>
  );
}
