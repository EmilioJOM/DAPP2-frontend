import { expect, jest, test, beforeEach, afterEach, describe } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { session } from '../services/session'
import { listarEventos, obtenerEvento } from '../services/events'
import Home from './Home'
import { limiteDelDia, validarFiltros } from '../utils/filtros'

// react-router se publica solo como ESM y usa `import.meta`, que babel-jest no
// puede transformar a CommonJS. Acá se prueba la pantalla, no el ruteo: alcanza
// con que <Link> renderice su texto.
jest.mock('react-router', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}))

// El historial ahora sale de la API del Core. Lo que se prueba acá es la
// pantalla, no el backend: se simula el servicio y se verifica que la tabla
// muestre lo que vino y que el estado vacío aparezca cuando no hay nada.
jest.mock('../services/events', () => ({
  listarEventos: jest.fn(),
  obtenerEvento: jest.fn(),
  estadoDeEvento: {
    ROUTED: { texto: 'Entregado', tono: 'ok' },
    REJECTED: { texto: 'Rechazado', tono: 'error' },
  },
}))
jest.mock('../services/api', () => ({
  __esModule: true,
  default: {},
  mensajeDeError: (_e, porDefecto) => porDefecto,
}))
jest.mock('../services/session', () => ({
  session: { esAdmin: jest.fn(() => false), getModulo: () => 'rentas' },
}))


const pantalla = () => render(<Home />)

afterEach(() => jest.restoreAllMocks())

beforeEach(() => {
  jest.resetAllMocks()
  session.esAdmin.mockReturnValue(false)
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-06T16:00:00Z'))
})

describe('Historial de eventos', () => {
  test('muestra los eventos que devuelve el Core', async () => {
    listarEventos.mockResolvedValue({
      items: [
        {
          id: '1',
          eventId: 'e1',
          eventType: 'paymentConfirmed',
          sourceModule: 'rentas',
          occurredAt: '2026-10-06T12:00:00-03:00',
          receivedAt: '2026-10-06T12:00:01-03:00',
          status: 'ROUTED',
          deliveryCount: 2,
          deliveredCount: 2,
          rejectionCode: null,
        },
      ],
      total: 1,
      pages: 1,
    })

    pantalla()

    expect(await screen.findByText('paymentConfirmed')).toBeInTheDocument()
    // "Entregado" también es una opción del filtro de estado: se busca en la tabla.
    expect(within(screen.getByRole('table')).getByText(/Entregado/)).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })

  test('explica qué hacer cuando no llegó ningún evento', async () => {
    listarEventos.mockResolvedValue({ items: [], total: 0, pages: 0 })

    pantalla()

    expect(
      await screen.findByRole('heading', { name: /todavía no hay eventos/i }),
    ).toBeInTheDocument()
  })

  test('mientras espera al Core muestra el esqueleto, no una pantalla vacía', async () => {
    // Una promesa que no se resuelve: deja la pantalla en su estado de carga.
    listarEventos.mockReturnValue(new Promise(() => {}))

    const { container } = pantalla()

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(container.querySelectorAll('.esqueleto-fila')).toHaveLength(8)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  test('avisa si el Core no responde', async () => {
    listarEventos.mockRejectedValue(new Error('network'))

    pantalla()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar el historial/i),
    )
  })

  test('una búsqueda sin resultados no se confunde con un hub sin eventos', async () => {
    listarEventos.mockResolvedValue({ items: [], total: 0, pages: 0 })

    pantalla()

    // Sin búsqueda: no hay tráfico todavía.
    expect(
      await screen.findByRole('heading', { name: /todavía no hay eventos/i }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/buscar eventos/i), {
      target: { value: 'noExiste' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }))

    // Con búsqueda: lo que falta es un resultado, no un evento.
    expect(
      await screen.findByRole('heading', { name: /ningún evento coincide con «noExiste»/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /todavía no hay eventos/i })).not.toBeInTheDocument()
  })

  test('filtra por eventId pidiendo ese evento exacto (HU-06)', async () => {
    listarEventos.mockResolvedValue({ items: [], total: 0, pages: 0 })
    obtenerEvento.mockResolvedValue({
      id: '9',
      eventId: '3f2b6c1e-8a1d-4c55-9b0e-2a7f5d3c9e10',
      eventType: 'ticketCreated',
      sourceModule: 'rentas',
      status: 'ROUTED',
      deliveryCount: 1,
      deliveredCount: 1,
    })

    pantalla()
    await screen.findByRole('heading', { name: /todavía no hay eventos/i })
    fireEvent.change(screen.getByLabelText(/identificador/i), {
      target: { value: '3f2b6c1e-8a1d-4c55-9b0e-2a7f5d3c9e10' },
    })
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }))

    expect(await screen.findByText('ticketCreated')).toBeInTheDocument()
    expect(obtenerEvento).toHaveBeenCalledWith('3f2b6c1e-8a1d-4c55-9b0e-2a7f5d3c9e10')
  })

  test('un eventId inexistente se informa como "sin coincidencias", no como error', async () => {
    listarEventos.mockResolvedValue({ items: [], total: 0, pages: 0 })
    obtenerEvento.mockRejectedValue({ response: { status: 404 } })

    pantalla()
    await screen.findByRole('heading', { name: /todavía no hay eventos/i })
    fireEvent.change(screen.getByLabelText(/identificador/i), {
      target: { value: '00000000-0000-4000-8000-000000000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }))

    expect(await screen.findByRole('heading', { name: /ningún evento coincide con eventId/i })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('un eventId mal formado no dispara el pedido', async () => {
    listarEventos.mockResolvedValue({ items: [], total: 0, pages: 0 })

    pantalla()
    await screen.findByRole('heading', { name: /todavía no hay eventos/i })
    fireEvent.change(screen.getByLabelText(/identificador/i), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/uuid/i)
    expect(obtenerEvento).not.toHaveBeenCalled()
  })

  test('filtra por estado y rango de fechas con la API (HU-06)', async () => {
    listarEventos.mockResolvedValue({ items: [], total: 0, pages: 0 })

    pantalla()
    await screen.findByRole('heading', { name: /todavía no hay eventos/i })
    fireEvent.change(screen.getByLabelText(/estado/i), { target: { value: 'REJECTED' } })
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-11-02' } })
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }))

    await waitFor(() =>
      expect(listarEventos).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'REJECTED',
          since: limiteDelDia('2026-11-01'),
          until: limiteDelDia('2026-11-02', true),
        }),
      ),
    )
    expect(
      (await screen.findAllByText(/estado Rechazado · desde 2026-11-01 · hasta 2026-11-02/)).length,
    ).toBeGreaterThan(0)
  })

  test('un rango invertido se avisa y no se aplica', async () => {
    listarEventos.mockResolvedValue({ items: [], total: 0, pages: 0 })

    pantalla()
    await screen.findByRole('heading', { name: /todavía no hay eventos/i })
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-11-05' } })
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/posterior/i)
    expect(listarEventos).toHaveBeenCalledTimes(1)
  })

  test('las fechas cubren el día completo en la hora local', () => {
    const inicio = new Date(limiteDelDia('2026-11-01'))
    const fin = new Date(limiteDelDia('2026-11-01', true))
    expect([inicio.getHours(), inicio.getMinutes()]).toEqual([0, 0])
    expect([fin.getHours(), fin.getMinutes(), fin.getSeconds()]).toEqual([23, 59, 59])
    expect(limiteDelDia('')).toBeUndefined()
    expect(validarFiltros({ eventId: '', desde: '', hasta: '' })).toBe('')
  })

  test('cuando el Core no responde ofrece reintentar sin recargar la página', async () => {
    listarEventos.mockRejectedValueOnce(new Error('network')).mockResolvedValue({
      items: [],
      total: 0,
      pages: 0,
    })

    pantalla()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))

    expect(
      await screen.findByRole('heading', { name: /todavía no hay eventos/i }),
    ).toBeInTheDocument()
    expect(listarEventos).toHaveBeenCalledTimes(2)
  })
})

const evento = (extra = {}) => ({
  id: '1', eventId: 'e1', eventType: 'paymentConfirmed', sourceModule: 'rentas',
  occurredAt: '2026-10-06T15:00:00Z', receivedAt: '2026-10-06T15:00:01Z',
  status: 'ROUTED', deliveryCount: 2, deliveredCount: 2, ...extra,
})
const respuesta = (items = [evento()], total = 51, pages = 3) => ({ items, total, pages })
const buscar = (value) => {
  fireEvent.change(screen.getByLabelText(/buscar eventos/i), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }))
}
const diferida = () => {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

test('T-098: pagina con size 25 y limita ambos extremos', async () => {
  listarEventos.mockResolvedValue(respuesta())
  pantalla()
  await screen.findByText('paymentConfirmed')
  expect(listarEventos).toHaveBeenLastCalledWith({ page: 1, size: 25, query: undefined })
  expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
  expect(listarEventos).toHaveBeenCalledTimes(1)
  for (const page of [2, 3]) {
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await screen.findByText(new RegExp(`página ${page} de 3`))
    expect(listarEventos).toHaveBeenLastCalledWith({ page, size: 25, query: undefined })
  }
  expect(screen.getByText('51–51 de 51 · página 3 de 3')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
  expect(listarEventos).toHaveBeenCalledTimes(3)
  fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
  await screen.findByText(/página 2 de 3/)
  expect(listarEventos).toHaveBeenLastCalledWith({ page: 2, size: 25, query: undefined })
})

test('T-099: escribir no consulta; Buscar recorta y vuelve a página 1', async () => {
  listarEventos.mockResolvedValue(respuesta())
  pantalla()
  await screen.findByText('paymentConfirmed')
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
  await screen.findByText(/página 2 de 3/)
  fireEvent.change(screen.getByLabelText(/buscar eventos/i), { target: { value: '  rentas  ' } })
  expect(listarEventos).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }))
  await screen.findByText(/página 1 de 3/)
  expect(listarEventos).toHaveBeenLastCalledWith({ page: 1, size: 25, query: 'rentas' })
  expect(screen.getByText('«rentas»')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /quitar filtro/i }))
  await waitFor(() => expect(listarEventos).toHaveBeenLastCalledWith({ page: 1, size: 25, query: undefined }))
  expect(screen.getByLabelText(/buscar eventos/i)).toHaveValue('')
  expect(screen.queryByText('«rentas»')).not.toBeInTheDocument()
})

test.each([false, true])('T-100 (parcial): limpiar búsqueda desde página 2 restaura página 1 (vacío=%s)', async (vacio) => {
  listarEventos.mockResolvedValue(respuesta())
  pantalla()
  await screen.findByText('paymentConfirmed')
  buscar('rentas')
  await waitFor(() => expect(listarEventos).toHaveBeenLastCalledWith({ page: 1, size: 25, query: 'rentas' }))
  await screen.findByText(/página 1 de 3/)

  listarEventos.mockResolvedValueOnce(vacio ? respuesta([], 0, 0) : respuesta())
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
  if (vacio) await screen.findByRole('heading', { name: /ningún evento coincide/i })
  else await screen.findByText(/página 2 de 3/)
  expect(listarEventos).toHaveBeenLastCalledWith({ page: 2, size: 25, query: 'rentas' })

  // El borrador sin aplicar también debe limpiarse junto con la búsqueda activa.
  fireEvent.change(screen.getByLabelText(/buscar eventos/i), { target: { value: 'otro módulo' } })
  fireEvent.click(screen.getByRole('button', { name: vacio ? /ver todos los eventos/i : /quitar filtro/i }))

  await screen.findByText(/página 1 de 3/)
  expect(listarEventos).toHaveBeenLastCalledWith({ page: 1, size: 25, query: undefined })
  expect(listarEventos).toHaveBeenCalledTimes(4)
  expect(screen.getByLabelText(/buscar eventos/i)).toHaveValue('')
  expect(screen.queryByText('«rentas»')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /quitar filtro/i })).not.toBeInTheDocument()
})

test.each([false, true])('T-101/102/103: JSON completo o respaldo, y cierre (fallo=%s)', async (fallo) => {
  const fila = evento()
  const completo = { ...fila, payload: { importe: 42 } }
  listarEventos.mockResolvedValue(respuesta([fila], 1, 1))
  if (fallo) obtenerEvento.mockRejectedValue(new Error('sin conexión'))
  else obtenerEvento.mockResolvedValue(completo)
  pantalla()
  fireEvent.click(await screen.findByRole('button', { name: /JSON/ }))
  const dialog = await screen.findByRole('dialog')
  expect(obtenerEvento).toHaveBeenCalledWith('e1')
  expect(JSON.parse(dialog.querySelector('pre').textContent)).toEqual(fallo ? fila : completo)
  fireEvent.click(within(dialog).getAllByRole('button', { name: 'Cerrar' })[0])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test.each(['inválida', undefined])('T-104: fecha %s muestra marcador sin time', async (occurredAt) => {
  listarEventos.mockResolvedValue(respuesta([evento({ occurredAt })]))
  pantalla()
  const fila = (await screen.findByText('paymentConfirmed')).closest('tr')
  expect(within(fila).getAllByRole('cell')[2]).toHaveTextContent('—')
  expect(fila.querySelector('time')).toBeNull()
})

test.each([
  ['2026-10-06T14:59:59Z', '—'], [undefined, '—'],
  ['2026-10-06T15:00:00.500Z', '500 ms'], ['2026-10-06T15:00:02Z', '2,0 s'],
  ['2026-10-06T15:02:00Z', '2 min'], ['2026-10-06T17:00:00Z', '2 h'],
])('T-105: demora con recepción %s muestra %s', async (receivedAt, texto) => {
  listarEventos.mockResolvedValue(respuesta([evento({ receivedAt })]))
  pantalla()
  const fila = (await screen.findByText('paymentConfirmed')).closest('tr')
  expect(within(fila).getAllByRole('cell')[3]).toHaveTextContent(texto)
})

test('T-106: estado desconocido y motivo de rechazo visibles', async () => {
  listarEventos.mockResolvedValue(respuesta([evento({ status: 'NUEVO', rejectionCode: 'INVALID_SCHEMA' })]))
  pantalla()
  expect(await screen.findByText('NUEVO')).toHaveClass('estado--muted')
  expect(screen.getByText('INVALID_SCHEMA')).toBeInTheDocument()
})

test.each([
  [undefined, undefined, '—', 'muted', 'Ningún módulo estaba suscripto a este tipo'],
  [0, 0, '—', 'muted', 'Ningún módulo estaba suscripto a este tipo'],
  [1, 3, '1/3', 'warn', '1 de 3 suscripciones recibieron este evento'],
  [3, 3, '3/3', 'ok', '3 de 3 suscripciones recibieron este evento'],
])('T-107: entregas %s/%s tienen etiqueta y tono', async (deliveredCount, deliveryCount, texto, tono, title) => {
  listarEventos.mockResolvedValue(respuesta([evento({ deliveredCount, deliveryCount })]))
  pantalla()
  const fila = (await screen.findByText('paymentConfirmed')).closest('tr')
  const celda = within(fila).getAllByRole('cell')[5]
  expect(celda).toHaveTextContent(texto)
  expect(celda).toHaveClass(`entregas--${tono}`)
  expect(within(celda).getByTitle(title)).toBeInTheDocument()
})

test.each([true, false])('T-108: alcance visible según admin=%s', async (admin) => {
  session.esAdmin.mockReturnValue(admin)
  listarEventos.mockResolvedValue(respuesta())
  pantalla()
  await screen.findByText('paymentConfirmed')
  expect(screen.getByText(admin ? 'Todo el tráfico del hub.' : 'Lo que publicó y lo que recibió rentas.')).toBeInTheDocument()
})

test.each(['resolve', 'reject'])('T-109: respuesta obsoleta (%s) no reemplaza consulta nueva', async (terminar) => {
  const vieja = diferida()
  listarEventos.mockResolvedValueOnce(respuesta()).mockReturnValueOnce(vieja.promise)
    .mockResolvedValueOnce(respuesta([evento({ eventType: 'resultadoNuevo' })]))
  pantalla()
  await screen.findByText('paymentConfirmed')
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
  await waitFor(() => expect(listarEventos).toHaveBeenCalledTimes(2))
  buscar('nuevo')
  await screen.findByText('resultadoNuevo')
  await act(async () => {
    vieja[terminar](terminar === 'resolve' ? respuesta([evento({ eventType: 'obsoleto' })]) : new Error('vieja'))
  })
  expect(screen.getByText('resultadoNuevo')).toBeInTheDocument()
  expect(screen.queryByText('obsoleto')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText(/página 1 de 3/)).toBeInTheDocument()
})
