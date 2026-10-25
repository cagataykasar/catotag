import { useCallback, useEffect, useRef, useState } from "react";

export const STORAGE_EVENT = "catotag-storage";

export const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

// Write (or remove, for undefined) a value and notify every useStoredState / listener of `key`
export const writeStored = (key, value) => {
  try {
    if (value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: key }));
};

// localStorage-backed state, kept in sync live between components (and other browser tabs).
// `normalize` must be a stable (module-level) function.
export default function useStoredState(key, fallback, normalize = (v) => v) {
  const [value, setValue] = useState(() => normalize(readStored(key, fallback)));
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const sync = (e) => {
      const changedKey = e.type === "storage" ? e.key : e.detail;
      if (changedKey === key) setValue(normalize(readStored(key, fallback)));
    };
    window.addEventListener(STORAGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORAGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
    // fallback is a literal default; re-subscribing on its identity is not wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, normalize]);

  const update = useCallback(
    (next) => {
      const resolved = typeof next === "function" ? next(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      writeStored(key, resolved);
    },
    [key]
  );

  return [value, update];
}
