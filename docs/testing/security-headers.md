# CSP y proteccion de enmarcado: correccion candidata

Se agrega Content-Security-Policy y X-Frame-Options: DENY en Nginx.
Se conservan X-Content-Type-Options y Referrer-Policy.

La CSP permite scripts y conexiones al mismo origen, hojas de Google Fonts,
fuentes de fonts.gstatic.com e imagenes del mismo origen o data.
Bloquea objetos y enmarcado y restringe base-uri y form-action.
Permite estilos inline por compatibilidad con la interfaz; no permite
scripts inline ni eval. Esta excepcion limita la politica y queda declarada.

Validacion local:
- Build Vite e imagen Docker aprobados.
- Nginx valida la configuracion.
- Cinco E2E con Chromium aprobadas, sin violaciones CSP registradas
  durante los escenarios ensayados.
- Los headers tambien se observaron detras de un proxy HTTPS local.

Los informes originales se conservan en el entorno local de testing
del backend. Consultar docs/testing/security-headers.md de la rama
devops/security-headers-20261031 en fpedaccio/core_desappsii.

Pendientes: CI sobre esta revision e integracion de los PR.
No se desplego en AWS. Estos resultados no prueban toda la interfaz
ni equivalen a una aprobacion global de seguridad.
