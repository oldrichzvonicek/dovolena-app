import { useEffect, useRef } from "react";

export const DATA_CHANGED_EVENT = "dodio:data-changed";

/** Tell every mounted view that leave data changed (replaces full page reloads). */
export const emitDataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED_EVENT));

export function useOnDataChanged(cb: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, []);
}
