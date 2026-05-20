'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

export default function AppListPage() {
  const qc = useQueryClient();
  const { data: apps, isLoading, error } = useQuery({
    queryKey: ['apps'],
    queryFn: api.listApps,
  });

  const [playUrl, setPlayUrl] = useState('');
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.createApp({ playUrl, title: title || undefined }),
    onSuccess: () => {
      setPlayUrl('');
      setTitle('');
      setFormError(null);
      qc.invalidateQueries({ queryKey: ['apps'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to add app';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteApp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps'] }),
  });

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Track a new app</CardTitle>
          <CardDescription>
            Paste a Google Play listing URL — we&apos;ll start capturing screenshots on a schedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-[1fr_220px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="playUrl">Play Store URL</Label>
              <Input
                id="playUrl"
                type="url"
                required
                placeholder="https://play.google.com/store/apps/details?id=..."
                value={playUrl}
                onChange={(e) => setPlayUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                type="text"
                placeholder="Display name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                {createMutation.isPending ? 'Adding…' : 'Add app'}
              </Button>
            </div>
          </form>
          {formError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {formError}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Tracked apps</h2>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Failed to load apps
          </p>
        )}
        {apps && apps.length === 0 && (
          <p className="text-sm text-muted-foreground">No apps tracked yet. Add one above.</p>
        )}

        <ul className="space-y-2">
          {apps?.map((app) => (
            <li key={app.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/apps/${app.id}`}
                      className="font-medium hover:underline truncate block"
                    >
                      {app.title ?? app.packageName}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">{app.packageName}</div>
                    <div className="text-xs text-muted-foreground/80 mt-0.5">
                      {app.lastCapturedAt
                        ? `Last capture: ${new Date(app.lastCapturedAt).toLocaleString()}`
                        : 'No captures yet'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/apps/${app.id}`}>
                        Timeline <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Stop tracking ${app.packageName}?`)) {
                          deleteMutation.mutate(app.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
