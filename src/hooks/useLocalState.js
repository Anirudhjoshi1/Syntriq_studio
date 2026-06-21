import { useEffect, useRef, useState } from "react";

/**
 * Like useState, but persisted to localStorage under `key`.
 * Everything in Syntriq Studio stays on-device — this is how the study tools
 * remember your data between visits.
 */
export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [value]);

  return [value, setValue];
}

let idCounter = 0;
/** Small unique-id helper for locally-created records. */
export function uid(prefix = "id") {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
