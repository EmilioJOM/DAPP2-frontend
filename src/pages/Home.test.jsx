import { expect, jest, test, beforeEach, describe } from '@jest/globals'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  session: { esAdmin: () => false, getModulo: () => 'rentas' },
}))


const pantalla = () => render(<Home />)

beforeEach(() => jest.clearAllMocks())

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
