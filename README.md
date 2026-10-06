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

## Cómo está armado

```
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
