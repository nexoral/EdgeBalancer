import { render, screen, fireEvent } from '@testing-library/react';
import { SessionCard, SessionsEmptyState } from '@/components/dashboard/SessionCard';
import type { Session } from '@/types/api';

const BASE_SESSION: Session = {
  _id: 'session-id-1',
  loadBalancerName: 'my-lb',
  domain: 'example.com',
  subdomain: null,
  strategy: 'round-robin',
  actionType: 'create',
  isActive: true,
  loadBalancerId: 'lb-id-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('SessionCard', () => {
  it('renders load balancer name and domain', () => {
    render(<SessionCard session={BASE_SESSION} onDownload={jest.fn()} />);
    expect(screen.getByText('my-lb')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('renders subdomain.domain when subdomain is present', () => {
    const session = { ...BASE_SESSION, subdomain: 'api' };
    render(<SessionCard session={session} onDownload={jest.fn()} />);
    expect(screen.getByText('api.example.com')).toBeInTheDocument();
  });

  it('renders "active" badge when isActive is true', () => {
    render(<SessionCard session={BASE_SESSION} onDownload={jest.fn()} />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders "inactive" badge when isActive is false', () => {
    const session = { ...BASE_SESSION, isActive: false };
    render(<SessionCard session={session} onDownload={jest.fn()} />);
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('renders actionType badge (create)', () => {
    render(<SessionCard session={BASE_SESSION} onDownload={jest.fn()} />);
    // 'create' appears in both the chip badge and the Action metadata cell
    expect(screen.getAllByText('create').length).toBeGreaterThanOrEqual(1);
  });

  it('renders actionType badge (edit)', () => {
    const session = { ...BASE_SESSION, actionType: 'edit' as const };
    render(<SessionCard session={session} onDownload={jest.fn()} />);
    expect(screen.getAllByText('edit').length).toBeGreaterThanOrEqual(1);
  });

  it('renders strategy in metadata grid', () => {
    render(<SessionCard session={BASE_SESSION} onDownload={jest.fn()} />);
    expect(screen.getByText('round-robin')).toBeInTheDocument();
  });

  it('shows Download Script button for active sessions', () => {
    render(<SessionCard session={BASE_SESSION} onDownload={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Download Script/i })).toBeInTheDocument();
  });

  it('does not show Download Script button for inactive sessions', () => {
    const session = { ...BASE_SESSION, isActive: false };
    render(<SessionCard session={session} onDownload={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /Download Script/i })).not.toBeInTheDocument();
  });

  it('calls onDownload when Download Script is clicked', () => {
    const onDownload = jest.fn();
    render(<SessionCard session={BASE_SESSION} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: /Download Script/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('disables download button and shows fetching text while downloading', () => {
    render(<SessionCard session={BASE_SESSION} onDownload={jest.fn()} isDownloading />);
    const btn = screen.getByRole('button', { name: /Fetching/i });
    expect(btn).toBeDisabled();
  });

  it('does not fire onDownload when button is disabled', () => {
    const onDownload = jest.fn();
    render(<SessionCard session={BASE_SESSION} onDownload={onDownload} isDownloading />);
    fireEvent.click(screen.getByRole('button', { name: /Fetching/i }));
    expect(onDownload).not.toHaveBeenCalled();
  });
});

describe('SessionsEmptyState', () => {
  it('renders empty state message', () => {
    render(<SessionsEmptyState />);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    expect(screen.getByText(/Sessions are recorded automatically/i)).toBeInTheDocument();
  });
});
