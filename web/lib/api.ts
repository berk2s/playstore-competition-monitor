import axios from 'axios';
import type { App, Screenshot, CreateAppInput, UpdateAppInput } from './types';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export const http = axios.create({ baseURL, timeout: 15_000 });

export const api = {
  listApps: () => http.get<{ apps: App[] }>('/api/apps').then((r) => r.data.apps),
  getApp: (id: string) => http.get<App>(`/api/apps/${id}`).then((r) => r.data),
  createApp: (input: CreateAppInput) =>
    http.post<App>('/api/apps', input).then((r) => r.data),
  updateApp: (id: string, input: UpdateAppInput) =>
    http.patch<App>(`/api/apps/${id}`, input).then((r) => r.data),
  deleteApp: (id: string) => http.delete(`/api/apps/${id}`).then(() => undefined),
  listScreenshots: (id: string) =>
    http
      .get<{ screenshots: Screenshot[] }>(`/api/apps/${id}/screenshots`)
      .then((r) => r.data.screenshots),
  triggerCapture: (id: string) =>
    http
      .post<{ enqueued: boolean; jobId: string }>(`/api/apps/${id}/capture`)
      .then((r) => r.data),
};
