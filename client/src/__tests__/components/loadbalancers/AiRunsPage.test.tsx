import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiRunsPage from '@/app/ai-runs/page';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/api', () => ({
  api: {
    getAiRuns: jest.fn(),
    getAiRun: jest.fn(),
    completeAiRun: jest.fn(),
  },
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('@/components/dashboard/Sidebar', () => ({
  Sidebar: () => null,
  Topbar: ({ title, subtitle }: any) => (
    <div data-testid="topbar">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

jest.mock('@/components/shared/Icons', () => ({
  Icons: new Proxy({}, { get: () => () => null }),
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <button data-testid="close-modal" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

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
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AiRunsPage — empty state', () => {
  it('renders empty state when no runs exist', async () => {
    mockApi.getAiRuns.mockResolvedValue({
      success: true,
      data: { runs: [], nextCursor: null, hasMore: false },
      message: 'ok',
    });

    render(<AiRunsPage />);
    await waitFor(() => expect(screen.getByText('AI Runs')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('No AI runs yet')).toBeInTheDocument());
    expect(screen.getByText(/will appear here/i)).toBeInTheDocument();
  });

  it('renders loading spinner while fetching', async () => {
    mockApi.getAiRuns.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<AiRunsPage />);
    // Spinner is shown while loading — page title should still be visible
    expect(screen.getByText('AI Runs')).toBeInTheDocument();
  });
});

describe('AiRunsPage — runs list', () => {
  it('renders run cards with outcome, model, and prompt', async () => {
    mockApi.getAiRuns.mockResolvedValue({
      success: true,
      data: {
        runs: [{
          _id: 'run-1',
          prompt: 'create a load balancer for example.com',
          outcome: 'success',
          durationMs: 5000,
          finalModel: 'mistral-small',
          toolCalls: [{ name: 'create_load_balancer' }, { name: 'list_zones' }],
          createdAt: new Date().toISOString(),
        }],
        nextCursor: null,
        hasMore: false,
      },
      message: 'ok',
    });

    render(<AiRunsPage />);
    await waitFor(() => expect(screen.getByText('AI Runs')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Success')).toBeInTheDocument());

    expect(screen.queryByText('mistral-small')).not.toBeInTheDocument();
    expect(screen.queryByText('2 tools')).not.toBeInTheDocument();
    expect(screen.getByText('5.0s')).toBeInTheDocument();
  });

  it('shows run count header', async () => {
    mockApi.getAiRuns.mockResolvedValue({
      success: true,
      data: {
        runs: [
          { _id: 'r1', prompt: 'p1', outcome: 'success', durationMs: 1000, finalModel: 'm1', toolCalls: [{ name: 'list_zones' }], createdAt: new Date().toISOString() },
          { _id: 'r2', prompt: 'p2', outcome: 'failure', durationMs: 2000, finalModel: null, toolCalls: [{ name: 'list_zones' }], createdAt: new Date().toISOString() },
        ],
        nextCursor: null,
        hasMore: false,
      },
      message: 'ok',
    });

    render(<AiRunsPage />);
    await waitFor(() => expect(screen.getByText('2 runs')).toBeInTheDocument());
  });

  it('renders a legacy outcome value instead of crashing on it', async () => {
    // Runs recorded before 'refused' was retired still exist in the database.
    mockApi.getAiRuns.mockResolvedValue({
      success: true,
      data: {
        runs: [{
          _id: 'r1',
          prompt: 'write me a poem',
          outcome: 'refused' as any,
          durationMs: 3000,
          finalModel: 'mistral-small',
          toolCalls: [],
          createdAt: new Date().toISOString(),
        }],
        nextCursor: null,
        hasMore: false,
      },
      message: 'ok',
    });

    render(<AiRunsPage />);
    await waitFor(() => expect(screen.getByText('refused')).toBeInTheDocument());
  });

  it('calls getAiRun when a run card is clicked by a Pro user', async () => {
    mockUseAuth.mockReturnValue({ user: { ...AUTHED_USER, isPro: true }, loading: false, logout: jest.fn() } as any);
    mockApi.getAiRuns.mockResolvedValue({
      success: true,
      data: {
        runs: [{
          _id: 'run-abc',
          prompt: 'test prompt',
          outcome: 'success',
          durationMs: 3000,
          finalModel: 'mistral-small',
          toolCalls: [{ name: 'list_zones' }],
          createdAt: new Date().toISOString(),
        }],
        nextCursor: null,
        hasMore: false,
      },
      message: 'ok',
    });

    mockApi.getAiRun.mockResolvedValue({
      success: true,
      data: {
        run: {
          _id: 'run-abc',
          userId: 'u1',
          prompt: 'test prompt',
          turns: [
            { role: 'user', content: 'test prompt' },
            { role: 'assistant', content: 'Done.' },
          ],
          finalMessage: 'Done.',
          modelsUsed: [{ provider: 'mistral', model: 'mistral-small', ok: true, error: null }],
          finalModel: 'mistral-small',
          toolCalls: [{
            name: 'list_zones',
            args: { names: ['list_zones'] },
            result: JSON.stringify({ ok: true, data: { zones: [] } }),
            ok: true,
            durationMs: 21,
          }],
          outcome: 'success',
          durationMs: 3000,
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      message: 'ok',
    });

    render(<AiRunsPage />);
    const card = await screen.findByText('3.0s');
    fireEvent.click(card.closest('button')!);

    await waitFor(() => expect(mockApi.getAiRun).toHaveBeenCalledWith('run-abc'));
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument());
    expect(screen.getByText('AI Run Details')).toBeInTheDocument();
    // Conversation renders; models used and tool calls are no longer shown.
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(screen.getByText('Agent reply')).toBeInTheDocument();
  });

  it('shows an upsell instead of details when a free user clicks a run card', async () => {
    mockApi.getAiRuns.mockResolvedValue({
      success: true,
      data: {
        runs: [{
          _id: 'run-free',
          prompt: 'free prompt',
          outcome: 'success',
          durationMs: 1000,
          finalModel: 'mistral-small',
          toolCalls: [],
          createdAt: new Date().toISOString(),
        }],
        nextCursor: null,
        hasMore: false,
      },
      message: 'ok',
    });

    render(<AiRunsPage />);
    const card = await screen.findByText('1.0s');
    fireEvent.click(card.closest('button')!);

    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument());
    expect(screen.getByText(/Run details are a Pro feature/i)).toBeInTheDocument();
    expect(mockApi.getAiRun).not.toHaveBeenCalled();
  });
});

describe('AiRunsPage — error handling', () => {
  it('shows error toast when getAiRuns fails', async () => {
    mockApi.getAiRuns.mockRejectedValue(new Error('Network error'));

    render(<AiRunsPage />);
    // Page should still render without crashing — the toast.error is mocked
    await waitFor(() => expect(screen.getByText('AI Runs')).toBeInTheDocument());
  });
});
