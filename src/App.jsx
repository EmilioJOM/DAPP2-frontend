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
    <>
      <nav className="top-nav" aria-label="Navegación principal">
        <div className="top-nav__brand"><span className="brand-mark" /><strong>Core Observatory</strong></div>
        <div className="top-nav__links">
          <NavLink to="/" end>1. Historial de eventos</NavLink>
          <NavLink to="/eventos-suscriptos">2. Eventos Suscriptos</NavLink>
          <NavLink to="/metrics">3. Métricas</NavLink>
          <NavLink to="/suscripciones">4. Suscripciones</NavLink>
        </div>
        <div className="top-nav__tools">
          <span className="nav-module" title={`Módulo ${sesion.displayName}`}>
            {sesion.displayName}
            {sesion.isAdmin && <small className="nav-admin"> admin</small>}
          </span>
          <button
            className="nav-user-button"
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Ver datos del usuario"
            title={sesion.actor}
          >
            {inicial(sesion.actor)}
          </button>
        </div>
      </nav>
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
    </>
  );
}

export default App;
