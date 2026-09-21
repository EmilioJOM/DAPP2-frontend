import { useState } from "react";
import { Routes, Route, NavLink } from "react-router";
import "./App.css";
import Home from "./pages/Home";
import EventosSuscriptos from "./pages/EventosSuscriptos";
import Metricas from "./pages/Metricas";
import Suscripciones from "./pages/Suscripciones";
import Login from "./pages/Login";
import UserProfile from "./components/UserProfile";
import { session } from "./services/session";

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState({ usuario: "", email: "" });

  if (!authenticated) return <Login onLogin={({ user, accessToken }) => {
    session.setToken(accessToken);
    setCurrentUser(user);
    setAuthenticated(true);
  }} />;
  return (
    <>
      <nav className="top-nav" aria-label="Navegación principal">
        <div className="top-nav__brand">⌘ <strong>Core Observatory</strong></div>
        <div className="top-nav__links">
          <NavLink to="/" end>1. Historial de eventos</NavLink>
          <NavLink to="/eventos-suscriptos">2. Eventos Suscriptos</NavLink>
          <NavLink to="/metrics">3. Métricas</NavLink>
          <NavLink to="/suscripciones">4. Suscripciones</NavLink>
        </div>
        <div className="top-nav__tools">
          <span className="nav-search">⌕ Buscar evento o Trace ID...</span>
          <span>⚙</span>
          <button className="nav-user-button" type="button" onClick={()=>setProfileOpen(true)} aria-label="Ver datos del usuario">♙</button>
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
      {profileOpen && <UserProfile
        user={currentUser}
        onClose={()=>setProfileOpen(false)}
        onUserChange={setCurrentUser}
        onLogout={()=>{session.clear();setAuthenticated(false);setProfileOpen(false);}}
      />}
    </>
  );
}
export default App;
