import { useCallback, useEffect, useRef, useState } from "react";

const EVENT = "catotag-storage";

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

// localStorage-backed state, kept in sync live between components (and other browser tabs).
// `normalize` must be a stable (module-level) function.
export default function useStoredState(key, fallback, normalize = (v) => v) {
  const [value, setValue] = useState(() => normalize(read(key, fallback)));
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const sync = (e) => {
      const changedKey = e.type === "storage" ? e.key : e.detail;
      if (changedKey === key) setValue(normalize(read(key, fallback)));
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
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
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {}
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key]
  );

  return [value, update];
}
