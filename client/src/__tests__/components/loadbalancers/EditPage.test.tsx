import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditLoadBalancerPage from '@/app/loadbalancers/[id]/edit/page';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({ useRouter: jest.fn(), useParams: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/api', () => ({ api: { getLoadBalancer: jest.fn(), updateLoadBalancer: jest.fn(), getOriginIp: jest.fn() } }));
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
  corsEnabled: false,
  corsOrigins: [] as string[],
  ipOriginRecords: [] as Array<{ originalUrl: string; hostname: string; dnsRecordId: string }>,
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

// ─── CORS toggle ──────────────────────────────────────────────────────────────

describe('EditLoadBalancerPage — CORS toggle', () => {
  it('renders "Worker CORS" label after loading', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: BASE_LB },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    await waitFor(() => expect(screen.getByText('Worker CORS')).toBeInTheDocument());
  });

  it('CORS toggle initializes from lb.corsEnabled (false → unchecked)', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: { ...BASE_LB, corsEnabled: false } },
      message: 'ok',
    });

    const { container } = render(<EditLoadBalancerPage />);
    await waitFor(() => screen.getByText('Worker CORS'));

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const corsCheckbox = Array.from(checkboxes).find(cb =>
      cb.closest('label')?.textContent?.includes('Worker CORS')
    );
    expect(corsCheckbox).toBeDefined();
    expect(corsCheckbox?.checked).toBe(false);
  });

  it('CORS toggle initializes from lb.corsEnabled (true → checked)', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: { ...BASE_LB, corsEnabled: true } },
      message: 'ok',
    });

    const { container } = render(<EditLoadBalancerPage />);
    await waitFor(() => screen.getByText('Worker CORS'));

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const corsCheckbox = Array.from(checkboxes).find(cb =>
      cb.closest('label')?.textContent?.includes('Worker CORS')
    );
    expect(corsCheckbox).toBeDefined();
    expect(corsCheckbox?.checked).toBe(true);
  });
});

// ─── ipOriginRecords banner ───────────────────────────────────────────────────

describe('EditLoadBalancerPage — ipOriginRecords banner', () => {
  it('shows no banner when ipOriginRecords is empty', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: { ...BASE_LB, ipOriginRecords: [] } },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    expect(screen.queryByText(/auto-converted/i)).not.toBeInTheDocument();
  });

  it('shows banner with originalUrl and hostname when ipOriginRecords has entries', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: {
        loadBalancer: {
          ...BASE_LB,
          origins: [{ url: 'https://my-lb-o1.example.com', weight: 100 }],
          ipOriginRecords: [
            { originalUrl: 'http://1.2.3.4', hostname: 'my-lb-o1.example.com', dnsRecordId: 'rec-1' },
          ],
        },
      },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    await waitFor(() => expect(screen.getByText(/auto-converted/i)).toBeInTheDocument());

    expect(screen.getByText(/http:\/\/1\.2\.3\.4/)).toBeInTheDocument();
    expect(screen.getByText(/my-lb-o1\.example\.com/)).toBeInTheDocument();
  });
});

// ─── Show IP / Show Domain toggle ─────────────────────────────────────────────

describe('EditLoadBalancerPage — Show IP / Show Domain toggle', () => {
  const LB_WITH_IP_RECORD = {
    ...BASE_LB,
    origins: [{ url: 'http://my-lb-o1.example.com', weight: 100 }],
    ipOriginRecords: [
      { originalUrl: 'http://1.2.3.4', hostname: 'my-lb-o1.example.com', dnsRecordId: 'rec-1' },
    ],
  };

  it('shows "Show IP" button for an origin whose hostname matches an ipOriginRecords entry', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: LB_WITH_IP_RECORD },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /show ip/i })).toBeInTheDocument());
  });

  it('calls api.getOriginIp with correct lbId and hostname when "Show IP" is clicked', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: LB_WITH_IP_RECORD },
      message: 'ok',
    });
    mockApi.getOriginIp.mockResolvedValue({
      success: true,
      data: { originalUrl: 'http://1.2.3.4' },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    const showIpBtn = await screen.findByRole('button', { name: /show ip/i });
    fireEvent.click(showIpBtn);

    await waitFor(() => {
      expect(mockApi.getOriginIp).toHaveBeenCalledWith('lb-1', 'my-lb-o1.example.com');
    });
  });

  it('shows the original IP after getOriginIp resolves', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: LB_WITH_IP_RECORD },
      message: 'ok',
    });
    mockApi.getOriginIp.mockResolvedValue({
      success: true,
      data: { originalUrl: 'http://1.2.3.4' },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    const showIpBtn = await screen.findByRole('button', { name: /show ip/i });
    fireEvent.click(showIpBtn);

    await waitFor(() => expect(screen.getByText(/1\.2\.3\.4/)).toBeInTheDocument());
  });

  it('shows "Show Domain" button after IP is revealed, and clicking it hides the IP', async () => {
    mockApi.getLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: LB_WITH_IP_RECORD },
      message: 'ok',
    });
    mockApi.getOriginIp.mockResolvedValue({
      success: true,
      data: { originalUrl: 'http://1.2.3.4' },
      message: 'ok',
    });

    render(<EditLoadBalancerPage />);
    const showIpBtn = await screen.findByRole('button', { name: /show ip/i });
    fireEvent.click(showIpBtn);

    // Wait for IP details to appear — at this point there will be two "Show Domain" buttons:
    // one in the input row and one in the IP details card
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /show domain/i });
      expect(btns.length).toBeGreaterThan(0);
    });

    // Click the first Show Domain button (the one in the details card)
    const showDomainBtns = screen.getAllByRole('button', { name: /show domain/i });
    fireEvent.click(showDomainBtns[0]);
    await waitFor(() =>
      expect(screen.queryByText(/Original IP:/)).not.toBeInTheDocument()
    );
  });
});
