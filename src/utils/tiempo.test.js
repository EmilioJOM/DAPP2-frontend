import { demora, esFecha, fechaExacta, haceCuanto } from "./tiempo";

describe("esFecha (T-237)", () => {
  test.each([
    ["2026-10-06T12:00:01Z", true],
    [null, false],
    [undefined, false],
    ["", false],
    ["no es una fecha", false],
  ])("esFecha(%p) devuelve %p", (entrada, esperado) => {
    expect(esFecha(entrada)).toBe(esperado);
  });
});

describe("fechaExacta", () => {
  test.each([null, undefined, "", "inválida"])(
    "T-238: devuelve guion para %p",
    (entrada) => expect(fechaExacta(entrada)).toBe("—"),
  );

  test("T-239: representa día, mes, año y hora en es-AR", () => {
    const iso = new Date(2026, 9, 6, 12, 34, 56).toISOString();
    expect(fechaExacta(iso)).toMatch(/^06\/10\/2026, 12:34:56(?: p\.\s*m\.)?$/);
  });
});

describe("haceCuanto", () => {
  const ahora = Date.parse("2026-10-06T12:00:00Z");
  const desplazada = (segundos) => new Date(ahora + segundos * 1000).toISOString();

  afterEach(() => jest.useRealTimers());

  test.each([
    [-3, "hace 3 segundos"],
    [3, "dentro de 3 segundos"],
    [0, "ahora"],
  ])("T-240: distingue desplazamiento %p con reloj inyectado", (segundos, esperado) => {
    expect(haceCuanto(desplazada(segundos), ahora)).toBe(esperado);
  });

  test("T-240: usa el reloj actual cuando no se inyecta", () => {
    jest.useFakeTimers();
    jest.setSystemTime(ahora);
    expect(haceCuanto(desplazada(-180))).toBe("hace 3 minutos");
  });

  test.each([
    [59, "dentro de 59 segundos"],
    [60, "dentro de 1 minuto"],
    [3600, "dentro de 1 hora"],
    [86400, "mañana"],
    [604800, "la próxima semana"],
    [2678400, "el próximo mes"],
    [31622400, "el próximo año"],
    [-604800, "la semana pasada"],
    [-2678400, "el mes pasado"],
    [-31622400, "el año pasado"],
    [1.6, "dentro de 2 segundos"],
  ])("T-241: selecciona unidad y redondea para %p segundos", (segundos, esperado) => {
    expect(haceCuanto(desplazada(segundos), ahora)).toBe(esperado);
  });

  test.each([null, undefined, "", "inválida"])(
    "T-242: devuelve guion para %p",
    (entrada) => expect(haceCuanto(entrada, ahora)).toBe("—"),
  );
});

describe("demora", () => {
  const inicio = "2026-10-06T12:00:00Z";
  const fin = (ms) => new Date(Date.parse(inicio) + ms).toISOString();

  test.each([
    [inicio, "2026-10-06T11:59:59Z"],
    [null, inicio],
    [inicio, null],
    ["inválida", inicio],
    [inicio, "inválida"],
    ["", inicio],
    [inicio, ""],
  ])("T-243: devuelve null para %p / %p", (desde, hasta) => {
    expect(demora(desde, hasta)).toBeNull();
  });

  test.each([
    ["T-244", 0, "0 ms"],
    ["T-244", 999, "999 ms"],
    ["T-245", 1000, "1,0 s"],
    ["T-245", 1250, "1,3 s"],
    ["T-245", 59900, "59,9 s"],
    ["T-246", 60000, "1 min"],
    ["T-246", 89999, "1 min"],
    ["T-246", 90000, "2 min"],
    ["T-246", 3599999, "60 min"],
    ["T-247", 3600000, "1 h"],
    ["T-247", 5399999, "1 h"],
    ["T-247", 5400000, "2 h"],
  ])("%s: demora de %p ms devuelve %p", (_id, ms, esperado) => {
    expect(demora(inicio, fin(ms))).toBe(esperado);
  });
});
