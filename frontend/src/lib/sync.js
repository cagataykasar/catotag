import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { STORAGE_EVENT, readStored, writeStored } from "./useStoredState";
import { DEFAULTS_KEY, PRESETS_KEY, TAGS_KEY } from "./tags";
import { LAYOUT_KEY } from "./layout";

// Offline-first cloud backup. localStorage stays the source of truth on the device;
// changes are uploaded in the background whenever a user is signed in and online.

export const MATCH_KEY = "catotag.match";
const META_KEY = "catotag.syncMeta"; // { user, settingsVersion, settingsDirty, matchDirty }

const SETTINGS_FIELDS = { tags: TAGS_KEY, layout: LAYOUT_KEY, defaults: DEFAULTS_KEY, presets: PRESETS_KEY };
const SETTINGS_KEYS = Object.values(SETTINGS_FIELDS);
const SETTINGS_DELAY_MS = 1500;
const MATCH_DELAY_MS = 3000;
const RETRY_MS = 30000;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const readSettings = () =>
  Object.fromEntries(Object.entries(SETTINGS_FIELDS).map(([field, key]) => [field, readStored(key, null)]));
const isEmptySettings = (s) => !(s.tags && s.tags.length) && !(s.presets && s.presets.length);

const readMeta = () => readStored(META_KEY, null) || {};
const writeMeta = (patch) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...patch }));
  } catch {}
};

export const matchHasContent = (m) => !!m && ((m.instances?.length || 0) > 0 || m.accumulatedMs > 0 || !!m.startedAt);

// randomUUID needs a secure context (HTTPS); getRandomValues works on plain http too
export const newMatchId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

function createEngine(report) {
  let user = null;
  let applying = false; // ignore storage events caused by applying cloud data
  let queue = Promise.resolve();
  let lastMatch = readStored(MATCH_KEY, null);
  let finishedMatch = null; // previous match replaced by "New match" before its last upload
  const timers = {};

  const run = (task) => {
    queue = queue.then(task).catch(() => {});
    return queue;
  };

  const fail = (err) => {
    if (err instanceof ApiError && err.status === 0) report({ status: "offline" });
    else if (err instanceof ApiError && err.status === 401) report({ status: "idle" });
    else report({ status: "error", error: err.message });
  };

  async function syncSettings(retried = false) {
    const meta = readMeta();
    const local = readSettings();
    const remote = await api("/sync/settings");
    const remoteVersion = remote?.version ?? 0;

    const push = async (baseVersion) => {
      try {
        const res = await api("/sync/settings", { method: "PUT", body: { data: local, base_version: baseVersion } });
        // Edits made during the upload stay dirty and go up next round
        writeMeta({ settingsVersion: res.version, settingsDirty: !same(readSettings(), local) });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && !retried) return syncSettings(true);
        throw err;
      }
    };
    const applyRemote = () => {
      applying = true;
      try {
        for (const [field, key] of Object.entries(SETTINGS_FIELDS)) writeStored(key, remote.data?.[field] ?? undefined);
      } finally {
        applying = false;
      }
      writeMeta({ settingsVersion: remote.version, settingsDirty: false });
    };

    if (!remote) return isEmptySettings(local) ? undefined : push(0);
    const remoteEmpty = isEmptySettings(remote.data || {});
    if (meta.settingsVersion === remoteVersion) {
      if (!meta.settingsDirty) return undefined;
      // Safety net: never wipe the account's tags without asking
      if (isEmptySettings(local) && !remoteEmpty &&
          !window.confirm("This device has no tags. Remove all tags and presets from your account too?\n\nCancel: restore them from your account")) {
        return applyRemote();
      }
      return push(remoteVersion);
    }

    // The account changed since this device last synced, or this device never synced
    if (same(local, remote.data)) return writeMeta({ settingsVersion: remote.version, settingsDirty: false });
    if (remoteEmpty) return push(remote.version);
    if (meta.settingsVersion !== undefined && !meta.settingsDirty) return applyRemote();
    if (meta.settingsVersion === undefined && isEmptySettings(local)) return applyRemote();
    const useRemote = window.confirm(
      meta.settingsVersion === undefined
        ? "Your account already has tags and a layout saved.\n\nOK: use the account's tags on this device\nCancel: replace them with this device's tags"
        : "Your tags were also changed on another device.\n\nOK: use the other device's version\nCancel: keep this device's version"
    );
    return useRemote ? applyRemote() : push(remote.version);
  }

  async function syncMatch() {
    if (finishedMatch) {
      const done = finishedMatch;
      await api(`/sync/matches/${done.id}`, { method: "PUT", body: { data: done } });
      if (finishedMatch === done) finishedMatch = null;
      report({ matchUploaded: true });
    }
    if (!readMeta().matchDirty) return;
    const match = readStored(MATCH_KEY, null);
    if (!match?.id || !matchHasContent(match)) return writeMeta({ matchDirty: false });
    await api(`/sync/matches/${match.id}`, { method: "PUT", body: { data: match } });
    writeMeta({ matchDirty: !same(readStored(MATCH_KEY, null), match) });
    report({ matchUploaded: true });
  }

  const sync = (parts) =>
    run(async () => {
      if (!user) return;
      report({ status: "syncing" });
      try {
        if (parts.settings) await syncSettings();
        if (parts.match) await syncMatch();
        report({ status: "synced" });
      } catch (err) {
        fail(err);
      }
    });

  const syncAll = () => sync({ settings: true, match: true });

  const schedule = (kind, delay) => {
    clearTimeout(timers[kind]);
    timers[kind] = setTimeout(() => sync({ [kind]: true }), delay);
  };

  // Track local edits even while signed out, so they upload on the next sign-in.
  // Only edits made in this tab count: other tabs upload their own changes.
  const onStorage = (e) => {
    const key = e.detail;
    if (applying) return;
    if (SETTINGS_KEYS.includes(key)) {
      writeMeta({ settingsDirty: true });
      schedule("settings", SETTINGS_DELAY_MS);
    } else if (key === MATCH_KEY) {
      const current = readStored(MATCH_KEY, null);
      if (user && lastMatch?.id && current?.id !== lastMatch.id && readMeta().matchDirty && matchHasContent(lastMatch)) {
        finishedMatch = lastMatch;
      }
      lastMatch = current;
      writeMeta({ matchDirty: true });
      schedule("match", MATCH_DELAY_MS);
    }
  };

  const retry = () => {
    const meta = readMeta();
    if (user && (meta.settingsDirty || meta.matchDirty || finishedMatch)) syncAll();
  };

  return {
    start() {
      window.addEventListener(STORAGE_EVENT, onStorage);
      window.addEventListener("online", syncAll);
      const interval = setInterval(retry, RETRY_MS);
      return () => {
        window.removeEventListener(STORAGE_EVENT, onStorage);
        window.removeEventListener("online", syncAll);
        clearInterval(interval);
        Object.values(timers).forEach(clearTimeout);
      };
    },
    setUser(username) {
      user = username;
      if (!username) return report({ status: "idle" });
      if (readMeta().user !== username) {
        // First sign-in of this account on this device: everything local counts as unsynced
        writeMeta({ user: username, settingsVersion: undefined, settingsDirty: true, matchDirty: true });
      }
      syncAll();
    },
    syncAll,
  };
}

export default function useCloudSync(username) {
  const [state, setState] = useState({ status: "idle", error: null, lastSyncedAt: null, matchesStamp: 0 });
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = createEngine((patch) =>
      setState((s) => ({
        ...s,
        status: patch.status ?? s.status,
        error: patch.status === "error" ? patch.error : patch.status ? null : s.error,
        lastSyncedAt: patch.status === "synced" ? Date.now() : s.lastSyncedAt,
        matchesStamp: patch.matchUploaded ? s.matchesStamp + 1 : s.matchesStamp,
      }))
    );
  }

  useEffect(() => engineRef.current.start(), []);
  useEffect(() => {
    engineRef.current.setUser(username);
  }, [username]);

  return { ...state, syncNow: engineRef.current.syncAll };
}
