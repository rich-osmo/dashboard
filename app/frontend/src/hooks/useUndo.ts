import { useSyncExternalStore, useCallback } from 'react';

interface UndoEntry {
  label: string;
  undo: () => Promise<void> | void;
}

const MAX_STACK = 20;
let stack: UndoEntry[] = [];
let listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function pushUndo(entry: UndoEntry) {
  stack = [entry, ...stack].slice(0, MAX_STACK);
  notify();
}

export function popUndo(): UndoEntry | undefined {
  if (stack.length === 0) return undefined;
  const [top, ...rest] = stack;
  stack = rest;
  notify();
  return top;
}

export function peekUndo(): UndoEntry | undefined {
  return stack[0];
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return stack;
}

export function useUndoStack() {
  const current = useSyncExternalStore(subscribe, getSnapshot);

  const undo = useCallback(async () => {
    const entry = popUndo();
    if (entry) {
      await entry.undo();
      return entry.label;
    }
    return null;
  }, []);

  return {
    canUndo: current.length > 0,
    label: current[0]?.label ?? null,
    undo,
  };
}
