# Core Observatory — dashboard

Frontend del **módulo Core** (módulo 9) del TPO de Desarrollo de Aplicaciones II.
El Core es el pasamanos de eventos de la plataforma municipal: recibe lo que
publican los 9 módulos, valida que el sobre esté bien formado, guarda evidencia y
se lo entrega a quien esté suscripto.

Este dashboard es la ventana a eso. Cada integrante entra con su cuenta y ve
**solo el tráfico de su módulo**; el equipo 9 ve el hub completo.

---

## Arrancar

```bash
npm install && npm run dev
```

Necesita el backend corriendo en paralelo:

```bash
cd ../backend && .venv/bin/uvicorn app.main:app --reload
```

La URL de la API sale de `VITE_API_URL`. Copiá `.env.example` a `.env` si
apuntás a otro lado; el default alcanza para desarrollo local.

```
VITE_API_URL=http://localhost:8000/api/v1
```

El backend ya trae `http://localhost:5173` en su `CORS_ORIGINS`, así que no hay
nada que tocar del lado del Core.

---

## Entrar

Las cuentas **las crea cada equipo** desde el panel (`POST /users`): no hay
registro abierto ni recuperación por correo, y por eso esas pantallas no están.
Cada módulo arranca con `<modulo>@muni.uade.edu.ar` / `Cambiala123`.

La sesión vive en `sessionStorage`: refrescar la página no desloguea, cerrar la
pestaña sí. Si el Core responde `401`, el interceptor de axios limpia la sesión y
emite `core:sesion-expirada`, que `App.jsx` escucha para volver al login sin
dejar datos viejos en pantalla.

---

## Las cuatro pantallas

| Pantalla | Qué muestra | De dónde sale |
|---|---|---|
| **Historial de eventos** | Cada evento con su estado, cuántas entregas tuvo y el sobre completo | `GET /events`, `GET /events/{eventId}` |
| **Eventos Suscriptos** | Los tipos del catálogo; cada tilde es una suscripción real | `GET /event-types`, `POST`/`DELETE /subscriptions` |
| **Métricas** | Volumen, latencia, dead letters y las alertas de integración | `GET /dashboard`, `/dashboard/global` |
| **Suscripciones** | Qué módulos mirar (preferencia local, no cambia nada en el Core) | `GET /modules` |

### Suscribirse hace algo

Antes la selección se guardaba en `localStorage` y no tenía efecto: el módulo no
recibía nada. Ahora cada tilde crea o borra una suscripción en el Core, que
declara la cola `q.<modulo>` y su binding en RabbitMQ en el acto.

Las dos pantallas de suscripción hacen cosas distintas a propósito:
**Suscripciones** solo filtra qué módulos ver (eso sí queda en `localStorage`,
porque es una preferencia de quien mira), y **Eventos Suscriptos** es la que
cambia el estado del Core.

### El catálogo ya no está escrito a mano

La lista de eventos salía de un array en el código, con los nombres en castellano
del enunciado (`CiudadanoRegistrado`, `ReclamoCreado`). Los equipos después
acordaron inglés camelCase (`citizenRegistered`, `ticketCreated`), así que la
lista mostraba eventos que no existen. Ahora sale de `GET /event-types`.

---

## Cómo se ve

Esto es un panel para mirar un flujo de eventos durante un rato largo, no una
landing. De ahí sale todo lo visual: tinta azul marino (`#0d1b2a`) en vez de
negro, papel con un grado de azul en vez de blanco clínico, líneas de pelo en
vez de sombras, y **un solo acento** —un celeste— reservado para lo que está
vivo: lo activo, lo que fluye, lo accionable. La jerarquía la hacen el espacio y
el peso de la tipografía, no las cajas.

Los estados van desaturados a propósito: en una tabla de 25 filas el rojo
saturado grita y deja de significar algo.

Los identificadores técnicos —tipos de evento, nombres de cola, módulos— van
siempre en mono. Es lo que uno copia y pega en una consola.

**Contraste.** Cada par de texto sobre fondo está verificado contra WCAG AA
(4.5:1). El celeste brillante nunca lleva texto encima —es para rellenos, barras
y estados activos—; cuando hace falta azul legible se usa `--azul`, que da 6.9:1
sobre blanco.

Las variables están todas en `src/index.css`; `src/App.css` solo arma las
pantallas con ellas. Para cambiar la paleta entera se tocan diez líneas.

### Detalles que hacen al uso

- **Esqueletos de carga** en vez de un cartel de "Cargando...": reservan el lugar
  exacto que van a ocupar los datos, así la pantalla no salta al llegar.
- **Las alertas de integración se agrupan por severidad.** Son el cálculo más
  valioso del Core, pero son 66: en una lista plana no se leen. Las que piden
  acción van primero y abiertas; las informativas arrancan plegadas.
- **Los dead letters se pintan de rojo cuando hay alguno.** Es el único número
  del tablero sobre el que se puede actuar; en cero es un dato más.
- **El gráfico de volumen** etiqueta una hora de cada tres y anota el pico. Con
  las 24 puestas el eje se vuelve ruido y se deja de ver la forma.

## Cómo está armado

```
src/index.css   tokens: color, tipografía, radios, base del documento
src/App.css     las pantallas, armadas sobre esos tokens
src/services/   una capa por recurso del Core: api, auth, session,
                catalog, subscriptions, events, metrics
src/pages/      las cuatro pantallas
src/components/ JsonModal y UserProfile
```

Ninguna pantalla llama a `axios` ni arma una URL: todo pasa por `src/services`.
`api.js` es el único que sabe la base URL, pone el `Authorization` y traduce los
errores del Core a un mensaje legible con `mensajeDeError`.

**Qué le pide al backend y qué filtra el backend.** El Core ya limita lo que
devuelve al módulo autenticado, así que el front no filtra por módulo: un equipo
ve lo que publicó más lo que le entregaron, y nada del tráfico ajeno. Lo único
que el front decide por rol es si pide `/dashboard` o `/dashboard/global`.

---

## Verificar

```bash
npm run lint && npm test && npm run build
```

Los tests simulan los servicios: prueban la pantalla, no el backend. Para
verificar que los nombres de campo coincidan con lo que el Core devuelve de
verdad está `backend/` con su propia suite.
