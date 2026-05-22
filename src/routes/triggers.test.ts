import { describe, it, expect, vi } from 'vitest';
import { triggers } from './triggers';

describe('Triggers Router', () => {
  it('should handle /on-app-install and return success status', async () => {
    // Spy on console.log to avoid cluttering test output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockRequest = {
      subreddit: {
        name: 'outreach_bot_dev',
        id: 't5_dummy',
      },
    };

    const res = await triggers.request('/on-app-install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockRequest),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: 'success' });
    expect(consoleSpy).toHaveBeenCalledWith(
      'App installed to subreddit: r/outreach_bot_dev'
    );

    consoleSpy.mockRestore();
  });
});
