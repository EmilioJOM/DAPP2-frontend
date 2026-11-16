# Revisión de dependencias del frontend — 29/10/2026

## Base y alcance

Base: 27df1e4636ba1b7df60f23ca14f6b967487c021c.
Rama: devops/security-dependencies-20261029.
Candidata local separada, sin modificar AWS ni la copia del bootstrap.

El primer análisis utilizó Node 22. La corrección y su validación
utilizaron Node 24.22.2 y npm 11.19.1, siguiendo la versión mayor
del Dockerfile del frontend.

## Hallazgos y cambios

Auditoría inicial del lock:
- Árbol completo: 12 paquetes señalados; 7 altos y 5 bajos.
- Excluyendo desarrollo: axios y follow-redirects, ambos altos.

Los conteos de paquetes afectados no representan necesariamente
vulnerabilidades independientes.

Se actualizaron los rangos mínimos de axios y vite y se resolvieron
actualizaciones compatibles de dependencias seleccionadas.

Versiones resultantes comprobadas:
- axios: 1.21.0.
- vite: 8.3.5.
- follow-redirects: 1.16.2.
- zod: 4.6.7.
- Jest conservado: 30.4.2.

No se utilizó --force ni se aceptó el downgrade propuesto de Jest.

Auditoría posterior:
- Árbol completo: 0 altos, 0 críticos y 5 paquetes señalados como bajos.
- Excluyendo desarrollo: 0 hallazgos.
- Los cinco paquetes restantes pertenecen a la cadena deepmerge/Jest.
  El aviso GHSA-gcqx-w48m-w2h4 no informa una versión corregida.
  El hallazgo sigue abierto para evaluación y justificación;
  no se agregó una exclusión ni se declaró resuelto.

## Validación de la candidata

Con instalación limpia en un contenedor temporal:
- npm ci: salida 0.
- Tests: 2 suites, 12 casos aprobados, 0 fallidos y 0 pendientes.
- ESLint: salida 0.
- Build de Vite: salida 0.
- Lock sin modificaciones durante la validación.

Cobertura informada por Jest:
- Líneas: 72,53 %.
- Ramas: 60,96 %.
- Statements: 67,48 %.
- Funciones: 59,01 %.

Estos porcentajes corresponden al alcance medido por Jest.
No demuestran cobertura de todo el frontend ni cumplimiento del
umbral de negocio del TP; su alcance y las brechas deben revisarse.

## Advertencias conservadas

npm ci emitió advertencias por peers de plugins Babel 7 frente a
@babel/core 8. Las versiones implicadas ya figuraban en el lock original.
También informó paquetes deprecados y un postinstall de unrs-resolver
no cubierto por allowScripts.

Instalación, tests, lint y build terminaron correctamente pese a ellas.
Las advertencias no se ocultaron ni se resolvieron en este cambio.
No se aprobaron scripts adicionales automáticamente.

## Evidencia privada

En el repositorio backend de testing, fuera de Git:
- deploy/.testing/evidence/frontend-audit-20261029-161612/
- deploy/.testing/evidence/frontend-fix-20261029-162149/
- deploy/.testing/evidence/frontend-tests-20261029-162322/

El primer intento de auditoría no generó informes porque al guion
le faltaba enviar stdin al contenedor. Se corrigió y se conservó
la ejecución posterior verificable.

Esta validación no sustituye las pruebas E2E, la revisión de aplicabilidad
de cada aviso ni el análisis de paquetes del sistema de las imágenes.
