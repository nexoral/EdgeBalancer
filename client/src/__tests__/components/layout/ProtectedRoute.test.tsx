import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

const mockPush = jest.fn();

beforeEach(() => {
  mockUseRouter.mockReturnValue({ push: mockPush, replace: jest.fn(), refresh: jest.fn() } as any);
});

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as any);
    render(<ProtectedRoute><div>Protected</div></ProtectedRoute>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as any);
    render(<ProtectedRoute><div>Protected</div></ProtectedRoute>);
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test', email: 'a@b.com', username: 'test', hasCloudflareCredentials: true },
      loading: false,
    } as any);
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /onboarding when requireCloudflare=true and no credentials', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test', email: 'a@b.com', username: 'test', hasCloudflareCredentials: false },
      loading: false,
    } as any);
    render(<ProtectedRoute requireCloudflare><div>Protected</div></ProtectedRoute>);
    expect(mockPush).toHaveBeenCalledWith('/onboarding');
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('renders children when requireCloudflare=true and user has credentials', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test', email: 'a@b.com', username: 'test', hasCloudflareCredentials: true },
      loading: false,
    } as any);
    render(<ProtectedRoute requireCloudflare><div>Dashboard</div></ProtectedRoute>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('does not redirect to onboarding when requireCloudflare is not set', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test', email: 'a@b.com', username: 'test', hasCloudflareCredentials: false },
      loading: false,
    } as any);
    render(<ProtectedRoute><div>No Cloudflare Needed</div></ProtectedRoute>);
    expect(mockPush).not.toHaveBeenCalledWith('/onboarding');
    expect(screen.getByText('No Cloudflare Needed')).toBeInTheDocument();
  });
});
