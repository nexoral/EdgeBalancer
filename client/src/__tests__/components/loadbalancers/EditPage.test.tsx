import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditLoadBalancerPage from '@/app/loadbalancers/[id]/edit/page';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({ useRouter: jest.fn(), useParams: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/api', () => ({ api: { getLoadBalancer: jest.fn(), updateLoadBalancer: jest.fn() } }));
jest.mock('react-hot-toast', () => ({ default: { error: jest.fn(), success: jest.fn() } }));

jest.mock('@/components/dashboard/Sidebar', () => ({
  Sidebar: () => null,
  Topbar: ({ actions }: any) => <div data-testid="topbar">{actions}</div>,
}));

jest.mock('@/components/loadbalancers/DeploymentExperience', () => ({
  DeploymentOverlay: () => null,
  DeploymentSuccessModal: () => null,
}));

jest.mock('@/components/ui/MultiSelect', () => ({ MultiSelect: () => null }));

jest.mock('@/components/loadbalancers/LoadBalancerVisualization', () => ({
  LoadBalancerVisualization: () => null,
}));

jest.mock('@/lib/geoData', () => ({
  CONTINENTS: [],
  COUNTRIES: [],
  getCitiesByCountry: jest.fn().mockReturnValue([]),
  getSubdivisionsByCountry: jest.fn().mockReturnValue([]),
  CITIES_BY_SUBDIVISION: {},
  getFlagEmoji: jest.fn().mockReturnValue(''),
}));

jest.mock('@/lib/cloudRegions', () => ({
  ALL_CLOUD_REGIONS: [],
  REGIONS_BY_PROVIDER: { aws: [], gcp: [], azure: [] },
}));

jest.mock('@/components/shared/Icons', () => ({
  Icons: new Proxy({}, { get: () => () => null }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseParams = useParams as jest.MockedFunction<typeof useParams>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockApi = api as jest.Mocked<typeof api>;

const AUTHED_USER = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  username: 'alice',
  hasCloudflareCredentials: true,
};

const BASE_LB = {
  id: 'lb-1',
  name: 'my-lb',
  scriptName: 'my-lb',
  domain: 'example.com',
  subdomain: null,
  fullDomain: 'example.com',
  zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  origins: [{ url: 'https://origin.example.com', weight: 100 }],
  strategy: 'Round Robin',
  strategyValue: 'round-robin' as const,
  weightedEnabled: false,
  exposeRealOrigin: false,
  placement: { smartPlacement: false },
  status: 'active',
  workerUrl: 'https://my-lb.example.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  mockUseRouter.mockReturnValue({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() } as any);
  mockUseParams.mockReturnValue({ id: 'lb-1' });
  mockUseAuth.mockReturnValue({ user: AUTHED_USER, loading: false, logout: jest.fn() } as any);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EditLoadBalancerPage — exposeRealOrigin toggle', () => {
  it('renders Expose Real Origin toggle after loading', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: BASE_LB },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    await waitFor(() => expect(screen.getByText('Expose Real Origin')).toBeInTheDocument());
  });

  it('initializes checkbox as unchecked when lb.exposeRealOrigin is false', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: { ...BASE_LB, exposeRealOrigin: false } },
      message: 'ok',
    });

    const { container } = render(<EditLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const exposeCheckbox = Array.from(checkboxes).find(
      cb => cb.closest('label')?.textContent?.includes('Expose Real Origin')
    );
    expect(exposeCheckbox?.checked).toBe(false);
  });

  it('initializes checkbox as checked when lb.exposeRealOrigin is true', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: { ...BASE_LB, exposeRealOrigin: true } },
      message: 'ok',
    });

    const { container } = render(<EditLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const exposeCheckbox = Array.from(checkboxes).find(
      cb => cb.closest('label')?.textContent?.includes('Expose Real Origin')
    );
    expect(exposeCheckbox?.checked).toBe(true);
  });

  it('toggling the checkbox flips the checked state', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: { ...BASE_LB, exposeRealOrigin: false } },
      message: 'ok',
    });

    const { container } = render(<EditLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const exposeCheckbox = Array.from(checkboxes).find(
      cb => cb.closest('label')?.textContent?.includes('Expose Real Origin')
    )!;

    expect(exposeCheckbox.checked).toBe(false);
    fireEvent.change(exposeCheckbox, { target: { checked: true } });
    await waitFor(() => expect(exposeCheckbox.checked).toBe(true));
  });

  it('renders toggle description text', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: BASE_LB },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    await waitFor(() =>
      expect(screen.getByText(/Pass the browser.*real Origin header/i)).toBeInTheDocument()
    );
  });
});
