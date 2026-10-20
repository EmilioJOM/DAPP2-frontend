import api from "./api";
import { session } from "./session";

/**
 * Autenticacion contra el Core.
 *
 * El Core no es un sistema de registro abierto: las cuentas las crea cada
 * equipo desde el panel con `POST /users`. Por eso aca no hay registro ni
 * recuperacion de contrasena.
 */
export const authService = {
  /** POST /auth/login — email y contrasena de una persona. */
  async login({ email, password }) {
    const { data } = await api.post("/auth/login", { email, password });
    return session.start(data);
  },

  /** GET /auth/me — para restaurar la sesion al refrescar la pagina. */
  async me() {
    const { data } = await api.get("/auth/me");
    return data;
  },

  /** PUT /users/{id}/password */
  async cambiarPassword(userId, password) {
    const { data } = await api.put(`/users/${userId}/password`, { password });
    return data;
  },

  /** GET /users — las cuentas del equipo. El admin ve las de todos. */
  async listarCuentas() {
    const { data } = await api.get("/users");
    return data;
  },

  /**
   * La cuenta de quien esta logueado.
   *
   * Ni el login ni `/auth/me` devuelven el id, y para cambiar la contrasena
   * hace falta: se busca por email en el listado del equipo.
   */
  async miCuenta() {
    const yo = await this.me();
    if (!yo.email) return null;
    const cuentas = await this.listarCuentas();
    const items = Array.isArray(cuentas) ? cuentas : (cuentas.items ?? []);
    return items.find((u) => u.email === yo.email) ?? null;
  },

  logout() {
    session.clear();
  },
};
