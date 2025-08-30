"use client";

import { useSyncExternalStore } from "react";

let pendingCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of Array.from(listeners)) l();
}

export function startRequest() {
  pendingCount += 1;
  emit();
}

export function endRequest() {
  // Guard against going negative on unexpected flows
  pendingCount = Math.max(0, pendingCount - 1);
  emit();
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot() {
  return pendingCount;
}

export function useGlobalLoading(): boolean {
  const count = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  return count > 0;
}

