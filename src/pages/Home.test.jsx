import { expect, jest, test, beforeEach, describe } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import { listarEventos } from '../services/events'
import Home from './Home'

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
    expect(screen.getByText(/Entregado/)).toBeInTheDocument()
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
})
