import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router";
import "./App.css";
import Home from "./pages/Home";
import EventosSuscriptos from "./pages/EventosSuscriptos";
import Metricas from "./pages/Metricas";
import Suscripciones from "./pages/Suscripciones";
import Login from "./pages/Login";
import UserProfile from "./components/UserProfile";
import { session } from "./services/session";

/** La primera letra de quien entro, para el boton del perfil. */
function inicial(actor = "") {
  return actor.trim().charAt(0).toUpperCase() || "·";
}

/* Iconos de la navegacion. Line-icons simples que heredan el color del enlace
   (stroke: currentColor), asi se tiñen igual que el texto en activo y hover. */
const ICONOS = {
  historial: <path d="M3 3v18h18M7 14l3-3 3 3 5-6" />,
  eventos: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="7" cy="6" r="1.4" />
      <circle cx="7" cy="12" r="1.4" />
      <circle cx="7" cy="18" r="1.4" />
    </>
  ),
  metricas: (
    <>
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="7" width="4" height="13" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </>
  ),
  suscripciones: (
    <>
      <path d="M3 7h11M3 12h11M3 17h7" />
      <path d="M16 15l2 2 4-4" />
    </>
  ),
};

function IconoSvg({ nombre }) {
  return (
    <svg
      className="nav-icono"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONOS[nombre]}
    </svg>
  );
}

function App() {
  // La sesion vive en sessionStorage, asi que refrescar la pagina no desloguea.
  const [sesion, setSesion] = useState(() => session.get());
  const [profileOpen, setProfileOpen] = useState(false);
  const [aviso, setAviso] = useState("");

  // El interceptor de axios avisa cuando el Core devolvio 401: el token vencio
  // o lo revocaron. Desde aca se vuelve al login sin que la pantalla quede
  // mostrando datos viejos.
  useEffect(() => {
    const alExpirar = () => {
      setSesion(null);
      setProfileOpen(false);
      setAviso("Tu sesión expiró. Volvé a entrar.");
    };
    window.addEventListener("core:sesion-expirada", alExpirar);
    return () => window.removeEventListener("core:sesion-expirada", alExpirar);
  }, []);

  const salir = () => {
    session.clear();
    setSesion(null);
    setProfileOpen(false);
    setAviso("");
  };

  if (!sesion) {
    return (
      <Login
        aviso={aviso}
        onLogin={(datos) => {
          setAviso("");
          setSesion(datos);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="sidebar__brand">
          <span className="brand-mark" />
          <strong>Core Observatory</strong>
        </div>

        <nav className="sidebar__nav">
          <NavLink to="/" end>
            <IconoSvg nombre="historial" />
            <span>Historial de eventos</span>
          </NavLink>
          <NavLink to="/eventos-suscriptos">
            <IconoSvg nombre="eventos" />
            <span>Eventos Suscriptos</span>
          </NavLink>
          <NavLink to="/metrics">
            <IconoSvg nombre="metricas" />
            <span>Métricas</span>
          </NavLink>
          <NavLink to="/suscripciones">
            <IconoSvg nombre="suscripciones" />
            <span>Suscripciones</span>
          </NavLink>
        </nav>

        <button
          className="sidebar__user"
          type="button"
          onClick={() => setProfileOpen(true)}
          aria-label="Ver datos del usuario"
          title={sesion.actor}
        >
          <span className="sidebar__avatar">{inicial(sesion.actor)}</span>
          <span className="sidebar__user-info">
            <span className="sidebar__user-name">{sesion.displayName}</span>
            <span className="sidebar__user-rol">{sesion.isAdmin ? "Administrador" : "Módulo"}</span>
          </span>
        </button>
      </aside>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/eventos-suscriptos" element={<EventosSuscriptos />} />
          <Route path="/metrics" element={<Metricas />} />
          <Route path="/suscripciones" element={<Suscripciones />} />
        </Routes>
      </main>
      {profileOpen && (
        <UserProfile sesion={sesion} onClose={() => setProfileOpen(false)} onLogout={salir} />
      )}
    </div>
  );
}

export default App;
