import api from "./api";

const MOCK_DELAY = 650;
const wait = (value) => new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY));

export const authService = {
  async login(credentials) {
    // BACKEND TODO: return (await api.post("/auth/login", credentials)).data;
    void api;
    return wait({
      user: {
        id: "usr-demo",
        nombre: credentials.usuario,
        usuario: credentials.usuario,
        email: credentials.email || `${credentials.usuario}@core.local`,
        avatar: "",
        roles: ["Operador"],
      },
      accessToken: "demo-memory-token",
    });
  },
  async register(payload) {
    // BACKEND TODO: return (await api.post("/auth/register", payload)).data;
    void api; void payload; return wait({ ok: true });
  },
  async requestPasswordReset(email) {
    // BACKEND TODO: return (await api.post("/auth/password/forgot", { email })).data;
    void api; return wait({ ok: true, email });
  },
  async resetPassword(token, password) {
    // BACKEND TODO: return (await api.post("/auth/password/reset", { token, password })).data;
    void api; void token; void password; return wait({ ok: true });
  },
  async updateProfile(payload) {
    // BACKEND TODO: return (await api.put("/users/me", payload)).data;
    void api; return wait({ ...payload });
  },
  async changePassword(payload) {
    // BACKEND TODO: return (await api.put("/users/me/password", payload)).data;
    void api; void payload; return wait({ ok: true });
  },
};
