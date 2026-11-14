import api from "./api";
import {
  listarSuscripciones,
  suscribirse,
  cancelarSuscripcion,
  pausarSuscripcion,
  sincronizar,
} from "./subscriptions";

jest.mock("./api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
  api.post.mockResolvedValue({ data: { id: 99 } });
  api.delete.mockResolvedValue({});
});

test("T-209: lista las suscripciones y devuelve los datos", async () => {
  const datos = [{ id: 1, eventType: "creado", active: true }];
  api.get.mockResolvedValue({ data: datos });
  await expect(listarSuscripciones()).resolves.toEqual(datos);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/subscriptions");
});

test.each([undefined, {}])("T-210: usa cuatro intentos por defecto (%p)", async (opciones) => {
  await expect(suscribirse("creado", opciones)).resolves.toEqual({ id: 99 });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/subscriptions", {
    eventType: "creado", maxAttempts: 4,
  });
});

test.each([1, 0, 8])("T-211: respeta maxAttempts=%i", async (maxAttempts) => {
  await expect(suscribirse("creado", { maxAttempts })).resolves.toEqual({ id: 99 });
  expect(api.post).toHaveBeenCalledWith("/subscriptions", { eventType: "creado", maxAttempts });
});

test("T-212: elimina por ID", async () => {
  await expect(cancelarSuscripcion(17)).resolves.toBeUndefined();
  expect(api.delete).toHaveBeenCalledTimes(1);
  expect(api.delete).toHaveBeenCalledWith("/subscriptions/17");
});

test.each([true, false])("T-213: envía active=%p como query param", async (active) => {
  await expect(pausarSuscripcion(17, active)).resolves.toEqual({ id: 99 });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/subscriptions/17/toggle", null, { params: { active } });
});

test.each([[[]], [[{ id: 1, eventType: "creado", active: true }]]])(
  "T-214: no modifica suscripciones sin diferencias (%p)", async (actuales) => {
    api.get.mockResolvedValue({ data: actuales });
    await expect(sincronizar(actuales.map((s) => s.eventType))).resolves.toEqual({ agregadas: 0, quitadas: 0 });
    expect(api.get).toHaveBeenCalledWith("/subscriptions");
    expect(api.post).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  },
);

test("T-215: agrega cada tipo nuevo una sola vez", async () => {
  api.get.mockResolvedValue({ data: [] });
  await expect(sincronizar(["creado", "creado", "borrado"])).resolves.toEqual({ agregadas: 2, quitadas: 0 });
  expect(api.post).toHaveBeenCalledTimes(2);
  for (const eventType of ["creado", "borrado"]) {
    expect(api.post).toHaveBeenCalledWith("/subscriptions", { eventType, maxAttempts: 4 });
  }
  expect(api.delete).not.toHaveBeenCalled();
});

test("T-216: elimina los tipos desmarcados, incluso pausados", async () => {
  api.get.mockResolvedValue({ data: [
    { id: 1, eventType: "creado", active: true },
    { id: 2, eventType: "borrado", active: false },
  ] });
  await expect(sincronizar([])).resolves.toEqual({ agregadas: 0, quitadas: 2 });
  expect(api.delete).toHaveBeenCalledTimes(2);
  expect(api.delete).toHaveBeenCalledWith("/subscriptions/1");
  expect(api.delete).toHaveBeenCalledWith("/subscriptions/2");
  expect(api.post).not.toHaveBeenCalled();
});

test("T-217: reactiva sin duplicar aunque se repita el tipo elegido", async () => {
  api.get.mockResolvedValue({ data: [{ id: 7, eventType: "creado", active: false }] });
  await expect(sincronizar(["creado", "creado"])).resolves.toEqual({ agregadas: 1, quitadas: 0 });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/subscriptions/7/toggle", null, { params: { active: true } });
  expect(api.delete).not.toHaveBeenCalled();
});

test("T-218: combina altas, reactivaciones y bajas conservando los activos elegidos", async () => {
  api.get.mockResolvedValue({ data: [
    { id: 1, eventType: "conservado", active: true },
    { id: 2, eventType: "pausado", active: false },
    { id: 3, eventType: "quitado", active: true },
  ] });
  await expect(sincronizar(["conservado", "pausado", "nuevo"])).resolves.toEqual({ agregadas: 2, quitadas: 1 });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenCalledWith("/subscriptions", { eventType: "nuevo", maxAttempts: 4 });
  expect(api.post).toHaveBeenCalledWith("/subscriptions/2/toggle", null, { params: { active: true } });
  expect(api.delete).toHaveBeenCalledTimes(1);
  expect(api.delete).toHaveBeenCalledWith("/subscriptions/3");
});

test.each(["alta", "reactivacion", "baja"])("T-219: propaga el error de %s", async (operacion) => {
  const error = new Error(`Fallo de ${operacion}`);
  api.get.mockResolvedValue({ data: [
    { id: 2, eventType: "pausado", active: false },
    { id: 3, eventType: "quitado", active: true },
  ] });
  api.post.mockImplementation((url) => {
    if ((operacion === "alta" && url === "/subscriptions") ||
        (operacion === "reactivacion" && url.endsWith("/toggle"))) {
      return Promise.reject(error);
    }
    return Promise.resolve({ data: {} });
  });
  if (operacion === "baja") api.delete.mockRejectedValue(error);
  await expect(sincronizar(["nuevo", "pausado"])).rejects.toBe(error);
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.delete).toHaveBeenCalledTimes(1);
});
