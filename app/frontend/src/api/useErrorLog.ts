import { useSyncExternalStore } from 'react';
import { getErrors, subscribe, clearErrors } from './errorLog';
import type { ErrorEntry } from './errorLog';

export function useErrorLog() {
  const errors = useSyncExternalStore(subscribe, getErrors);
  return { errors, clearErrors };
}

export type { ErrorEntry };
