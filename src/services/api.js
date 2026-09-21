import axios from "axios";
import { session } from "./session";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  withCredentials: true, // preparado para JWT/session cookie httpOnly
});

api.interceptors.request.use(
  (config) => {
    const token = session.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default api;
