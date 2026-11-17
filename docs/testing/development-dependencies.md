# Tratamiento de dependencias de desarrollo

## Hallazgos y correccion candidata

La auditoria completa informaba 21 avisos moderados y tres bajos.
La auditoria de produccion informaba cero hallazgos.

Se probaron overrides exactos para glob 14.0.2 y minimatch 11.0.1.
La propuesta elimina los avisos moderados de la auditoria consultada.
La auditoria final informa cinco bajos propagados desde deepmerge
hacia dependencias de Jest; produccion sigue en cero.

Los conteos de npm audit incluyen paquetes afectados transitivamente:
no equivalen a cantidades de vulnerabilidades independientes.

Referencias:
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4

## Alcance y compatibilidad

Los overrides fuerzan versiones mayores de dependencias transitivas.
Esto requiere seguimiento cuando se actualicen las herramientas que
las consumen; no representa compatibilidad general garantizada.

En una copia temporal con Node 24 se verificaron:
- Instalacion npm ci.
- ESLint.
- Suite Jest.
- Build de produccion.
- Auditoria completa y de produccion.

Todas las comprobaciones de instalacion, lint, tests y build terminaron
con codigo cero. Se incorporan exactamente los manifiestos probados.

Los rangos de dependencias directas y scripts se conservaron.
Se revisaron 39 cambios de version, altas o bajas del lock, todos en
entradas marcadas como dependencias de desarrollo. No se detectaron
cambios de version en entradas de produccion.

## Alternativa descartada

npm audit fix sin force produjo 348 cambios de version, altas o bajas,
pero mantuvo los mismos 24 avisos. Esa propuesta no se incorporo.

No se aplicaron las degradaciones de Jest o Babel sugeridas por npm
audit ni exclusiones para silenciar los hallazgos.

## Pendientes y limites

deepmerge sigue teniendo un aviso bajo y su advisory no informa una
version corregida al momento de la revision. No se declara resuelto,
falso positivo ni riesgo aceptado automaticamente.

Queda pendiente verificar CI de este commit y mantener estos resultados
en la matriz de seguridad. Los avisos de desarrollo tambien requieren
seguimiento aunque la auditoria de produccion informe cero.

La evidencia de la propuesta esta en:
C:/core-zap-20261031/deploy/.testing/evidence/frontend-targeted-dev-fix-20261031-161227/

Los informes originales permanecen fuera de Git.
No se modifico AWS. El escaneo depende de las fuentes consultadas en
su fecha y no garantiza ausencia de vulnerabilidades desconocidas.
