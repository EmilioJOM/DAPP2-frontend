/**
 * Esqueletos de carga.
 *
 * Reservan el lugar exacto que van a ocupar los datos, asi la pantalla no salta
 * cuando llegan. Son puramente visuales: no saben nada de la API.
 */

/** Una tabla con su encabezado y `filas` renglones. */
export function EsqueletoTabla({ filas = 5, columnas = 6 }) {
  return (
    <section className="panel" aria-busy="true" aria-live="polite">
      <h3><span className="esqueleto esqueleto-linea" style={{ width: 120, display: "inline-block" }} /></h3>
      {Array.from({ length: filas }, (_, f) => (
        <div className="esqueleto-fila" key={f}>
          {Array.from({ length: columnas }, (_, c) => (
            <span
              className="esqueleto esqueleto-linea"
              key={c}
              // Anchos distintos por columna: un bloque parejo se lee como una
              // barra de progreso, no como una tabla.
              style={{ maxWidth: c === 0 ? 150 : 60 + ((f + c) % 4) * 22 }}
            />
          ))}
        </div>
      ))}
      <span className="visually-hidden">Cargando…</span>
    </section>
  );
}

/** La fila de indicadores del tablero. */
export function EsqueletoKpis({ cantidad = 4 }) {
  return (
    <div className="kpi-grid" aria-busy="true">
      {Array.from({ length: cantidad }, (_, i) => (
        <div className="esqueleto-kpi" key={i}>
          <span className="esqueleto esqueleto-linea" style={{ width: "55%" }} />
          <span className="esqueleto" style={{ width: "40%", height: 30 }} />
          <span className="esqueleto esqueleto-linea" style={{ width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

/** Una grilla de tarjetas. */
export function EsqueletoTarjetas({ cantidad = 6, alto = 150 }) {
  return (
    <div className="module-grid" aria-busy="true">
      {Array.from({ length: cantidad }, (_, i) => (
        <div className="esqueleto" key={i} style={{ height: alto }} />
      ))}
    </div>
  );
}
