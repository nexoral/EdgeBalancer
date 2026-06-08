import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders with default variant without error', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with success variant without error', () => {
    const { container } = render(<Badge variant="success">Live</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with destructive variant without error', () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with secondary variant without error', () => {
    const { container } = render(<Badge variant="secondary">Paused</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('forwards additional className', () => {
    const { container } = render(<Badge className="custom-class">X</Badge>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
