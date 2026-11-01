/**
 * Tasa de errores de la ventana (HU-08): eventos rechazados sobre el total de
 * eventos de la ventana, con los mismos datos del grafico de volumen por hora.
 *
 * Devuelve `porcentaje: null` cuando no hubo eventos: 0 % y "sin datos" no son
 * lo mismo, y mostrar 0 % sin trafico sugiere que todo anda bien.
 */
export function tasaDeErrores(volumenPorHora = []) {
  const total = volumenPorHora.reduce((n, p) => n + (Number(p.total) || 0), 0);
  const rechazados = volumenPorHora.reduce((n, p) => n + (Number(p.rejected) || 0), 0);
  if (total === 0) return { total, rechazados, porcentaje: null, texto: "—" };
  const porcentaje = (rechazados / total) * 100;
  // Un decimal alcanza para comparar; 0,04 % no se redondea a "0 %" para no
  // esconder que hubo errores.
  const texto =
    rechazados > 0 && porcentaje < 0.1 ? "< 0,1 %" : `${porcentaje.toFixed(1).replace(".", ",")} %`;
  return { total, rechazados, porcentaje, texto };
}
