"use client";

import { endRequest, startRequest } from "./request-tracker";

export type ApiFetchInit = RequestInit & {
  // If true, shows the global blocking overlay during this request.
  // Defaults: true for non-GET; false for GET.
  lockUI?: boolean;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init: ApiFetchInit = {}
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const shouldLock = init.lockUI ?? (method !== "GET");

  if (shouldLock) startRequest();
  try {
    const res = await fetch(input, init);
    return res;
  } finally {
    if (shouldLock) endRequest();
  }
}

