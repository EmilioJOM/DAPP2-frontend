import { useEffect, useState } from "react";
import { authService } from "../services/auth";
import { mensajeDeError } from "../services/api";

/**
 * Datos de la persona logueada.
 *
 * El Core guarda el email, el nombre y el modulo, y eso lo administra el equipo
 * con `POST /users`: desde aca lo unico que se puede cambiar es la propia
 * contrasena. No hay avatar ni edicion de perfil porque el Core no los tiene.
 */
export default function UserProfile({ sesion, onClose, onLogout }) {
  const [cuenta, setCuenta] = useState(null);
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const loading = status.type === "loading";

  useEffect(() => {
    authService.miCuenta().then(setCuenta).catch(() => setCuenta(null));
  }, []);

  const cambiar = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setStatus({ type: "error", message: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (password !== repetida) {
      setStatus({ type: "error", message: "Las dos contraseñas no coinciden." });
      return;
    }
    if (!cuenta) {
      setStatus({ type: "error", message: "No se pudo identificar tu cuenta en el Core." });
      return;
    }
    setStatus({ type: "loading", message: "Actualizando contraseña..." });
    try {
      await authService.cambiarPassword(cuenta.id, password);
      setPassword("");
      setRepetida("");
      setStatus({ type: "success", message: "Contraseña actualizada." });
    } catch (error) {
      setStatus({
        type: "error",
        message: mensajeDeError(error, "No se pudo cambiar la contraseña."),
      });
    }
  };

  return (
    <div className="user-dialog-backdrop" onMouseDown={onClose}>
      <section
        className="profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="user-dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        <header className="profile-head">
          <div className="profile-avatar"><span>♙</span></div>
          <div>
            <h2 id="profile-title">{cuenta?.fullName ?? sesion.actor}</h2>
            <p>{cuenta?.email ?? sesion.actor}</p>
          </div>
        </header>

        <dl className="profile-facts">
          <div><dt>Módulo</dt><dd>{sesion.displayName} <code>{sesion.module}</code></dd></div>
          <div><dt>Cola de entrega</dt><dd><code>q.{sesion.module}</code></dd></div>
          <div>
            <dt>Alcance</dt>
            <dd>{sesion.isAdmin ? "Administrador: ve el tráfico de todos los módulos" : "Ve solo el tráfico de su módulo"}</dd>
          </div>
        </dl>

        {status.message && <p className={`auth-status ${status.type}`} role="status">{status.message}</p>}

        <form className="profile-form password-change" onSubmit={cambiar}>
          <h3>Cambiar mi contraseña</h3>
          <label>
            Nueva contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            Repetir
            <input
              type="password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button disabled={loading || !password || !repetida}>Cambiar contraseña</button>
        </form>

        <button className="profile-logout" type="button" onClick={onLogout}>Cerrar sesión</button>
      </section>
    </div>
  );
}
