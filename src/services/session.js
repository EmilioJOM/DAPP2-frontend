let accessToken = null;

export const session = {
  setToken(token) { accessToken = token || null; },
  getToken() { return accessToken; },
  clear() { accessToken = null; },
};
