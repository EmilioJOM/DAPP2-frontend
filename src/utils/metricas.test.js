import { expect, test, describe } from '@jest/globals'
import { tasaDeErrores } from './metricas'

describe('tasa de errores (HU-08)', () => {
  test('rechazados sobre el total de la ventana', () => {
    const tasa = tasaDeErrores([
      { hour: 'h1', total: 3, rejected: 0 },
      { hour: 'h2', total: 1, rejected: 1 },
    ])
    expect(tasa).toMatchObject({ total: 4, rechazados: 1, porcentaje: 25, texto: '25,0 %' })
  })

  test('sin eventos no inventa un 0 %', () => {
    expect(tasaDeErrores([])).toMatchObject({ total: 0, porcentaje: null, texto: '—' })
    expect(tasaDeErrores(undefined).porcentaje).toBeNull()
  })

  test('sin rechazos es 0 %', () => {
    expect(tasaDeErrores([{ hour: 'h', total: 7, rejected: 0 }]).texto).toBe('0,0 %')
  })

  test('una tasa muy chica no se redondea a cero', () => {
    expect(tasaDeErrores([{ hour: 'h', total: 5000, rejected: 1 }]).texto).toBe('< 0,1 %')
  })
})
