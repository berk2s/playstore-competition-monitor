import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, http } from './api';

describe('api wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listApps returns just the apps array', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce({ data: { apps: [{ id: '1' }, { id: '2' }] } });
    const result = await api.listApps();
    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    expect(http.get).toHaveBeenCalledWith('/api/apps');
  });

  it('getApp hits /api/apps/:id', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce({ data: { id: 'abc' } });
    const result = await api.getApp('abc');
    expect(result).toEqual({ id: 'abc' });
    expect(http.get).toHaveBeenCalledWith('/api/apps/abc');
  });

  it('createApp POSTs the input body', async () => {
    vi.spyOn(http, 'post').mockResolvedValueOnce({ data: { id: 'new' } });
    const result = await api.createApp({
      playUrl: 'https://play.google.com/store/apps/details?id=com.x.y',
      title: 'Y',
    });
    expect(result).toEqual({ id: 'new' });
    expect(http.post).toHaveBeenCalledWith('/api/apps', {
      playUrl: 'https://play.google.com/store/apps/details?id=com.x.y',
      title: 'Y',
    });
  });

  it('updateApp PATCHes /api/apps/:id with the body', async () => {
    vi.spyOn(http, 'patch').mockResolvedValueOnce({ data: { id: 'abc', active: false } });
    const result = await api.updateApp('abc', { active: false });
    expect(result).toEqual({ id: 'abc', active: false });
    expect(http.patch).toHaveBeenCalledWith('/api/apps/abc', { active: false });
  });

  it('deleteApp returns undefined', async () => {
    vi.spyOn(http, 'delete').mockResolvedValueOnce({ data: null });
    const result = await api.deleteApp('abc');
    expect(result).toBeUndefined();
    expect(http.delete).toHaveBeenCalledWith('/api/apps/abc');
  });

  it('listScreenshots returns the screenshots array', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { screenshots: [{ id: 's1' }, { id: 's2' }] },
    });
    const result = await api.listScreenshots('abc');
    expect(result).toEqual([{ id: 's1' }, { id: 's2' }]);
    expect(http.get).toHaveBeenCalledWith('/api/apps/abc/screenshots');
  });

  it('triggerCapture POSTs to the capture endpoint', async () => {
    vi.spyOn(http, 'post').mockResolvedValueOnce({
      data: { enqueued: true, jobId: 'job-1' },
    });
    const result = await api.triggerCapture('abc');
    expect(result).toEqual({ enqueued: true, jobId: 'job-1' });
    expect(http.post).toHaveBeenCalledWith('/api/apps/abc/capture');
  });
});
