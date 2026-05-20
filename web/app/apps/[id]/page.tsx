'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { api } from '@/lib/api';
import type { ListingMetadata } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

function formatCount(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function MetadataGrid({ m }: { m: ListingMetadata }) {
  const facts: Array<{ label: string; value: string }> = [];
  if (m.rating != null) {
    const reviews = formatCount(m.ratingCount);
    facts.push({
      label: 'Rating',
      value: reviews ? `${m.rating.toFixed(1)} (${reviews})` : m.rating.toFixed(1),
    });
  }
  if (m.installs) facts.push({ label: 'Installs', value: m.installs });
  if (m.price) facts.push({ label: 'Price', value: m.price });
  if (m.version) facts.push({ label: 'Version', value: m.version });
  if (m.updatedOn) facts.push({ label: 'Updated', value: m.updatedOn });
  if (m.size) facts.push({ label: 'Size', value: m.size });
  if (m.minAndroid) facts.push({ label: 'Android', value: m.minAndroid });

  const flags: string[] = [];
  if (m.containsAds) flags.push('Contains ads');
  if (m.inAppPurchases) flags.push('In-app purchases');

  if (facts.length === 0 && flags.length === 0 && !m.whatsNew && !m.developer) return null;

  return (
    <CardContent className="space-y-3 border-t bg-muted/30 p-4 text-sm">
      {(m.developer || m.iconUrl) && (
        <div className="flex items-center gap-3">
          {m.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.iconUrl}
              alt=""
              className="h-10 w-10 rounded-lg border bg-background"
              loading="lazy"
            />
          )}
          {m.developer && (
            <span className="font-medium">{m.developer}</span>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="flex items-center gap-1 truncate font-medium">
                {f.label === 'Rating' && <Star className="h-3.5 w-3.5 fill-current" />}
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((flag) => (
            <Badge key={flag} variant="secondary">
              {flag}
            </Badge>
          ))}
        </div>
      )}
      {m.whatsNew && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">What&apos;s new</p>
          <p className="mt-1 whitespace-pre-line text-sm">
            {m.whatsNew.length > 320 ? `${m.whatsNew.slice(0, 320).trimEnd()}…` : m.whatsNew}
          </p>
        </div>
      )}
    </CardContent>
  );
}

export default function TimelinePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();

  const appQuery = useQuery({
    queryKey: ['app', id],
    queryFn: () => api.getApp(id),
    enabled: !!id,
  });

  const screenshotsQuery = useQuery({
    queryKey: ['screenshots', id],
    queryFn: () => api.listScreenshots(id),
    enabled: !!id,
    refetchInterval: 5_000,
  });

  const captureMutation = useMutation({
    mutationFn: () => api.triggerCapture(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['screenshots', id] }),
  });

  const app = appQuery.data;
  const shots = screenshotsQuery.data ?? [];
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  const isExpanded = (shotId: string, isLatest: boolean): boolean => {
    if (shotId in collapsedOverrides) return collapsedOverrides[shotId]!;
    return isLatest;
  };
  const toggle = (shotId: string, currentlyExpanded: boolean) => {
    setCollapsedOverrides((prev) => ({ ...prev, [shotId]: !currentlyExpanded }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-1 text-muted-foreground">
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" /> All apps
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {app?.title ?? app?.packageName ?? '…'}
          </h1>
          {app && <p className="text-sm text-muted-foreground truncate">{app.packageName}</p>}
        </div>
        <Button onClick={() => captureMutation.mutate()} disabled={captureMutation.isPending}>
          <Camera className="mr-2 h-4 w-4" />
          {captureMutation.isPending ? 'Queuing…' : 'Capture now'}
        </Button>
      </div>

      {screenshotsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      )}
      {shots.length === 0 && !screenshotsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">
          No screenshots yet. The first capture is queued — it usually takes ~10–30s.
        </p>
      )}

      <ol className="space-y-6">
        {shots.map((s, i) => {
          const expanded = isExpanded(s.id, i === 0);
          const panelId = `screenshot-${s.id}`;
          const hasImage = s.status === 'success' && !!s.imageUrl;
          return (
            <li key={s.id}>
              <Card className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(s.id, expanded)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between gap-3 border-b px-4 py-2 text-left hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    {new Date(s.capturedAt).toLocaleString()}
                  </span>
                  <Badge variant={s.status === 'success' ? 'success' : 'destructive'}>
                    {s.status}
                  </Badge>
                </button>
                {expanded &&
                  (hasImage ? (
                    <a id={panelId} href={s.imageUrl!} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.imageUrl!}
                        alt={`Screenshot from ${s.capturedAt}`}
                        className="w-full block"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <CardContent
                      id={panelId}
                      className="bg-destructive/10 p-4 text-sm text-destructive"
                    >
                      Capture failed: {s.error ?? 'unknown error'}
                    </CardContent>
                  ))}
                {s.status === 'success' && s.metadata && <MetadataGrid m={s.metadata} />}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
