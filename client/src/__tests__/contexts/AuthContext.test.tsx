import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    getCurrentUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    googleAuth: jest.fn(),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  googleAuthProvider: {},
  isFirebaseConfigured: jest.fn().mockReturnValue(false),
}));

jest.mock('firebase/auth', () => ({
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

const mockApi = api as jest.Mocked<typeof api>;

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading</div>;
  if (!user) return <div>No user</div>;
  return <div>User: {user.name}</div>;
}

const fakeUser = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  username: 'alice',
  hasCloudflareCredentials: false,
};

describe('AuthContext', () => {
  it('throws when useAuth is used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });

  it('starts with loading=true, then resolves to no-user when checkAuth fails', async () => {
    mockApi.getCurrentUser.mockRejectedValueOnce(new Error('Not authenticated'));
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No user')).toBeInTheDocument());
  });

  it('sets user after successful checkAuth', async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      success: true,
      data: { user: fakeUser },
      message: 'ok',
    });
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('User: Alice')).toBeInTheDocument());
  });

  it('login() sets user on success', async () => {
    mockApi.getCurrentUser.mockRejectedValueOnce(new Error('Not authenticated'));
    mockApi.login.mockResolvedValueOnce({
      success: true,
      data: { user: fakeUser },
      message: 'ok',
    });

    function LoginTester() {
      const { user, loading, login } = useAuth();
      if (loading) return <div>Loading</div>;
      return (
        <div>
          {user ? <span>User: {user.name}</span> : <button onClick={() => login('a@b.com', 'pass')}>Login</button>}
        </div>
      );
    }

    render(<AuthProvider><LoginTester /></AuthProvider>);
    await waitFor(() => screen.getByRole('button', { name: 'Login' }));

    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click();
    });

    await waitFor(() => expect(screen.getByText('User: Alice')).toBeInTheDocument());
  });

  it('logout() clears user', async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      success: true,
      data: { user: fakeUser },
      message: 'ok',
    });
    mockApi.logout.mockResolvedValueOnce({ success: true, message: 'ok' });

    function LogoutTester() {
      const { user, loading, logout } = useAuth();
      if (loading) return <div>Loading</div>;
      return (
        <div>
          {user
            ? <button onClick={() => logout()}>Logout</button>
            : <span>Logged out</span>}
        </div>
      );
    }

    render(<AuthProvider><LogoutTester /></AuthProvider>);
    await waitFor(() => screen.getByRole('button', { name: 'Logout' }));

    await act(async () => {
      screen.getByRole('button', { name: 'Logout' }).click();
    });

    await waitFor(() => expect(screen.getByText('Logged out')).toBeInTheDocument());
    expect(mockApi.logout).toHaveBeenCalledTimes(1);
  });

  it('register() calls api.register', async () => {
    mockApi.getCurrentUser.mockRejectedValueOnce(new Error('Not authenticated'));
    mockApi.register.mockResolvedValueOnce({ success: true, message: 'ok' });

    function RegisterTester() {
      const { loading, register } = useAuth();
      if (loading) return <div>Loading</div>;
      return <button onClick={() => register('Alice', 'a@b.com', 'pass', 'pass')}>Register</button>;
    }

    render(<AuthProvider><RegisterTester /></AuthProvider>);
    await waitFor(() => screen.getByRole('button', { name: 'Register' }));

    await act(async () => {
      screen.getByRole('button', { name: 'Register' }).click();
    });

    expect(mockApi.register).toHaveBeenCalledWith({
      name: 'Alice',
      email: 'a@b.com',
      password: 'pass',
      confirmPassword: 'pass',
    });
  });
});
