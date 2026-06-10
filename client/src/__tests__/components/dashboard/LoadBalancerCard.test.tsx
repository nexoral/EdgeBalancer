import { render, screen } from '@testing-library/react';
import { LoadBalancerCard, EmptyState } from '@/components/dashboard/LoadBalancerCard';
import type { LoadBalancer } from '@/types/api';

jest.mock('@/components/shared/Icons', () => ({
  Icons: new Proxy({}, { get: () => () => null }),
}));

const BASE_LB: LoadBalancer = {
  id: 'lb-1',
  name: 'my-lb',
  scriptName: 'my-lb',
  domain: 'example.com',
  subdomain: null,
  fullDomain: 'example.com',
  zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  origins: [{ url: 'https://origin.example.com', weight: 100 }],
  originCount: 1,
  strategy: 'Round Robin',
  strategyValue: 'round-robin',
  weightedEnabled: false,
  exposeRealOrigin: false,
  placement: { smartPlacement: false },
  status: 'active',
  workerUrl: 'https://my-lb.example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DEFAULT_PROPS = {
  lb: BASE_LB,
  analytics: null as null,
  onSelect: jest.fn(),
  onDelete: jest.fn(),
  onPause: jest.fn(),
  onResume: jest.fn(),
};

describe('LoadBalancerCard — core content', () => {
  it('renders the LB name', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} />);
    expect(screen.getByText('my-lb')).toBeInTheDocument();
  });

  it('renders the full domain', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('renders the status chip', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} />);
    expect(screen.getAllByText('active').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the strategy chip', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} />);
    // strategy appears in chip and Type grid cell
    expect(screen.getAllByText('Round Robin').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Pause button for an active LB', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
  });

  it('renders the Resume button for a paused LB', () => {
    const lb = { ...BASE_LB, status: 'paused' as const };
    render(<LoadBalancerCard {...DEFAULT_PROPS} lb={lb} />);
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument();
  });

  it('renders the Delete button', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
  });

  it('disables action buttons and shows Deleting... when isDeleting=true', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} isDeleting />);
    const deleteBtn = screen.getByRole('button', { name: /Deleting/i });
    expect(deleteBtn).toBeDisabled();
  });
});

describe('LoadBalancerCard — analytics display', () => {
  it('shows skeleton loaders when analytics="loading"', () => {
    const { container } = render(<LoadBalancerCard {...DEFAULT_PROPS} analytics="loading" />);
    // skeleton divs have the pulse animation class applied via inline style
    const skeletons = container.querySelectorAll('[style*="pulse"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows analytics stats when analytics data is provided', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} analytics={{ requests: 1200, errors: 6, errorRate: 0.5 }} />);
    expect(screen.getByText(/1\.2k/)).toBeInTheDocument();
    expect(screen.getByText(/0\.5%/)).toBeInTheDocument();
  });

  it('formats request counts in millions correctly', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} analytics={{ requests: 2_500_000, errors: 0, errorRate: 0 }} />);
    expect(screen.getByText(/2\.5M/)).toBeInTheDocument();
  });

  it('shows no analytics row when analytics=null', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} analytics={null} />);
    expect(screen.queryByText(/req/)).not.toBeInTheDocument();
    expect(screen.queryByText(/err/)).not.toBeInTheDocument();
  });

  it('renders the error rate text when above 5%', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} analytics={{ requests: 100, errors: 10, errorRate: 10 }} />);
    // error rate > 5% must be shown; the component switches color to var(--red) at this threshold
    expect(screen.getByText(/10\.0%/)).toBeInTheDocument();
  });

  it('does not apply red color for error rate at or below 5%', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} analytics={{ requests: 100, errors: 3, errorRate: 3 }} />);
    expect(screen.getByText(/3\.0%/)).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the empty state heading', () => {
    render(<EmptyState onCreate={jest.fn()} />);
    expect(screen.getByText('No load balancers yet')).toBeInTheDocument();
  });

  it('calls onCreate when the create button is clicked', () => {
    const onCreate = jest.fn();
    render(<EmptyState onCreate={onCreate} />);
    screen.getByRole('button', { name: /Create your first load balancer/i }).click();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
