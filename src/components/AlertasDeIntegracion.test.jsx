import { expect, test, describe } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
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
})
