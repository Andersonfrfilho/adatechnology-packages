/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { main } from './main';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockJsonplaceholderFetch(): void {
  globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('jsonplaceholder.typicode.com')) {
      return new Response(JSON.stringify({ title: 'sample post title' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch call in smoke test: ${url}`);
  }) as typeof fetch;
}

describe('bun-app-example main', () => {
  test('runs the integrated demo end to end without throwing', async () => {
    mockJsonplaceholderFetch();

    await expect(main()).resolves.toBeUndefined();
  });
});
