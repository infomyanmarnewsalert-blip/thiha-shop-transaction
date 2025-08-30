"use client";

import { useSyncExternalStore } from "react";

let pendingCount = 0;
let currentMessage: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of Array.from(listeners)) l();
}

export function startRequest(message?: string | null) {
  pendingCount += 1;
  if (message) currentMessage = message;
  emit();
}

export function endRequest() {
  // Guard against going negative on unexpected flows
  pendingCount = Math.max(0, pendingCount - 1);
  if (pendingCount === 0) currentMessage = null;
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

export function setLoadingMessage(message: string | null) {
  currentMessage = message;
  emit();
}

export function useGlobalLoadingMessage(): string | null {
  const _ = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  return currentMessage;
}

