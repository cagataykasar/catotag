import React, { useState, useEffect, useRef } from "react";
import useStoredState from "../lib/useStoredState";
import {
  DEFAULTS_KEY,
  DEFAULT_WINDOW,
  TAGS_KEY,
  clipWindow,
  formatTime,
  getTextColor,
  normalizeDefaults,
  normalizeTags,
} from "../lib/tags";
import { DEFAULT_LAYOUT, LAYOUT_KEY, gridArea, normalizeLayout, resolveLayout } from "../lib/layout";
import { MATCH_KEY, newMatchId } from "../lib/sync";
import { STORAGE_EVENT } from "../lib/useStoredState";
import { buildFileName, exportXml } from "../lib/xml";
import { inputClass } from "../components/ui";
import { DownloadIcon, PauseIcon, PlayIcon, ResetIcon, XIcon } from "../components/Icons";

const LOG_PREVIEW = 8;

// Restore the in-progress match (tags, clock, teams) saved on every change
const loadMatch = () => {
  try {
    const m = JSON.parse(localStorage.getItem(MATCH_KEY) || "null");
    if (!m || typeof m !== "object") return null;
    const instances = Array.isArray(m.instances) ? m.instances : [];
    return {
      id: typeof m.id === "string" ? m.id : newMatchId(),
      // uid is the internal identity; older saves only had ID
      instances: instances.map((inst, i) => ({ ...inst, uid: inst.uid ?? inst.ID ?? i })),
      teamA: m.teamA || "",
      teamB: m.teamB || "",
      accumulatedMs: Number(m.accumulatedMs) || 0,
      startedAt: Number(m.startedAt) || null,
      createdAt: m.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const timeRange = (inst) => `${formatTime(inst.start * 1000)} – ${formatTime(inst.end * 1000)}`;

const Match = () => {
  const [saved] = useState(loadMatch);
  const [tagTypes] = useStoredState(TAGS_KEY, [], normalizeTags);
  const [defaults] = useStoredState(DEFAULTS_KEY, DEFAULT_WINDOW, normalizeDefaults);
  const [layout] = useStoredState(LAYOUT_KEY, DEFAULT_LAYOUT, normalizeLayout);
  const [matchId, setMatchId] = useState(() => saved?.id || newMatchId());
  const [createdAt, setCreatedAt] = useState(() => saved?.createdAt || new Date().toISOString());
  const [instances, setInstances] = useState(saved?.instances || []); // schema-aligned entries
  const nextUidRef = useRef((saved?.instances || []).reduce((m, i) => Math.max(m, Number(i.uid) || 0), -1) + 1);
  const [teamA, setTeamA] = useState(saved?.teamA || "");
  const [teamB, setTeamB] = useState(saved?.teamB || "");
  const [restored, setRestored] = useState(
    () => !!saved && (saved.instances.length > 0 || saved.accumulatedMs > 0 || saved.startedAt !== null)
  );
  const [saveFailed, setSaveFailed] = useState(false);
  const [showAllLog, setShowAllLog] = useState(false);

  // Tap feedback
  const [flash, setFlash] = useState({ name: null, n: 0 });
  const [toast, setToast] = useState(null);
  const toastSeqRef = useRef(0);
  const showToast = (t) => setToast({ ...t, id: ++toastSeqRef.current });

  // Match timer state: wall-clock based, so throttled/frozen tabs and reloads keep correct time.
  // elapsed = accumulatedMs + (now - startedAt) while running.
  const [accumulatedMs, setAccumulatedMs] = useState(saved?.accumulatedMs || 0);
  const [startedAt, setStartedAt] = useState(saved?.startedAt || null);
  const [, setTick] = useState(0);
  const isRunning = startedAt !== null;

  const getElapsedMs = () => accumulatedMs + (startedAt !== null ? Math.max(0, Date.now() - startedAt) : 0);
  const elapsedMs = getElapsedMs();

  const startTimer = () => {
    if (isRunning) return;
    setStartedAt(Date.now());
  };

  const pauseTimer = () => {
    if (!isRunning) return;
    setAccumulatedMs(getElapsedMs());
    setStartedAt(null);
  };

  const resetTimer = () => {
    setStartedAt(null);
    setAccumulatedMs(0);
  };

  const handleConfirmResetTimer = () => {
    const ok = window.confirm("Reset timer? This will set match time back to 00:00. Tagged moments are kept.");
    if (ok) resetTimer();
  };

  const handleNewMatch = () => {
    const ok = window.confirm("Start a new match? All tagged moments and the timer will be cleared.");
    if (!ok) return;
    resetTimer();
    // The finished match keeps its id in the cloud backup; this one starts fresh
    setMatchId(newMatchId());
    setCreatedAt(new Date().toISOString());
    setInstances([]);
    setTeamA("");
    setTeamB("");
    setRestored(false);
    setToast(null);
  };

  // Re-render the clock while running; the interval only drives the display, not the time itself
  useEffect(() => {
    if (!isRunning) return;
    const refresh = () => setTick((t) => t + 1);
    const id = setInterval(refresh, 250);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isRunning]);

  // Keep the screen awake while the match clock runs (re-acquired after the tab becomes visible again)
  useEffect(() => {
    if (!isRunning || !("wakeLock" in navigator)) return;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          next.release().catch(() => {});
        } else {
          lock = next;
        }
      } catch {}
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      if (lock) lock.release().catch(() => {});
    };
  }, [isRunning]);

  // Autosave the whole match on every change so a killed/reloaded tab loses nothing
  useEffect(() => {
    try {
      localStorage.setItem(
        MATCH_KEY,
        JSON.stringify({ v: 2, id: matchId, createdAt, instances, teamA, teamB, accumulatedMs, startedAt })
      );
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
    // Lets the cloud sync pick up the change
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: MATCH_KEY }));
  }, [matchId, createdAt, instances, teamA, teamB, accumulatedMs, startedAt]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const removeInstance = (uid) => setInstances((prev) => prev.filter((i) => i.uid !== uid));

  const handleTagClick = (tag) => {
    const { pre, post } = clipWindow(tag, defaults);
    const nowSec = getElapsedMs() / 1000;
    const start = Math.max(0, parseFloat((nowSec - pre).toFixed(3)));
    const end = parseFloat((nowSec + post).toFixed(3));
    const code = (tag.name || "").toUpperCase();
    const inst = {
      uid: nextUidRef.current++,
      code,
      color: tag.color,
      group: tag.group || 1,
      tagName: tag.name, // Store original name for display
      start,
      end,
      label: { group: "Event", text: code },
      time_iso: new Date().toISOString(),
    };
    setInstances((prev) => [...prev, inst]);

    if (navigator.vibrate) navigator.vibrate(40);
    setFlash((f) => ({ name: tag.name, n: f.n + 1 }));
    showToast({
      color: inst.color,
      title: code,
      detail: timeRange(inst),
      warn: isRunning ? null : "Timer is not running",
      undo: () => removeInstance(inst.uid),
    });
  };

  const handleDelete = (inst) => {
    const index = instances.findIndex((i) => i.uid === inst.uid);
    removeInstance(inst.uid);
    showToast({
      color: inst.color,
      title: `Deleted ${inst.code}`,
      detail: timeRange(inst),
      undo: () =>
        setInstances((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, inst);
          return next;
        }),
    });
  };

  const handleDownloadXml = () => exportXml(instances, teamA, teamB);

  // Tag buttons placed on the grid designed in the Tags page
  const buttons = resolveLayout(tagTypes, layout.cols);

  // Timeline calculations with dynamic duration
  const nowSec = elapsedMs / 1000;
  const maxEndSeen = Math.max(...instances.map((i) => i.end || 0), 0);
  const totalDuration = Math.max(nowSec + 5, maxEndSeen + 2, 30);
  const pct = (sec) => `${Math.min(100, Math.max(0, (sec / totalDuration) * 100))}%`;
  const timelineGroups = [...new Set(instances.map((i) => i.group || 1))].sort((a, b) => a - b);

  const newestFirst = [...instances].reverse();
  const visibleLog = showAllLog ? newestFirst : newestFirst.slice(0, LOG_PREVIEW);

  return (
    <div>
      {/* Sticky scoreboard bar */}
      <div
        className="sticky top-0 md:top-14 z-20 bg-ink-950/95 backdrop-blur border-b border-ink-800"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${isRunning ? "bg-live animate-pulse" : "bg-ink-600"}`}
            title={isRunning ? "Running" : "Stopped"}
          />
          <div className="text-5xl sm:text-6xl font-extrabold tabular-nums tracking-tight leading-none">
            {formatTime(elapsedMs)}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleConfirmResetTimer}
              disabled={elapsedMs === 0}
              aria-label="Reset timer"
              className="w-12 h-12 grid place-items-center rounded-xl bg-ink-800 border border-ink-700 text-ink-200 hover:bg-ink-700 disabled:opacity-40 transition"
            >
              <ResetIcon className="w-5 h-5" />
            </button>
            {isRunning ? (
              <button
                onClick={pauseTimer}
                className="h-12 px-4 sm:px-5 flex items-center gap-2 rounded-xl bg-amber-400 text-ink-950 font-bold hover:bg-amber-300 transition"
              >
                <PauseIcon className="w-5 h-5" />
                Pause
              </button>
            ) : (
              <button
                onClick={startTimer}
                className="h-12 px-4 sm:px-5 flex items-center gap-2 rounded-xl bg-accent text-ink-950 font-bold hover:brightness-110 transition"
              >
                <PlayIcon className="w-5 h-5" />
                {elapsedMs > 0 ? "Resume" : "Start"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-6">
        {restored && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3 text-sm">
            <span>
              Previous match restored · {instances.length} tags · {formatTime(elapsedMs)}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setRestored(false)} className="px-3 py-1.5 rounded-lg bg-ink-700 hover:bg-ink-600 font-semibold">
                Continue
              </button>
              <button onClick={handleNewMatch} className="px-3 py-1.5 rounded-lg text-red-300 hover:bg-red-500/20 font-semibold">
                New match
              </button>
            </div>
          </div>
        )}
        {saveFailed && (
          <div className="rounded-2xl bg-red-500/15 border border-red-400/40 px-4 py-3 text-sm text-red-200">
            Autosave failed (storage full or private mode). Export your XML regularly.
          </div>
        )}

        {/* Tag buttons */}
        {tagTypes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
            <p className="text-lg font-bold">No tags yet</p>
            <p className="text-ink-400 mt-1">Add tags like “Goal” or “Offside” in the Tags tab.</p>
          </div>
        ) : (
          <div
            className="grid gap-2 sm:gap-3 auto-rows-[76px] sm:auto-rows-[92px]"
            style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
          >
            {buttons.map((item) => {
              const { tag: t } = item;
              const { pre, post } = clipWindow(t, defaults);
              const flashing = flash.name === t.name;
              const big = item.w * item.h >= 4;
              return (
                <button
                  key={flashing ? `${t.name}-${flash.n}` : t.name}
                  onClick={() => handleTagClick(t)}
                  className={`touch-manipulation select-none min-w-0 rounded-2xl px-2 py-2 flex flex-col items-center justify-center text-center shadow-lg shadow-black/40 active:scale-[0.96] transition-transform ${
                    flashing ? "animate-flash" : ""
                  }`}
                  style={{ ...gridArea(item), backgroundColor: t.color, color: getTextColor(t.color) }}
                >
                  <span
                    className={`font-extrabold uppercase leading-tight tracking-wide break-words line-clamp-3 ${
                      big ? "text-xl sm:text-3xl" : layout.cols >= 5 ? "text-xs sm:text-base" : "text-sm sm:text-lg"
                    }`}
                  >
                    {t.name}
                  </span>
                  <span className="mt-1 text-[10px] sm:text-[11px] font-semibold opacity-70 tabular-nums">
                    −{pre}s / +{post}s
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tagged moments */}
        <section className="rounded-2xl bg-ink-900 border border-ink-700">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <h2 className="text-lg font-bold">
              Tagged moments <span className="text-ink-400 font-semibold tabular-nums">{instances.length}</span>
            </h2>
            {instances.length > LOG_PREVIEW && (
              <button onClick={() => setShowAllLog((v) => !v)} className="text-sm font-semibold text-accent">
                {showAllLog ? "Show less" : `Show all ${instances.length}`}
              </button>
            )}
          </div>

          {instances.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-400">Tap a tag while the clock runs. Moments show up here.</p>
          ) : (
            <>
              <div className="px-4 pb-3 space-y-1.5" aria-hidden="true">
                {timelineGroups.map((group) => (
                  <div key={group} className="flex items-center gap-2">
                    <span className="w-6 text-[10px] font-bold text-ink-400">G{group}</span>
                    <div className="relative flex-1 h-3 rounded-full bg-ink-800 overflow-hidden">
                      {instances
                        .filter((i) => (i.group || 1) === group)
                        .map((inst) => (
                          <div
                            key={inst.uid}
                            className="absolute inset-y-0 rounded-full opacity-90"
                            style={{
                              left: pct(inst.start),
                              width: `calc(${pct(inst.end)} - ${pct(inst.start)})`,
                              backgroundColor: inst.color,
                            }}
                            title={`${inst.code} ${timeRange(inst)}`}
                          />
                        ))}
                      <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: pct(nowSec) }} />
                    </div>
                  </div>
                ))}
              </div>
              <ol className="border-t border-ink-800 divide-y divide-ink-800">
                {visibleLog.map((inst) => (
                  <li key={inst.uid} className="flex items-center gap-3 pl-4 pr-2 py-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: inst.color }} />
                    <span className="flex-1 min-w-0 truncate font-semibold">{inst.code}</span>
                    <span className="text-sm text-ink-400 tabular-nums">{timeRange(inst)}</span>
                    <button
                      onClick={() => handleDelete(inst)}
                      aria-label={`Delete ${inst.code}`}
                      className="w-10 h-10 grid place-items-center rounded-lg text-ink-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        {/* Export */}
        <section className="rounded-2xl bg-ink-900 border border-ink-700 p-4 sm:p-5 space-y-3">
          <h2 className="text-lg font-bold">Export</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Home team" value={teamA} onChange={(e) => setTeamA(e.target.value)} className={inputClass} />
            <input placeholder="Away team" value={teamB} onChange={(e) => setTeamB(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadXml}
              disabled={instances.length === 0}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-accent text-ink-950 font-bold hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition"
            >
              <DownloadIcon className="w-5 h-5" />
              Download XML ({instances.length} tags)
            </button>
            <button
              onClick={handleNewMatch}
              className="h-12 px-5 rounded-xl border border-ink-600 text-ink-200 font-semibold hover:bg-ink-800 transition"
            >
              New match
            </button>
          </div>
          <p className="text-xs text-ink-400 break-all">{buildFileName(teamA, teamB)}</p>
        </section>
      </div>

      {/* Tap confirmation / undo toast */}
      {toast && (
        <div className="toast-offset fixed inset-x-0 z-40 px-4 flex justify-center pointer-events-none" role="status">
          <div
            key={toast.id}
            className="pointer-events-auto animate-toast-in w-full max-w-md flex items-center gap-3 rounded-2xl bg-ink-800 border border-ink-600 shadow-2xl shadow-black/60 pl-4 pr-2 py-2.5"
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: toast.color }} />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{toast.title}</div>
              <div className="text-sm text-ink-400 tabular-nums">
                {toast.detail}
                {toast.warn && <span className="text-amber-400"> · {toast.warn}</span>}
              </div>
            </div>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo();
                  setToast(null);
                }}
                className="h-10 px-3 rounded-lg font-bold text-accent hover:bg-ink-700"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Match;
