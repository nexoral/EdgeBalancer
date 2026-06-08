import { render, screen } from '@testing-library/react';
import { AuthLayout } from '@/components/auth/AuthLayout';

describe('AuthLayout', () => {
  const onBack = jest.fn();

  it('renders children in the right panel', () => {
    render(
      <AuthLayout step="register" onBack={onBack}>
        <form><input placeholder="Email" /></form>
      </AuthLayout>
    );
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('renders the three-step progression text', () => {
    render(<AuthLayout step="register" onBack={onBack}><div /></AuthLayout>);
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByText('Connect Cloudflare')).toBeInTheDocument();
    expect(screen.getByText('Deploy your first balancer')).toBeInTheDocument();
  });

  it('renders a back navigation button', () => {
    render(<AuthLayout step="signin" onBack={onBack}><div /></AuthLayout>);
    const backButtons = screen.getAllByRole('button');
    expect(backButtons.length).toBeGreaterThan(0);
  });
});
