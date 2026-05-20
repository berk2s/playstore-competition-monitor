import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  api: {
    listApps: vi.fn(),
    createApp: vi.fn(),
    deleteApp: vi.fn(),
  },
}));

const { api } = await import('@/lib/api');
const AppListPage = (await import('./page')).default;

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const sampleApp = {
  id: 'a1',
  packageName: 'com.example.app',
  playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
  title: 'Example',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lastCapturedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppListPage', () => {
  it('renders the tracked apps returned by the api', async () => {
    vi.mocked(api.listApps).mockResolvedValue([sampleApp]);

    renderWithClient(<AppListPage />);

    expect(await screen.findByText('Example')).toBeInTheDocument();
    expect(screen.getByText('com.example.app')).toBeInTheDocument();
    expect(screen.getByText('No captures yet')).toBeInTheDocument();
  });

  it('shows the empty state when there are no apps', async () => {
    vi.mocked(api.listApps).mockResolvedValue([]);

    renderWithClient(<AppListPage />);

    expect(await screen.findByText(/No apps tracked yet/i)).toBeInTheDocument();
  });

  it('submits the add form and clears inputs on success', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listApps).mockResolvedValue([]);
    vi.mocked(api.createApp).mockResolvedValue({
      ...sampleApp,
      id: 'new',
      packageName: 'com.new.app',
      title: 'New',
    });

    renderWithClient(<AppListPage />);

    const urlInput = await screen.findByLabelText(/Play Store URL/i);
    const titleInput = screen.getByLabelText(/Title/i);
    const submit = screen.getByRole('button', { name: /Add app/i });

    await user.type(urlInput, 'https://play.google.com/store/apps/details?id=com.new.app');
    await user.type(titleInput, 'New');
    await user.click(submit);

    await waitFor(() => {
      expect(api.createApp).toHaveBeenCalledWith({
        playUrl: 'https://play.google.com/store/apps/details?id=com.new.app',
        title: 'New',
      });
    });
    await waitFor(() => {
      expect((urlInput as HTMLInputElement).value).toBe('');
      expect((titleInput as HTMLInputElement).value).toBe('');
    });
  });

  it('surfaces the api error message on create failure', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listApps).mockResolvedValue([]);
    vi.mocked(api.createApp).mockRejectedValue({
      response: { data: { message: 'This app is already being tracked' } },
    });

    renderWithClient(<AppListPage />);

    await user.type(
      await screen.findByLabelText(/Play Store URL/i),
      'https://play.google.com/store/apps/details?id=com.dup.app',
    );
    await user.click(screen.getByRole('button', { name: /Add app/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already being tracked/i,
    );
  });

  it('removes an app after confirm', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listApps).mockResolvedValue([sampleApp]);
    vi.mocked(api.deleteApp).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithClient(<AppListPage />);

    const item = (await screen.findByText('Example')).closest('li')!;
    const removeBtn = within(item).getByRole('button', { name: /Remove/i });
    await user.click(removeBtn);

    await waitFor(() => {
      expect(api.deleteApp).toHaveBeenCalledWith('a1');
    });
  });

  it('does not remove when confirm is declined', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listApps).mockResolvedValue([sampleApp]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithClient(<AppListPage />);

    const item = (await screen.findByText('Example')).closest('li')!;
    await user.click(within(item).getByRole('button', { name: /Remove/i }));

    expect(api.deleteApp).not.toHaveBeenCalled();
  });
});
