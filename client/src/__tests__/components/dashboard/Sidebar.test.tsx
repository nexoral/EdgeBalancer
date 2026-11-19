import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/dashboard/Sidebar';

jest.mock('@/components/shared/Icons', () => ({
  Icons: new Proxy({}, { get: () => (props: any) => null }),
}));

jest.mock('@/components/shared/Logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

const baseProps = {
  onNav: jest.fn(),
  onLogout: jest.fn(),
  userEmail: 'alice@example.com',
  hasCloudflareCredentials: true,
  cloudflareOAuthConnected: true,
  isReady: true,
};

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(<Sidebar current="balancers" {...baseProps} />);
    expect(screen.getAllByText('Load Balancers').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Deployment History').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI Runs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
  });

  it('marks AI Runs as active when current="ai-runs"', () => {
    render(<Sidebar current="ai-runs" {...baseProps} />);
    const btn = screen.getAllByText('AI Runs')[0].closest('button');
    expect(btn).toHaveStyle('font-weight: 500');
  });

  it('does NOT mark AI Runs as active when current="balancers"', () => {
    render(<Sidebar current="balancers" {...baseProps} />);
    const btn = screen.getAllByText('AI Runs')[0].closest('button');
    expect(btn).toHaveStyle('font-weight: 400');
  });

  it('calls onNav with "ai-runs" when AI Runs is clicked', () => {
    const onNav = jest.fn();
    render(<Sidebar current="ai-runs" {...baseProps} onNav={onNav} />);
    fireEvent.click(screen.getAllByText('AI Runs')[0]);
    expect(onNav).toHaveBeenCalledWith('ai-runs');
  });

  it('shows "Cloudflare Connected" when credentials are present', () => {
    render(<Sidebar current="balancers" {...baseProps} hasCloudflareCredentials={true} />);
    expect(screen.getAllByText('Cloudflare Connected').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Cloudflare Not Connected" when credentials are absent', () => {
    render(<Sidebar current="balancers" {...baseProps} hasCloudflareCredentials={false} />);
    expect(screen.getAllByText('Cloudflare Not Connected').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onLogout when Log out is clicked', () => {
    const onLogout = jest.fn();
    render(<Sidebar current="balancers" {...baseProps} onLogout={onLogout} />);
    fireEvent.click(screen.getAllByText('Log out')[0]);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
