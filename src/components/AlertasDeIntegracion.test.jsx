import { expect, test, describe } from '@jest/globals'
import { fireEvent, render, screen, within } from '@testing-library/react'
import AlertasDeIntegracion from './AlertasDeIntegracion'

// Las frases son las que arma el Core: los resúmenes de cada renglón se sacan
// de acá, así que si el backend las cambia estos tests son los que avisan.
const esperanYNadiePublica = (tipo, cuantos) => ({
  severity: 'warning',
  kind: 'NO_PRODUCER_DECLARED',
  eventType: tipo,
  detail: `${cuantos} modulo(s) esperan '${tipo}' y ningun modulo declara publicarlo. Puede ser un nombre desalineado, o un productor que todavia no lo declaro.`,
})

const nuncaLlego = (tipo) => ({
  severity: 'info',
  kind: 'NEVER_RECEIVED',
  eventType: tipo,
  detail: `2 modulo(s) esperan '${tipo}' y 1 lo declara(n) como publicado, pero todavia no llego ninguno.`,
})

describe('Alertas de integración', () => {
  test('dice una sola vez lo que le pasa a todo el grupo, no una vez por renglón', () => {
    render(
      <AlertasDeIntegracion
        alertas={[
          esperanYNadiePublica('ticketCreated', 2),
          esperanYNadiePublica('paymentConfirmed', 1),
          esperanYNadiePublica('citizenRegistered', 3),
        ]}
      />,
    )

    // La explicación: una sola, en la cabecera del grupo.
    expect(screen.getAllByText(/nadie reclama un evento que nunca vio llegar/i)).toHaveLength(1)

    // Y los tres renglones con lo único que los diferencia.
    expect(screen.getByText('ticketCreated')).toBeInTheDocument()
    expect(screen.getByText('2 módulos esperan · nadie lo publica')).toBeInTheDocument()
    expect(screen.getByText('1 módulo espera · nadie lo publica')).toBeInTheDocument()
  })

  test('las que piden acción arrancan abiertas y las informativas plegadas', () => {
    render(
      <AlertasDeIntegracion
        alertas={[esperanYNadiePublica('ticketCreated', 2), nuncaLlego('debtOverdue')]}
      />,
    )

    expect(screen.getByText('ticketCreated')).toBeInTheDocument()
    expect(screen.queryByText('debtOverdue')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /todavía sin tráfico/i }))
    expect(screen.getByText('debtOverdue')).toBeInTheDocument()
  })

  test('un kind que el panel no conoce se muestra entero en vez de romper', () => {
    render(
      <AlertasDeIntegracion
        alertas={[
          {
            severity: 'warning',
            kind: 'SCHEMA_DRIFT',
            eventType: 'ticketCreated',
            detail: 'El esquema cambió entre dos publicaciones del mismo tipo.',
          },
        ]}
      />,
    )

    // El código crudo hace de título y el texto del Core se muestra tal cual.
    expect(screen.getByText('SCHEMA_DRIFT')).toBeInTheDocument()
    expect(
      screen.getByText('El esquema cambió entre dos publicaciones del mismo tipo.'),
    ).toBeInTheDocument()
  })

  test('una severidad desconocida no se pierde ni se pinta de cualquier color', () => {
    render(
      <AlertasDeIntegracion
        alertas={[{ severity: 'critical', kind: 'RARO', eventType: 'x', detail: 'algo' }]}
      />,
    )

    expect(screen.getByText(/sin clasificar/i)).toBeInTheDocument()
  })

  test('el total viene con cuántas piden que alguien haga algo', () => {
    render(
      <AlertasDeIntegracion
        alertas={[esperanYNadiePublica('ticketCreated', 2), nuncaLlego('debtOverdue')]}
      />,
    )

    const resumen = screen.getByText(/en total/).closest('p')
    expect(resumen).toHaveTextContent('2 en total')
    expect(resumen).toHaveTextContent('1 requiere atención')
  })

  test('sin alertas lo dice, en vez de no mostrar nada', () => {
    render(<AlertasDeIntegracion alertas={[]} />)
    expect(screen.getByText(/todo lo que se publica tiene quien lo escuche/i)).toBeInTheDocument()
  })

  const filtrables = () => [
    esperanYNadiePublica('TicketCreated', 1),
    esperanYNadiePublica('paymentConfirmed', 2),
    ...Array.from({ length: 7 }, (_, i) => nuncaLlego(`traffic${i}`)),
  ]

  test('T-017: muestra las etiquetas de severidad una vez y permite consultar cada grupo', () => {
    render(<AlertasDeIntegracion alertas={[
      esperanYNadiePublica('ticket', 1),
      { severity: 'warning', kind: 'NO_SUBSCRIBERS', eventType: 'payment', detail: 'Se recibieron 2 eventos' },
      nuncaLlego('traffic'),
      { severity: 'critical', kind: 'CUSTOM', eventType: 'custom', detail: 'Revisar esquema' },
    ]} />)
    for (const label of ['Requieren atención', 'Informativas', 'Sin clasificar']) {
      expect(screen.getAllByRole('heading', { name: label })).toHaveLength(1)
    }
    expect(screen.getByText('2 eventos recibidos · sin suscriptores')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /CUSTOM/ }))
    expect(screen.getByText('Revisar esquema')).toBeInTheDocument()
  })

  test('T-018: filtra por evento y detalle, sin distinguir mayúsculas, y actualiza grupos y cuentas', () => {
    render(<AlertasDeIntegracion alertas={filtrables()} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: '  TICKET  ' } })
    expect(screen.getByRole('status')).toHaveTextContent('1 de 9 coinciden con «TICKET».')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button')).toHaveTextContent(/1$/)
    expect(screen.getByText('TicketCreated')).toBeInTheDocument()
    expect(screen.queryByText('paymentConfirmed')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'todavia no llego' } })
    expect(screen.getByRole('status')).toHaveTextContent('7 de 9 coinciden')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
  })

  test('T-019: borrar el filtro restaura grupos, cuentas y apertura inicial', () => {
    render(<AlertasDeIntegracion alertas={filtrables()} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'traffic0' } })
    expect(screen.getByRole('status')).toHaveTextContent('1 de 9')
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /nadie los publica/ })).toHaveTextContent(/2$/)
    expect(screen.getByRole('button', { name: /sin tráfico/ })).toHaveTextContent(/7$/)
    expect(screen.getByRole('button', { name: /sin tráfico/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/en total/)).toHaveTextContent('9 en total · 2 requieren atención')
  })

  test('T-020: expandir y contraer conserva el botón y su relación accesible con el contenido', () => {
    render(<AlertasDeIntegracion alertas={[nuncaLlego('traffic')]} />)
    const button = screen.getByRole('button')
    const id = button.getAttribute('aria-controls')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(id)).toBeNull()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(within(document.getElementById(id)).getByText('traffic')).toBeInTheDocument()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(id)).toBeNull()
    expect(screen.getByRole('button')).toBe(button)
  })

  test('T-021: separa clases aunque compartan evento y conserva los datos de cada módulo', () => {
    render(<AlertasDeIntegracion alertas={[
      { severity: 'warning', kind: 'SCHEMA_A', eventType: 'shared', module: 'ventas', detail: 'Error en ventas' },
      { severity: 'warning', kind: 'SCHEMA_B', eventType: 'shared', module: 'pagos', detail: 'Error en pagos' },
    ]} />)
    for (const [kind, detail, other] of [['SCHEMA_A', 'Error en ventas', 'Error en pagos'], ['SCHEMA_B', 'Error en pagos', 'Error en ventas']]) {
      const button = screen.getByRole('button', { name: new RegExp(kind) })
      const body = within(document.getElementById(button.getAttribute('aria-controls')))
      expect(body.getAllByRole('listitem')).toHaveLength(1)
      expect(body.getByText(detail)).toBeInTheDocument()
      expect(body.queryByText(other)).not.toBeInTheDocument()
    }
  })

  test('T-022: admite lista vacía y campos faltantes o detalles que no coinciden con el catálogo', () => {
    const { rerender } = render(<AlertasDeIntegracion />)
    expect(screen.getByText('Ninguna.')).toBeInTheDocument()
    rerender(<AlertasDeIntegracion alertas={[
      {},
      { severity: 'warning', kind: 'NO_SUBSCRIBERS', eventType: '', detail: null },
      { severity: 'warning', kind: 'NO_PRODUCER_DECLARED', eventType: 'raw', detail: 'Formato nuevo: 0 módulos' },
    ]} />)
    expect(screen.getByText('Formato nuevo: 0 módulos')).toBeInTheDocument()
    expect(screen.getByText('Formato nuevo: 0 módulos').closest('li')).toHaveAttribute('title', 'Formato nuevo: 0 módulos')
    fireEvent.click(screen.getByRole('button', { name: /SIN_TIPO/ }))
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  test('T-023: usa singular y plural correctos y anuncia búsquedas sin coincidencias', () => {
    render(<AlertasDeIntegracion alertas={[
      ...filtrables(),
      { severity: 'warning', kind: 'NO_SUBSCRIBERS', eventType: 'single', detail: 'Se recibieron 1 eventos' },
      { severity: 'warning', kind: 'NO_SUBSCRIBERS', eventType: 'multiple', detail: 'Se recibieron 3 eventos' },
    ]} />)
    expect(screen.getByText('1 evento recibido · sin suscriptores')).toBeInTheDocument()
    expect(screen.getByText('3 eventos recibidos · sin suscriptores')).toBeInTheDocument()
    expect(screen.getByText('1 módulo espera · nadie lo publica')).toBeInTheDocument()
    expect(screen.getByText('2 módulos esperan · nadie lo publica')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistente' } })
    expect(screen.getByRole('status')).toHaveTextContent('Ninguna alerta menciona «inexistente».')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
