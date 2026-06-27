import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarList } from '@/components/common/SidebarList';

const mockItems = [
  { id: '1', name: 'Madrid', code: 'MAD01' },
  { id: '2', name: 'Barcelona', code: 'BCN01' },
  { id: '3', name: 'Valencia', code: 'VLC01' },
];

describe('SidebarList', () => {
  const defaultProps = {
    items: mockItems,
    selectedId: '',
    isCreating: false,
    searchTerm: '',
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
    title: 'sucursales',
    onSearchChange: vi.fn(),
    onSortChange: vi.fn(),
    onSelect: vi.fn(),
    onNew: vi.fn(),
  };

  it('renderiza la lista de items', () => {
    render(<SidebarList {...defaultProps} />);
    expect(screen.getByText('Madrid')).toBeInTheDocument();
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
    expect(screen.getByText('Valencia')).toBeInTheDocument();
  });

  it('filtra items por busqueda', () => {
    render(<SidebarList {...defaultProps} searchTerm="mad" />);
    expect(screen.getByText('Madrid')).toBeInTheDocument();
    expect(screen.queryByText('Barcelona')).not.toBeInTheDocument();
    expect(screen.queryByText('Valencia')).not.toBeInTheDocument();
  });

  it('filtra items por codigo', () => {
    render(<SidebarList {...defaultProps} searchTerm="BCN" />);
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
    expect(screen.queryByText('Madrid')).not.toBeInTheDocument();
  });

  it('muestra empty state cuando no hay resultados', () => {
    render(<SidebarList {...defaultProps} searchTerm="zzzzz" />);
    expect(screen.getByText('Sin elementos')).toBeInTheDocument();
  });

  it('llama a onSelect al hacer click en un item', async () => {
    const onSelect = vi.fn();
    render(<SidebarList {...defaultProps} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('Madrid'));
    expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
  });

  it('llama a onNew al hacer click en Nuevo', async () => {
    const onNew = vi.fn();
    render(<SidebarList {...defaultProps} onNew={onNew} />);
    await userEvent.click(screen.getByText('Nuevo'));
    expect(onNew).toHaveBeenCalled();
  });

  it('deshabilita boton Nuevo cuando isCreating es true', () => {
    render(<SidebarList {...defaultProps} isCreating={true} />);
    expect(screen.getByText('Nuevo').closest('button')).toBeDisabled();
  });

  it('no muestra boton Nuevo cuando canCreate es false', () => {
    render(<SidebarList {...defaultProps} canCreate={false} />);
    expect(screen.queryByText('Nuevo')).not.toBeInTheDocument();
  });

  it('muestra boton Nuevo cuando canCreate es true (default)', () => {
    render(<SidebarList {...defaultProps} />);
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
  });

  it('resalta el item seleccionado', () => {
    render(<SidebarList {...defaultProps} selectedId="2" />);
    const selectedButton = screen.getByText('Barcelona').closest('button');
    // Selected state should use a subtle surface or ring (monochrome). Check for ring or subtle surface token.
    expect(selectedButton?.className).toMatch(/ring|bg-theme-surface-hover/);
  });

  it('ordena items por nombre asc', () => {
    render(<SidebarList {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const itemButtons = buttons.filter((b) => mockItems.some((i) => b.textContent?.includes(i.name)));
    expect(itemButtons[0]?.textContent).toContain('Barcelona');
    expect(itemButtons[1]?.textContent).toContain('Madrid');
    expect(itemButtons[2]?.textContent).toContain('Valencia');
  });

  it('ordena items por codigo asc', () => {
    render(<SidebarList {...defaultProps} sortBy="code" />);
    const buttons = screen.getAllByRole('button');
    const itemButtons = buttons.filter((b) => mockItems.some((i) => b.textContent?.includes(i.name)));
    expect(itemButtons[0]?.textContent).toContain('Barcelona');
    expect(itemButtons[1]?.textContent).toContain('Madrid');
    expect(itemButtons[2]?.textContent).toContain('Valencia');
  });

  it('ordena items por nombre desc', () => {
    render(<SidebarList {...defaultProps} sortOrder="desc" />);
    const buttons = screen.getAllByRole('button');
    const itemButtons = buttons.filter((b) => mockItems.some((i) => b.textContent?.includes(i.name)));
    expect(itemButtons[0]?.textContent).toContain('Valencia');
    expect(itemButtons[1]?.textContent).toContain('Madrid');
    expect(itemButtons[2]?.textContent).toContain('Barcelona');
  });

  it('llama a onSortChange al hacer click en boton de orden', async () => {
    const onSortChange = vi.fn();
    render(<SidebarList {...defaultProps} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByText('Nombre'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('llama a onSearchChange al escribir en el input', async () => {
    const onSearchChange = vi.fn();
    render(<SidebarList {...defaultProps} onSearchChange={onSearchChange} />);
    await userEvent.type(screen.getByPlaceholderText('Buscar por nombre o código...'), 'mad');
    expect(onSearchChange).toHaveBeenCalledTimes(3);
  });

  it('muestra el contador de items', () => {
    render(<SidebarList {...defaultProps} />);
    expect(screen.getByText('3 sucursales')).toBeInTheDocument();
  });

  it('renderiza con renderItem personalizado', () => {
    render(
      <SidebarList
        {...defaultProps}
        renderItem={(item) => <span data-testid={`custom-${item.id}`}>{item.name.toUpperCase()}</span>}
      />,
    );
    expect(screen.getByTestId('custom-1')).toHaveTextContent('MADRID');
  });
});
