import { fireEvent, render, screen, within } from '@testing-library/react';
import { ErrorDeCarga, SinDatos } from './Estados';

describe('ErrorDeCarga', () => {
  test('T-029: presenta título, mensaje y pista dentro de una alerta', () => {
    render(
      <ErrorDeCarga
        titulo="No se pudieron cargar los eventos"
        mensaje="El servicio no responde"
        pista="Comprobá la conexión y volvé a intentar"
      />,
    );

    const alerta = within(screen.getByRole('alert'));
    expect(alerta.getByRole('heading', { level: 2, name: 'No se pudieron cargar los eventos' })).toBeVisible();
    expect(alerta.getByText('El servicio no responde')).toBeVisible();
    expect(alerta.getByText('Comprobá la conexión y volvé a intentar')).toBeVisible();
  });

  test('T-030: permite reintentar mediante el callback recibido', () => {
    const onReintentar = jest.fn();
    render(<ErrorDeCarga onReintentar={onReintentar} />);

    const boton = screen.getByRole('button', { name: 'Reintentar' });
    expect(boton).toHaveAttribute('type', 'button');
    expect(onReintentar).not.toHaveBeenCalled();
    fireEvent.click(boton);
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  test('T-031: sin callback muestra el título predeterminado y ninguna acción', () => {
    render(<ErrorDeCarga />);

    expect(screen.getByRole('heading', { level: 2, name: 'No se pudieron traer los datos' })).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('alert').querySelector('p')).toBeNull();
  });
});

describe('SinDatos', () => {
  test('T-032: presenta el título y la descripción con contenido hijo', () => {
    render(
      <SinDatos titulo="No hay eventos">
        No hay resultados para <strong>este período</strong>.
      </SinDatos>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'No hay eventos' })).toBeVisible();
    const descripcion = screen.getByText(/No hay resultados para/);
    expect(descripcion.tagName).toBe('P');
    expect(descripcion).toHaveTextContent('No hay resultados para este período.');
    expect(within(descripcion).getByText('este período')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('T-033: mantiene la semántica y el comportamiento de la acción opcional', () => {
    const onElegir = jest.fn();
    render(
      <SinDatos titulo="Sin suscripciones" accion={<button type="button" onClick={onElegir}>Elegir módulos</button>}>
        Elegí los módulos que querés consultar.
      </SinDatos>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Sin suscripciones' })).toBeVisible();
    expect(screen.getByText('Elegí los módulos que querés consultar.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir módulos' }));
    expect(onElegir).toHaveBeenCalledTimes(1);
  });

  test('omite la descripción y la acción cuando no se proporcionan', () => {
    render(<SinDatos titulo="Sin resultados" />);

    const titulo = screen.getByRole('heading', { level: 2, name: 'Sin resultados' });
    expect(titulo).toBeVisible();
    expect(titulo.parentElement.querySelector('p')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
