import { render, screen } from '@testing-library/react';
import { Logo } from '@/components/shared/Logo';

describe('Logo', () => {
  it('renders the brand text', () => {
    render(<Logo />);
    expect(screen.getByText(/edge/)).toBeInTheDocument();
    expect(screen.getByText(/balancer/)).toBeInTheDocument();
  });

  it('renders an SVG element', () => {
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with custom size without error', () => {
    const { container } = render(<Logo size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });
});
