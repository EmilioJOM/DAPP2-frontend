import { render, screen } from '@testing-library/react';
import { EsqueletoTabla, EsqueletoKpis, EsqueletoTarjetas } from './Esqueleto';

describe('EsqueletoTabla', () => {
  test('T-024: muestra cinco filas con seis columnas por defecto y anuncia la carga', () => {
    const { container } = render(<EsqueletoTabla />);
    const panel = screen.getByText('Cargando…').closest('section');
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(panel).toHaveAttribute('aria-live', 'polite');
    const filas = container.querySelectorAll('.esqueleto-fila');
    expect(filas).toHaveLength(5);
    filas.forEach((fila) => expect(fila.children).toHaveLength(6));
  });

  test.each([[2, 3], [0, 3], [2, 0]])(
    'T-025: respeta %i filas y %i columnas',
    (filas, columnas) => {
      const { container } = render(<EsqueletoTabla filas={filas} columnas={columnas} />);
      const renglones = container.querySelectorAll('.esqueleto-fila');
      expect(renglones).toHaveLength(filas);
      renglones.forEach((fila) => expect(fila.children).toHaveLength(columnas));
      expect(screen.getByText('Cargando…')).toBeInTheDocument();
    },
  );
});

describe('EsqueletoKpis', () => {
  test.each([[undefined, 4], [2, 2], [0, 0]])(
    'T-026: cantidad %s muestra %i indicadores',
    (cantidad, esperados) => {
      const { container } = render(<EsqueletoKpis cantidad={cantidad} />);
      const grid = container.firstElementChild;
      expect(grid).toHaveAttribute('aria-busy', 'true');
      expect(grid.children).toHaveLength(esperados);
      Array.from(grid.children).forEach((indicador) => {
        expect(indicador).toHaveClass('esqueleto-kpi');
        expect(indicador.children).toHaveLength(3);
      });
    },
  );
});

describe('EsqueletoTarjetas', () => {
  test.each([[undefined, 6], [3, 3], [0, 0]])(
    'T-027: cantidad %s muestra %i tarjetas',
    (cantidad, esperadas) => {
      const { container } = render(<EsqueletoTarjetas cantidad={cantidad} />);
      const grid = container.firstElementChild;
      expect(grid).toHaveAttribute('aria-busy', 'true');
      expect(grid.children).toHaveLength(esperadas);
      Array.from(grid.children).forEach((tarjeta) => {
        expect(tarjeta).toHaveClass('esqueleto');
        expect(tarjeta).toHaveStyle({ height: '150px' });
      });
    },
  );

  test.each([[240, '240px'], [0, '0px'], ['12rem', '12rem']])(
    'T-028: aplica la altura %s a todas las tarjetas',
    (alto, alturaCss) => {
      const { container } = render(<EsqueletoTarjetas cantidad={2} alto={alto} />);
      const tarjetas = container.firstElementChild.children;
      expect(tarjetas).toHaveLength(2);
      Array.from(tarjetas).forEach((tarjeta) => {
        expect(tarjeta).toHaveStyle({ height: alturaCss });
      });
    },
  );
});
