import api from "./api";
import {
  listarModulos,
  listarTiposDeEvento,
  catalogoPorModulo,
  mapaDeIntegracion,
} from "./catalog";

jest.mock("./api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

beforeEach(() => {
  api.get.mockReset();
});

function mockCatalogo(modulos, tipos) {
  api.get.mockImplementation((url) => {
    if (url === "/modules") return Promise.resolve({ data: modulos });
    if (url === "/event-types") return Promise.resolve({ data: { items: tipos } });
    return Promise.reject(new Error(`Consulta inesperada: ${url}`));
  });
}

test("T-166: listarModulos consulta /modules y devuelve data", async () => {
  const modulos = [{ name: "tickets", description: "Reclamos" }];
  api.get.mockResolvedValue({ data: modulos });

  await expect(listarModulos()).resolves.toEqual(modulos);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/modules");
});

test("T-167: listarTiposDeEvento solicita size=200 y devuelve items", async () => {
  const tipos = [{ name: "ticketCreated", ownerModule: "tickets" }];
  api.get.mockResolvedValue({ data: { items: tipos, total: 1 } });

  await expect(listarTiposDeEvento()).resolves.toEqual(tipos);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/event-types", { params: { size: 200 } });
});

test.each([{}, { items: null }])("T-168: devuelve [] cuando faltan items (%j)", async (data) => {
  api.get.mockResolvedValue({ data });

  await expect(listarTiposDeEvento()).resolves.toEqual([]);
});

test("T-169: agrupa eventos por propietario y conserva los datos de cada módulo", async () => {
  const modulos = [
    { id: 7, name: "tickets", description: "Reclamos" },
    { id: 8, name: "users", description: "Usuarios" },
  ];
  const tipos = [
    { name: "ticketCreated", ownerModule: "tickets" },
    { name: "userCreated", ownerModule: "users" },
    { name: "ticketClosed", ownerModule: "tickets" },
  ];
  mockCatalogo(modulos, tipos);

  await expect(catalogoPorModulo()).resolves.toEqual([
    { ...modulos[0], id: "tickets", events: [tipos[0], tipos[2]] },
    { ...modulos[1], id: "users", events: [tipos[1]] },
  ]);
  expect(modulos).toEqual([
    { id: 7, name: "tickets", description: "Reclamos" },
    { id: 8, name: "users", description: "Usuarios" },
  ]);
});

test("T-170: omite módulos que no tienen eventos", async () => {
  const tipo = { name: "ticketCreated", ownerModule: "tickets" };
  mockCatalogo([{ name: "empty" }, { name: "tickets" }], [tipo]);

  await expect(catalogoPorModulo()).resolves.toEqual([
    { id: "tickets", name: "tickets", events: [tipo] },
  ]);
});

test("T-171: agrupa propietarios desconocidos o ausentes al final del catálogo", async () => {
  const conocido = { name: "ticketCreated", ownerModule: "tickets" };
  const desconocido = { name: "otherCreated", ownerModule: "unknown" };
  const sinPropietario = { name: "unownedCreated" };
  mockCatalogo([{ name: "tickets" }], [desconocido, conocido, sinPropietario]);

  await expect(catalogoPorModulo()).resolves.toEqual([
    { id: "tickets", name: "tickets", events: [conocido] },
    {
      id: "__sin-duenio",
      name: "Sin módulo propietario",
      events: [desconocido, sinPropietario],
    },
  ]);
});

test("T-172: tolera módulos y tipos vacíos", async () => {
  mockCatalogo([], []);

  await expect(catalogoPorModulo()).resolves.toEqual([]);
});

test("T-173: mapaDeIntegracion consulta /event-types/map y devuelve data", async () => {
  const mapa = [{ name: "ticketCreated", publisher: "tickets", consumers: ["users"] }];
  api.get.mockResolvedValue({ data: mapa });

  await expect(mapaDeIntegracion()).resolves.toEqual(mapa);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/event-types/map");
});
