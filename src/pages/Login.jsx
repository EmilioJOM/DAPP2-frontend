import { useState } from "react";
import { authService } from "../services/auth";
import { mensajeDeError } from "../services/api";

/**
 * El Core no es un sistema de registro abierto: las cuentas las crea cada
 * equipo desde el panel. Por eso aca solo hay inicio de sesion — las pantallas
 * de registro y de recuperar contrasena se sacaron porque sugerian que
 * cualquiera podia crearse una cuenta, y no es el modelo.
 */
export default function Login({ onLogin, aviso = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const loading = status.type === "loading";

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setStatus({ type: "error", message: "Completá tu correo y tu contraseña." });
      return;
    }
    setStatus({ type: "loading", message: "Ingresando..." });
    try {
      const sesion = await authService.login({ email: email.trim(), password });
      setStatus({ type: "success", message: "Acceso correcto." });
      onLogin(sesion);
    } catch (error) {
      setStatus({ type: "error", message: mensajeDeError(error, "No se pudo iniciar sesión.") });
    }
  };

  return (
    <div className="login-screen">
      <div className="login-preview-nav">
        <span>1. Historial de eventos</span>
        <span>2. Eventos Suscriptos</span>
        <span>3. Métricas</span>
        <span>4. Suscripciones</span>
        <span>●</span>
      </div>
      <div className="login-overlay">
        <form className="login-card auth-card-wide" onSubmit={submit}>
          <div className="login-avatar"><i /><b /></div>
          <h2>Iniciar sesión</h2>
          {aviso && !status.message && (
            <p className="auth-status error" role="status">{aviso}</p>
          )}
          {status.message && (
            <p className={`auth-status ${status.type}`} role="status">{status.message}</p>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            autoComplete="username"
            aria-label="Correo electrónico"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            aria-label="Contraseña"
          />
          <button className="login-submit" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
          <p className="auth-help">
            Las cuentas las crea tu equipo desde el panel. Si no tenés uno,
            pedíselo a alguien de tu módulo.
          </p>
        </form>
      </div>
    </div>
  );
}
