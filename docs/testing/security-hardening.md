# Refuerzo de seguridad del frontend

## Cambios

- Fuentes Inter y JetBrains Mono servidas desde el propio frontend mediante
  paquetes Fontsource fijados en 5.3.0 y registrados en package-lock.json.
- Licencias incluidas en public/licenses/fonts.
- Eliminados los enlaces de Google Fonts y sus permisos en la CSP.
- style-src y font-src restringidos a self, sin unsafe-inline.
- Vite configurado con assetsInlineLimit: 0 para emitir las fuentes como
  archivos, evitando fuentes data: bloqueadas por la CSP.
- Cross-Origin-Resource-Policy: same-origin.
- Permissions-Policy deshabilita camara, microfono y geolocalizacion.
- server_tokens off oculta la version de Nginx; el producto sigue
  identificado como nginx.

## Verificacion local

- ESLint aprobado y 12 pruebas Jest aprobadas.
- Build de produccion y validacion nginx -t aprobados.
- Cabeceras comprobadas en la raiz y en una respuesta API 401.
- Seis pruebas de navegador exitosas: los cinco escenarios E2E existentes
  y una comprobacion adicional de metricas, fuentes y estilos dinamicos.
- Seis observaciones CSP sin violaciones.
- Inter y JetBrains Mono cargadas; ninguna solicitud a recursos externos
  observada en la comprobacion de metricas.
- Barra de volumen con altura positiva. Esto no sustituye una revision
  visual completa de todos los componentes y resoluciones.

El primer candidato bloqueo fuentes incrustadas como data:. Se corrigio
la configuracion de Vite manteniendo la CSP restrictiva.
Tambien se corrigio un selector de prueba afectado por la codificacion
del comando en PowerShell.

La segunda ejecucion paso los seis tests, pero el runner devolvio codigo
1 porque conservaba el requisito de exactamente cinco pruebas. Se
verificaron JUnit, observaciones CSP y resultados de fuentes; se guardo
una evaluacion complementaria y una copia corregida del runner.
Los resultados originales no fueron modificados.

## Reescaneo ZAP baseline

El baseline del candidato genero informe con codigo 2 (advertencias).
Ya no aparecen los dos hallazgos medios previos: style-src unsafe-inline
y falta de SRI en el stylesheet externo de Google Fonts.
El recurso externo fue sustituido por recursos locales; no se agrego
SRI a ese enlace.

Tampoco aparecen los avisos anteriores de CORP, version del servidor y
Permissions Policy.

Persisten:
- COEP ausente: bajo.
- COOP ausente: bajo.
- Comentarios sospechosos: informativo.
- Aplicacion web moderna: informativo.
- Contenido cacheable: informativo.

Los avisos restantes requieren tratamiento en la matriz de seguridad;
no se declaran automaticamente falsos positivos ni riesgos aceptados.
El baseline no equivale a un escaneo activo autenticado completo.

## Dependencias

La auditoria de produccion informo cero hallazgos.
La auditoria completa informo 21 moderados y tres bajos, asociados en
el informe a herramientas de desarrollo y sus dependencias, incluyendo
ESLint, Jest, glob, minimatch y deepmerge.

No se aplicaron degradaciones mayores de Jest/Babel ni exclusiones para
eliminar avisos. Queda pendiente evaluar las correcciones compatibles
y documentar el tratamiento de estos hallazgos.
El resultado refleja las fuentes consultadas al ejecutar la auditoria.

## Evidencia local

Conservada fuera de Git en el repositorio local de testing:

- frontend-hardening-20261031-155036
- frontend-hardening-runtime-20261031-155246
- hardening-browser-20261031-155540-281b6e
- hardening-browser-retest-20261031-155748-5a1c6b
- hardening-final-check-20261031-155919-e0e1db

Todas bajo deploy/.testing/evidence de C:/core-zap-20261031.
El candidato se probo en localhost:18086 sobre el backend local ZAP.
No se desplego en AWS. Estos resultados no cierran por si solos G1-G9.
