import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    getApp: vi.fn(),
    listScreenshots: vi.fn(),
    triggerCapture: vi.fn(),
  },
}));

const { api } = await import('@/lib/api');
const TimelinePage = (await import('./page')).default;

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

describe('TimelinePage', () => {
  it('renders the app header and an empty state when no screenshots exist', async () => {
    vi.mocked(api.getApp).mockResolvedValue(sampleApp);
    vi.mocked(api.listScreenshots).mockResolvedValue([]);

    renderWithClient(<TimelinePage params={{ id: 'a1' }} />);

    expect(await screen.findByRole('heading', { name: 'Example' })).toBeInTheDocument();
    expect(await screen.findByText(/No screenshots yet/i)).toBeInTheDocument();
  });

  it('renders a success screenshot with its image', async () => {
    vi.mocked(api.getApp).mockResolvedValue(sampleApp);
    vi.mocked(api.listScreenshots).mockResolvedValue([
      {
        id: 's1',
        appId: 'a1',
        status: 'success',
        imageKey: 'apps/a1/x.png',
        imageUrl: 'http://cdn/x.png',
        capturedAt: '2026-02-01T10:00:00.000Z',
        durationMs: 1234,
        error: null,
        metadata: null,
      },
    ]);

    renderWithClient(<TimelinePage params={{ id: 'a1' }} />);

    const img = (await screen.findByRole('img')) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('http://cdn/x.png');
    expect(screen.getByText('success')).toBeInTheDocument();
  });

  it('renders the metadata grid under a successful screenshot', async () => {
    vi.mocked(api.getApp).mockResolvedValue(sampleApp);
    vi.mocked(api.listScreenshots).mockResolvedValue([
      {
        id: 's3',
        appId: 'a1',
        status: 'success',
        imageKey: 'apps/a1/y.png',
        imageUrl: 'http://cdn/y.png',
        capturedAt: '2026-02-02T10:00:00.000Z',
        durationMs: 1000,
        error: null,
        metadata: {
          title: 'Example',
          developer: 'Acme Studios',
          iconUrl: null,
          rating: 4.5,
          ratingCount: 12_345_678,
          installs: '100M+',
          price: 'Free',
          containsAds: true,
          inAppPurchases: true,
          updatedOn: 'Jul 12, 2024',
          version: '1.2.3',
          size: '120 MB',
          minAndroid: 'Android 7.0+',
          whatsNew: 'Bug fixes and improvements.',
          shortDescription: null,
          longDescription: null,
        },
      },
    ]);

    renderWithClient(<TimelinePage params={{ id: 'a1' }} />);

    expect(await screen.findByText('Acme Studios')).toBeInTheDocument();
    expect(screen.getByText('4.5 (12M)')).toBeInTheDocument();
    expect(screen.getByText('100M+')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('Jul 12, 2024')).toBeInTheDocument();
    expect(screen.getByText('Contains ads')).toBeInTheDocument();
    expect(screen.getByText('In-app purchases')).toBeInTheDocument();
    expect(screen.getByText('Bug fixes and improvements.')).toBeInTheDocument();
  });

  it('renders the error message for a failed screenshot', async () => {
    vi.mocked(api.getApp).mockResolvedValue(sampleApp);
    vi.mocked(api.listScreenshots).mockResolvedValue([
      {
        id: 's2',
        appId: 'a1',
        status: 'failed',
        imageKey: null,
        imageUrl: null,
        capturedAt: '2026-02-01T11:00:00.000Z',
        durationMs: null,
        error: 'navigation timed out',
        metadata: null,
      },
    ]);

    renderWithClient(<TimelinePage params={{ id: 'a1' }} />);

    expect(await screen.findByText(/Capture failed:/i)).toBeInTheDocument();
    expect(screen.getByText(/navigation timed out/i)).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('collapses an older screenshot by default and toggles on click', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getApp).mockResolvedValue(sampleApp);
    vi.mocked(api.listScreenshots).mockResolvedValue([
      {
        id: 's-latest',
        appId: 'a1',
        status: 'success',
        imageKey: 'apps/a1/latest.png',
        imageUrl: 'http://cdn/latest.png',
        capturedAt: '2026-02-02T10:00:00.000Z',
        durationMs: 1000,
        error: null,
        metadata: null,
      },
      {
        id: 's-older',
        appId: 'a1',
        status: 'success',
        imageKey: 'apps/a1/older.png',
        imageUrl: 'http://cdn/older.png',
        capturedAt: '2026-02-01T10:00:00.000Z',
        durationMs: 1000,
        error: null,
        metadata: null,
      },
    ]);

    renderWithClient(<TimelinePage params={{ id: 'a1' }} />);

    const imgs = await screen.findAllByRole('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute('src')).toBe('http://cdn/latest.png');

    const olderToggle = screen
      .getAllByRole('button', { expanded: false })
      .find((b) => b.getAttribute('aria-controls') === 'screenshot-s-older')!;
    await user.click(olderToggle);

    await waitFor(() => {
      const srcs = screen.getAllByRole('img').map((i) => i.getAttribute('src'));
      expect(srcs).toContain('http://cdn/older.png');
    });
  });

  it('triggers a capture when the Capture now button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getApp).mockResolvedValue(sampleApp);
    vi.mocked(api.listScreenshots).mockResolvedValue([]);
    vi.mocked(api.triggerCapture).mockResolvedValue({ enqueued: true, jobId: 'j1' });

    renderWithClient(<TimelinePage params={{ id: 'a1' }} />);

    await screen.findByRole('heading', { name: 'Example' });
    await user.click(screen.getByRole('button', { name: /Capture now/i }));

    await waitFor(() => {
      expect(api.triggerCapture).toHaveBeenCalledWith('a1');
    });
  });
});
