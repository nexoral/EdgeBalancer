import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

describe('Card compound components', () => {
  it('renders Card with children', () => {
    render(<Card>Card body</Card>);
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('renders CardHeader with children', () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('renders CardTitle as h3', () => {
    render(<CardTitle>My Title</CardTitle>);
    expect(screen.getByRole('heading', { name: 'My Title' })).toBeInTheDocument();
  });

  it('renders CardContent with children', () => {
    render(<CardContent>Some content</CardContent>);
    expect(screen.getByText('Some content')).toBeInTheDocument();
  });

  it('renders the full compound structure together', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Load Balancer</CardTitle>
        </CardHeader>
        <CardContent>Round-robin across 3 origins</CardContent>
      </Card>
    );
    expect(screen.getByText('Load Balancer')).toBeInTheDocument();
    expect(screen.getByText('Round-robin across 3 origins')).toBeInTheDocument();
  });
});
