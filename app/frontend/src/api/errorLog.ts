export interface ErrorEntry {
  id: number;
  timestamp: string;
  source: 'console' | 'unhandled' | 'api' | 'react';
  message: string;
  detail?: string;
}

const MAX_ENTRIES = 100;
let nextId = 1;
const entries: ErrorEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

// Buffer errors and flush to backend log periodically
let pendingErrors: Array<{ source: string; message: string; detail?: string }> =
  [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushToBackend() {
  flushTimer = null;
  if (pendingErrors.length === 0) return;
  const batch = pendingErrors;
  pendingErrors = [];
  fetch('/api/frontend-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errors: batch }),
  }).catch(() => {
    // Backend not reachable — drop silently
  });
}

function scheduleFlush() {
  if (flushTimer === null) {
    flushTimer = setTimeout(flushToBackend, 500);
  }
}

export function addError(
  source: ErrorEntry['source'],
  message: string,
  detail?: string,
) {
  entries.unshift({
    id: nextId++,
    timestamp: new Date().toISOString(),
    source,
    message,
    detail,
  });
  if (entries.length > MAX_ENTRIES) entries.pop();
  notify();

  // Also send to backend log for DMG debugging
  pendingErrors.push({ source, message, detail });
  scheduleFlush();
}

export function getErrors(): readonly ErrorEntry[] {
  return entries;
}

export function clearErrors() {
  entries.length = 0;
  nextId = 1;
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
