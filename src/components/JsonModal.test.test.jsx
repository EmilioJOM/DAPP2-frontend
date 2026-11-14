import { fireEvent, render, screen, within } from '@testing-library/react';
import JsonModal from './JsonModal';

describe('JsonModal', () => {
  const data = { eventType: 'PedidoCreado', payload: { id: 42 }, tags: ['nuevo'] };

  afterEach(() => jest.restoreAllMocks());

  test('T-034: con data null no muestra contenido ni escucha Escape', () => {
    const onClose = jest.fn();
    const { container } = render(<JsonModal data={null} onClose={onClose} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('T-035: muestra eventType y el sobre completo con formato JSON', () => {
    render(<JsonModal data={data} onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog', { name: data.eventType });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: data.eventType })).toBeInTheDocument();
    expect(dialog.querySelector('pre code').textContent).toBe(JSON.stringify(data, null, 2));
  });

  test('T-036: usa el título de respaldo sin eventType', () => {
    render(<JsonModal data={{ payload: {} }} onClose={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Código JSON' })).toBeInTheDocument();
  });

  test('T-037: solo Escape cierra y el listener se elimina al desmontar', () => {
    const onClose = jest.fn();
    const { unmount } = render(<JsonModal data={data} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('T-038: el mouse dentro no cierra y sobre el backdrop sí', () => {
    const onClose = jest.fn();
    render(<JsonModal data={data} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole('heading', { name: data.eventType }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('T-039: ambos botones de cierre ejecutan onClose', () => {
    const onClose = jest.fn();
    render(<JsonModal data={data} onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar' });
    expect(closeButtons).toHaveLength(2);
    closeButtons.forEach((button, index) => {
      fireEvent.click(button);
      expect(onClose).toHaveBeenCalledTimes(index + 1);
    });
  });

  test('T-040: copia el sobre completo al portapapeles', () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const onClose = jest.fn();
      render(<JsonModal data={data} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Copiar JSON' }));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else delete navigator.clipboard;
    }
  });
});
