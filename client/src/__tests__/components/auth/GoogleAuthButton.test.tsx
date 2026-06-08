import { render, screen, fireEvent } from '@testing-library/react';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { isFirebaseConfigured } from '@/lib/firebase';

jest.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));

const mockIsFirebaseConfigured = isFirebaseConfigured as jest.MockedFunction<typeof isFirebaseConfigured>;

describe('GoogleAuthButton', () => {
  it('does not render when Firebase is not configured', () => {
    mockIsFirebaseConfigured.mockReturnValue(false);
    const { container } = render(
      <GoogleAuthButton label="Sign in with Google" onClick={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the button when Firebase is configured', () => {
    mockIsFirebaseConfigured.mockReturnValue(true);
    render(<GoogleAuthButton label="Sign in with Google" onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    mockIsFirebaseConfigured.mockReturnValue(true);
    const onClick = jest.fn().mockResolvedValue(undefined);
    render(<GoogleAuthButton label="Continue with Google" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows "Please wait..." and disables button when busy', () => {
    mockIsFirebaseConfigured.mockReturnValue(true);
    render(<GoogleAuthButton label="Sign in with Google" onClick={jest.fn()} busy />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });
});
