import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

/**
 * Pure: given row TOP offsets (screen px, ascending, equal-height rows), the index
 * being dragged, and the current pointerY (same origin), return the clamped target
 * index 0..n-1. Mirrors prototype/spaces-mgmt.jsx ReorderList math.
 */
export function reorderIndex(tops: number[], from: number, pointerY: number): number {
  const n = tops.length;
  if (n <= 1) return from;

  const origin = tops[0];
  const step = tops[1] - tops[0] || 1;
  const raw = Math.round((pointerY - origin - step / 2) / step);

  return Math.max(0, Math.min(n - 1, raw));
}

interface HoldToReorderOpts<T> {
  ids: string[];
  onReorder: (orderedIds: string[]) => void;
  holdMs?: number;
}

interface HoldToReorderBind {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
}

export function useHoldToReorder<T>(opts: HoldToReorderOpts<T>): {
  draggingId: string | null;
  order: string[];
  bind: (id: string) => HoldToReorderBind;
  containerRef: RefObject<HTMLDivElement | null>;
  suppressClick: () => boolean;
} {
  const { onReorder, holdMs = 300 } = opts;
  const containerRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>(opts.ids);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const draggingRef = useRef<string | null>(null);
  const holdTimer = useRef<number | null>(null);
  const orderRef = useRef<string[]>(opts.ids);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const suppressUntil = useRef<number>(0);

  orderRef.current = order;

  const idsKey = opts.ids.join(",");

  const clearHold = useCallback(() => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => clearHold, [clearHold]);

  useEffect(() => {
    if (!draggingRef.current) {
      setOrder(opts.ids);
      orderRef.current = opts.ids;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const rowTops = useCallback((): number[] => {
    const container = containerRef.current;
    if (!container) return [];

    return Array.from(container.querySelectorAll<HTMLElement>("[data-reorder-row]")).map((el) => {
      return el.getBoundingClientRect().top;
    });
  }, []);

  const commit = useCallback(() => {
    const dropped = orderRef.current.slice();
    draggingRef.current = null;
    setDraggingId(null);
    suppressUntil.current = Date.now() + 280;
    onReorder(dropped);
  }, [onReorder]);

  const bind = useCallback(
    (id: string): HoldToReorderBind => ({
      onPointerDown: (e) => {
        startPoint.current = { x: e.clientX, y: e.clientY };
        clearHold();
        holdTimer.current = window.setTimeout(() => {
          try {
            navigator.vibrate?.(8);
          } catch {
            /* haptics are best-effort */
          }

          draggingRef.current = id;
          setDraggingId(id);
        }, holdMs);
      },
      onPointerMove: (e) => {
        if (!draggingRef.current && startPoint.current) {
          const dx = Math.abs(e.clientX - startPoint.current.x);
          const dy = Math.abs(e.clientY - startPoint.current.y);
          if (dx > 9 || dy > 9) clearHold();
          return;
        }

        if (draggingRef.current !== id) return;
        if (e.cancelable) e.preventDefault();

        const from = orderRef.current.indexOf(id);
        if (from === -1) return;

        const target = reorderIndex(rowTops(), from, e.clientY);
        if (target === from) return;

        const next = orderRef.current.slice();
        const [moved] = next.splice(from, 1);
        next.splice(target, 0, moved);
        orderRef.current = next;
        setOrder(next);
      },
      onPointerUp: () => {
        clearHold();
        if (draggingRef.current) commit();
        startPoint.current = null;
      },
      onPointerCancel: () => {
        clearHold();
        if (draggingRef.current) commit();
        startPoint.current = null;
      }
    }),
    [clearHold, commit, holdMs, rowTops]
  );

  const suppressClick = useCallback(() => Date.now() < suppressUntil.current, []);

  return { draggingId, order, bind, containerRef, suppressClick };
}
