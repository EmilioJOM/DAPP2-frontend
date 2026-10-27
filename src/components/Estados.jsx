/**
 * Los estados en los que una pantalla no tiene datos para mostrar.
 *
 * Antes cada pantalla resolvía el suyo y no todos salían bien: Métricas
 * reemplazaba la pantalla entera por un cartel rojo —se perdían el título, la
 * ventana elegida y la navegación— y Eventos Suscriptos decía "no hay módulos
 * para mostrar, elegí alguno en Suscripciones" cuando lo que había pasado era
 * que el Core no respondía. Son dos situaciones distintas y mandan a hacer
 * cosas distintas: una se arregla levantando el backend y la otra tildando algo.
 *
 * Son puramente visuales: no saben nada de la API.
 */

/**
 * No se pudo traer el dato.
 *
 * Siempre con el mensaje que mandó el Core —que ya viene escrito para leerse,
 * así que no hace falta parafrasearlo encima— y siempre con un reintento a
 * mano: el error más común en desarrollo es que el backend todavía no arrancó,
 * y para eso volver a pedir alcanza.
 */
export function ErrorDeCarga({
  titulo = "No se pudieron traer los datos",
  mensaje,
  pista,
  onReintentar,
}) {
  return (
    <div className="estado-vacio estado-vacio--error" role="alert">
      <span className="estado-vacio-icono" aria-hidden="true">
        !
      </span>
      <h2>{titulo}</h2>
      {mensaje && <p className="estado-vacio-detalle">{mensaje}</p>}
      {pista && <p className="estado-vacio-pista">{pista}</p>}
      {onReintentar && (
        <button className="primary estado-vacio-accion" type="button" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/**
 * Se cargó bien, pero no hay nada que mostrar.
 *
 * Un vacío sin explicación se lee como una pantalla rota. Este siempre dice por
 * qué está vacío y, cuando hay algo para hacer al respecto, lo ofrece.
 */
export function SinDatos({ titulo, children, accion }) {
  return (
    <div className="estado-vacio">
      <h2>{titulo}</h2>
      {children && <p>{children}</p>}
      {accion && <div className="estado-vacio-accion">{accion}</div>}
    </div>
  );
}
