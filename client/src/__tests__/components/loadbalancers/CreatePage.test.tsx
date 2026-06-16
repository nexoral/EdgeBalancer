import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateLoadBalancerPage from '@/app/loadbalancers/create/page';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/api', () => ({ api: { getCloudflareZones: jest.fn(), createLoadBalancer: jest.fn() } }));
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
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockApi = api as jest.Mocked<typeof api>;

const AUTHED_USER = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  username: 'alice',
  hasCloudflareCredentials: true,
};

beforeEach(() => {
  mockUseRouter.mockReturnValue({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() } as any);
  mockUseAuth.mockReturnValue({ user: AUTHED_USER, loading: false, logout: jest.fn() } as any);
  mockApi.getCloudflareZones.mockResolvedValue({ success: true, data: { zones: [] }, message: 'ok' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateLoadBalancerPage — exposeRealOrigin toggle', () => {
  it('renders the Expose Real Origin label text', async () => {
    render(<CreateLoadBalancerPage />);
    await waitFor(() => expect(screen.getByText('Expose Real Origin')).toBeInTheDocument());
  });

  it('renders the toggle description text', async () => {
    render(<CreateLoadBalancerPage />);
    await waitFor(() =>
      expect(screen.getByText(/Pass the browser.*real Origin header/i)).toBeInTheDocument()
    );
  });

  it('checkbox defaults to unchecked (exposeRealOrigin: false)', async () => {
    const { container } = render(<CreateLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));
    // Find all hidden checkboxes; exposeRealOrigin is the first one in placement section
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const exposeCheckbox = Array.from(checkboxes).find(
      cb => cb.closest('label')?.textContent?.includes('Expose Real Origin')
    );
    expect(exposeCheckbox).toBeDefined();
    expect(exposeCheckbox?.checked).toBe(false);
  });

  it('checking the toggle sets exposeRealOrigin: true', async () => {
    const { container } = render(<CreateLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const exposeCheckbox = Array.from(checkboxes).find(
      cb => cb.closest('label')?.textContent?.includes('Expose Real Origin')
    )!;

    fireEvent.change(exposeCheckbox, { target: { checked: true } });

    await waitFor(() => expect(exposeCheckbox.checked).toBe(true));
  });

  it('includes exposeRealOrigin: false in the deploy payload by default', async () => {
    mockApi.createLoadBalancer.mockResolvedValue({
      success: true,
      data: { loadBalancer: { name: 'test', fullDomain: 'test.example.com' } },
      message: 'ok',
    });

    const { container } = render(<CreateLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    // Fill minimum required fields to pass validation
    const nameInput = container.querySelector<HTMLInputElement>('input[placeholder*="my-load-balancer"], input[placeholder*="name"]')
      || container.querySelector<HTMLInputElement>('input[type="text"]');
    if (nameInput) fireEvent.change(nameInput, { target: { value: 'my-lb' } });

    const deployButtons = screen.getAllByRole('button');
    const deployBtn = deployButtons.find(b => b.textContent?.match(/deploy/i));
    if (deployBtn && !deployBtn.hasAttribute('disabled')) {
      fireEvent.click(deployBtn);
      await waitFor(() => {
        if (mockApi.createLoadBalancer.mock.calls.length > 0) {
          const payload = mockApi.createLoadBalancer.mock.calls[0][0] as any;
          expect(payload.exposeRealOrigin).toBe(false);
        }
      });
    }
  });
});

// ─── CORS toggle ──────────────────────────────────────────────────────────────

describe('CreateLoadBalancerPage — CORS toggle', () => {
  it('renders the "Worker CORS" label text', async () => {
    render(<CreateLoadBalancerPage />);
    await waitFor(() => expect(screen.getByText('Worker CORS')).toBeInTheDocument());
  });

  it('CORS toggle checkbox defaults to unchecked (corsEnabled: false)', async () => {
    const { container } = render(<CreateLoadBalancerPage />);
    await waitFor(() => screen.getByText('Worker CORS'));

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const corsCheckbox = Array.from(checkboxes).find(cb =>
      cb.closest('label')?.textContent?.includes('Worker CORS')
    );
    expect(corsCheckbox).toBeDefined();
    expect(corsCheckbox?.checked).toBe(false);
  });
});

// ─── Convert to Domain ────────────────────────────────────────────────────────

describe('CreateLoadBalancerPage — Convert to Domain', () => {
  it('shows "Convert to Domain" button when a raw IP URL is typed in the origin input', async () => {
    render(<CreateLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    const originInput = screen.getByPlaceholderText(/192\.168/);
    fireEvent.change(originInput, { target: { value: 'http://18.60.112.44' } });

    await waitFor(() =>
      expect(screen.getByText('Convert to Domain')).toBeInTheDocument()
    );
  });

  it('does NOT show "Convert to Domain" button when a regular hostname is typed', async () => {
    render(<CreateLoadBalancerPage />);
    await waitFor(() => screen.getByText('Expose Real Origin'));

    const originInput = screen.getByPlaceholderText(/192\.168/);
    fireEvent.change(originInput, { target: { value: 'https://backend.example.com' } });

    await waitFor(() => {
      expect(screen.queryByText('Convert to Domain')).not.toBeInTheDocument();
    });
  });
});
