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
