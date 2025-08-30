"use client";

import { endRequest, startRequest, setLoadingMessage } from "./request-tracker";

export type ApiFetchInit = RequestInit & {
  // If true, shows the global blocking overlay during this request.
  // Defaults: true for non-GET; false for GET.
  lockUI?: boolean;
  // Optional message to show while locked.
  waitMessage?: string;
  // If true, automatically retries on 429 with backoff while keeping the overlay.
  retryOn429?: boolean;
  max429Retries?: number;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init: ApiFetchInit = {}
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const shouldLock = init.lockUI ?? (method !== "GET");
  const waitMessage = init.waitMessage;
  const retryOn429 = init.retryOn429 ?? false;
  const max429 = init.max429Retries ?? 3;

  if (shouldLock) startRequest(waitMessage);
  try {
    let attempt = 0;
    let lastRes: Response | null = null;
    let delay = 500;
    for (;;) {
      const res = await fetch(input, init);
      lastRes = res;
      if (!(retryOn429 && res.status === 429 && attempt < max429)) {
        return res;
      }
      // Update message if server provided one
      const hdrMsg = res.headers.get("x-wait-reason");
      if (hdrMsg) setLoadingMessage(hdrMsg);
      else if (waitMessage) setLoadingMessage(waitMessage);
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
      delay = Math.min(5000, Math.floor(delay * 1.8));
    }
    // Fallback (shouldn't reach)
    // eslint-disable-next-line no-unreachable
    return lastRes as Response;
  } finally {
    if (shouldLock) endRequest();
  }
}

