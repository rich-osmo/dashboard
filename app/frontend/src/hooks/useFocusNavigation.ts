import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFocusNavigationOptions {
  selector: string;
  enabled?: boolean;
  onDismiss?: (index: number) => void;
  onOpen?: (index: number) => void;
  onCreateIssue?: (index: number) => void;
  onExpand?: (index: number) => void;
  onToggleFilter?: () => void;
}

export function useFocusNavigation({ selector, enabled = true, onDismiss, onOpen, onCreateIssue, onExpand, onToggleFilter }: UseFocusNavigationOptions) {
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;

  const callbacksRef = useRef({ onDismiss, onOpen, onCreateIssue, onExpand, onToggleFilter });
  callbacksRef.current = { onDismiss, onOpen, onCreateIssue, onExpand, onToggleFilter };

  const getItems = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll(selector)) as HTMLElement[];
  }, [selector]);

  // Clear focus styling on all items
  const clearFocus = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.querySelectorAll('.keyboard-focused').forEach(el => {
      el.classList.remove('keyboard-focused');
    });
  }, []);

  // Reset on route change / selector change
  useEffect(() => {
    clearFocus();
    setFocusIndex(-1);
  }, [selector, clearFocus]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Guard: skip in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Don't process if meta/ctrl/alt held (except Shift for Shift+Tab)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const items = getItems();
      if (items.length === 0) return;

      const moveTo = (next: number) => {
        clearFocus();
        items[next]?.classList.add('keyboard-focused');
        items[next]?.scrollIntoView({ block: 'nearest' });
        setFocusIndex(next);
      };

      if (e.key === 'Tab' && !e.shiftKey || e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusIndexRef.current + 1, items.length - 1);
        moveTo(next);
      } else if (e.key === 'Tab' && e.shiftKey || e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(focusIndexRef.current - 1, 0);
        moveTo(next);
      } else if (e.key === 'Enter') {
        const idx = focusIndexRef.current;
        if (idx >= 0 && idx < items.length) {
          e.preventDefault();
          if (callbacksRef.current.onOpen) {
            callbacksRef.current.onOpen(idx);
          } else {
            // Prefer links over buttons (avoid clicking dismiss buttons)
            const clickable = (items[idx].querySelector('a[href]') || items[idx].querySelector('[data-click-target]') || items[idx].querySelector('button')) as HTMLElement;
            clickable?.click();
          }
        }
      } else if (e.key === 'd') {
        const idx = focusIndexRef.current;
        if (idx >= 0 && idx < items.length && callbacksRef.current.onDismiss) {
          e.preventDefault();
          callbacksRef.current.onDismiss(idx);
          // Move focus to next item (or previous if at end)
          const nextIdx = idx < items.length - 1 ? idx : Math.max(idx - 1, 0);
          setTimeout(() => {
            const fresh = getItems();
            if (fresh.length > 0) {
              const clamped = Math.min(nextIdx, fresh.length - 1);
              clearFocus();
              fresh[clamped]?.classList.add('keyboard-focused');
              fresh[clamped]?.scrollIntoView({ block: 'nearest' });
              setFocusIndex(clamped);
            } else {
              setFocusIndex(-1);
            }
          }, 100);
        }
      } else if (e.key === 'i') {
        const idx = focusIndexRef.current;
        if (idx >= 0 && idx < items.length && callbacksRef.current.onCreateIssue) {
          e.preventDefault();
          callbacksRef.current.onCreateIssue(idx);
          // Flash the item to confirm
          items[idx].classList.add('issue-created-flash');
          setTimeout(() => items[idx]?.classList.remove('issue-created-flash'), 600);
        }
      } else if (e.key === 'e') {
        const idx = focusIndexRef.current;
        if (idx >= 0 && idx < items.length && callbacksRef.current.onExpand) {
          e.preventDefault();
          callbacksRef.current.onExpand(idx);
        }
      } else if (e.key === 'f') {
        if (callbacksRef.current.onToggleFilter) {
          e.preventDefault();
          callbacksRef.current.onToggleFilter();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, getItems, clearFocus]);

  return { containerRef, focusIndex };
}
