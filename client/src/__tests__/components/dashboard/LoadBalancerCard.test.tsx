import { render, screen, waitFor, act } from '@testing-library/react';
import { LoadBalancerCard, EmptyState } from '@/components/dashboard/LoadBalancerCard';
import { api } from '@/lib/api';
import type { LoadBalancer } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: {
    getLoadBalancerAnalytics: jest.fn(),
  },
}));

jest.mock('@/components/shared/Icons', () => ({
  Icons: new Proxy({}, { get: () => () => null }),
}));

const mockApi = api as jest.Mocked<typeof api>;

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
  onSelect: jest.fn(),
  onDelete: jest.fn(),
  onPause: jest.fn(),
  onResume: jest.fn(),
};

// Flush pending async state updates (analytics useEffect) after each test.
afterEach(async () => {
  await act(async () => {});
});

describe('LoadBalancerCard — core content', () => {
  beforeEach(() => {
    mockApi.getLoadBalancerAnalytics.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { analytics: null },
    });
  });

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
    // status appears in both the chip and the grid cell — use getAllByText
    expect(screen.getAllByText('active').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the strategy chip', () => {
    render(<LoadBalancerCard {...DEFAULT_PROPS} />);
    // strategy text appears in both the chip and the Type grid cell — use getAllByText
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
  it('shows analytics data when API returns it', async () => {
    mockApi.getLoadBalancerAnalytics.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: { analytics: { requests: 1200, errors: 6, errorRate: 0.5 } },
    });

    render(<LoadBalancerCard {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText(/1\.2k/)).toBeInTheDocument();
    });
    expect(screen.getByText(/0\.5%/)).toBeInTheDocument();
  });

  it('formats request counts in millions correctly', async () => {
    mockApi.getLoadBalancerAnalytics.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: { analytics: { requests: 2_500_000, errors: 0, errorRate: 0 } },
    });

    render(<LoadBalancerCard {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText(/2\.5M/)).toBeInTheDocument();
    });
  });

  it('shows no analytics row when API returns null analytics', async () => {
    mockApi.getLoadBalancerAnalytics.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: { analytics: null },
    });

    render(<LoadBalancerCard {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(mockApi.getLoadBalancerAnalytics).toHaveBeenCalled();
    });
    expect(screen.queryByText(/req/)).not.toBeInTheDocument();
    expect(screen.queryByText(/err/)).not.toBeInTheDocument();
  });

  it('shows no analytics row when API call throws', async () => {
    mockApi.getLoadBalancerAnalytics.mockRejectedValueOnce(new Error('Network error'));

    render(<LoadBalancerCard {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(mockApi.getLoadBalancerAnalytics).toHaveBeenCalled();
    });
    expect(screen.queryByText(/req/)).not.toBeInTheDocument();
  });

  it('fetches analytics using the correct LB id', async () => {
    mockApi.getLoadBalancerAnalytics.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: { analytics: null },
    });

    render(<LoadBalancerCard {...DEFAULT_PROPS} lb={{ ...BASE_LB, id: 'lb-xyz' }} />);

    await waitFor(() => {
      expect(mockApi.getLoadBalancerAnalytics).toHaveBeenCalledWith('lb-xyz', '24h');
    });
  });

  it('fetches analytics for each mounted card independently', async () => {
    mockApi.getLoadBalancerAnalytics.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { analytics: null },
    });

    render(<LoadBalancerCard {...DEFAULT_PROPS} lb={{ ...BASE_LB, id: 'lb-a' }} />);
    render(<LoadBalancerCard {...DEFAULT_PROPS} lb={{ ...BASE_LB, id: 'lb-b', name: 'lb-b', scriptName: 'lb-b' }} />);

    await waitFor(() => {
      expect(mockApi.getLoadBalancerAnalytics).toHaveBeenCalledTimes(2);
    });
    expect(mockApi.getLoadBalancerAnalytics).toHaveBeenCalledWith('lb-a', '24h');
    expect(mockApi.getLoadBalancerAnalytics).toHaveBeenCalledWith('lb-b', '24h');
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
