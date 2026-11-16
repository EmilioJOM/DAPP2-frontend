import { expect, jest, test, beforeEach, describe } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { listarDeadLetters, obtenerDeadLetter, reintentar } from '../services/events'
import Dlq from './Dlq'

// Se prueba la pantalla de la cola de fallas (HU-07), no el backend: se
// simulan los pedidos y se conservan las reglas de presentacion reales.
jest.mock('../services/events', () => {
  const real = jest.requireActual('../services/events')
  return {
    ...real,
    listarDeadLetters: jest.fn(),
    obtenerDeadLetter: jest.fn(),
    reintentar: jest.fn(),
  }
})
jest.mock('../services/api', () => ({
  __esModule: true,
  default: {},
  mensajeDeError: (e, porDefecto) => e?.mensaje ?? porDefecto,
}))
jest.mock('../services/session', () => ({
  session: { esAdmin: () => false, getModulo: () => 'atencion-ciudadana' },
}))

const caida = (extra = {}) => ({
  id: 'dl-1',
  eventId: 'e-1',
  eventType: 'ticketCreated',
  sourceModule: 'atencion-ciudadana',
  targetModule: null,
  reasonCode: 'SCHEMA_VIOLATION',
  reason: 'Falta priority',
  attempts: 1,
  status: 'OPEN',
  createdAt: '2026-11-01T10:00:00-03:00',
  ...extra,
})

const pagina = (items) => ({ items, total: items.length, pages: 1 })

beforeEach(() => jest.clearAllMocks())

describe('Cola de fallas', () => {
  test('lista las fallas del módulo con su motivo', async () => {
    listarDeadLetters.mockResolvedValue(pagina([caida()]))

    render(<Dlq />)

    expect(await screen.findByText('ticketCreated')).toBeInTheDocument()
    expect(screen.getByText('SCHEMA_VIOLATION')).toBeInTheDocument()
    expect(screen.getByText('Abierta')).toBeInTheDocument()
    expect(listarDeadLetters).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }))
  })

  test('el detalle muestra el motivo, los datos enviados y el historial de reintentos', async () => {
    listarDeadLetters.mockResolvedValue(pagina([caida()]))
    obtenerDeadLetter.mockResolvedValue({
      ...caida(),
      details: [{ field: 'priority', message: 'requerido' }],
      rawPayload: { eventId: 'e-1', data: { marker: 'x' } },
      retries: [
        {
          id: 'r1',
          attemptNumber: 1,
          mode: 'AUTOMATIC',
          actor: 'system',
          result: 'FAILURE',
          error: 'timeout',
          createdAt: '2026-11-01T10:01:00-03:00',
        },
      ],
    })

    render(<Dlq />)
    fireEvent.click(await screen.findByRole('button', { name: /ver detalle de ticketCreated/i }))

    expect(await screen.findByRole('heading', { name: /detalle de la falla: ticketCreated/i })).toBeInTheDocument()
    expect(screen.getByText('Falta priority')).toBeInTheDocument()
    expect(screen.getByText(/"marker": "x"/)).toBeInTheDocument()
    expect(screen.getByText('Automático')).toBeInTheDocument()
    expect(screen.getByText('timeout')).toBeInTheDocument()
  })

  test('el reintento se pide una sola vez aunque se haga doble clic', async () => {
    listarDeadLetters.mockResolvedValue(pagina([caida()]))
    let resolver
    reintentar.mockReturnValue(new Promise((r) => { resolver = r }))

    render(<Dlq />)
    const boton = await screen.findByRole('button', { name: /reintentar ticketCreated/i })
    fireEvent.click(boton)
    fireEvent.click(boton)

    expect(reintentar).toHaveBeenCalledTimes(1)
    expect(boton).toBeDisabled()

    resolver({ success: true, attemptNumber: 1, message: 'Reprocesado y entregado a obras.' })
    expect(await screen.findByRole('status')).toHaveTextContent(/reprocesado y entregado a obras/i)
    // Se vuelve a pedir la lista para mostrar el estado real.
    await waitFor(() => expect(listarDeadLetters).toHaveBeenCalledTimes(2))
  })

  test('si el Core rechaza el reintento se muestra el motivo', async () => {
    listarDeadLetters.mockResolvedValue(pagina([caida()]))
    reintentar.mockRejectedValue({ mensaje: 'La dead letter ya fue resuelta.' })

    render(<Dlq />)
    fireEvent.click(await screen.findByRole('button', { name: /reintentar ticketCreated/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/ya fue resuelta/i)
  })

  test('un mensaje malformado o ya resuelto no ofrece reintentar', async () => {
    listarDeadLetters.mockResolvedValue(
      pagina([
        caida({ id: 'dl-2', eventType: 'roto', reasonCode: 'MALFORMED_MESSAGE' }),
        caida({ id: 'dl-3', eventType: 'resuelto', status: 'RETRIED' }),
      ]),
    )

    render(<Dlq />)

    expect(await screen.findByText('roto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^reintentar/i })).not.toBeInTheDocument()
  })

  test('el filtro de estado vuelve a pedir la lista', async () => {
    listarDeadLetters.mockResolvedValue(pagina([]))

    render(<Dlq />)
    expect(await screen.findByRole('heading', { name: /no hay eventos fallidos pendientes/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }))

    await waitFor(() =>
      expect(listarDeadLetters).toHaveBeenLastCalledWith(expect.objectContaining({ status: '' })),
    )
  })

  test('avisa si el Core no responde', async () => {
    listarDeadLetters.mockRejectedValue(new Error('network'))

    render(<Dlq />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar la cola de fallas/i),
    )
  })
})
