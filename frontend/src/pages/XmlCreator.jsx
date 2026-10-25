import React, { useState, useEffect } from "react";

const STORAGE_KEY = "catotag.tags";
const MATCH_KEY = "catotag.match";
const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const toSecondsFixed = (ms, digits = 3) => (ms / 1000).toFixed(digits);

// Restore the in-progress match (tags, clock, settings) saved on every change
const loadMatch = () => {
  try {
    const m = JSON.parse(localStorage.getItem(MATCH_KEY) || "null");
    if (!m || typeof m !== "object") return null;
    return {
      instances: Array.isArray(m.instances) ? m.instances : [],
      teamA: m.teamA || "",
      teamB: m.teamB || "",
      preSeconds: Number.isFinite(m.preSeconds) ? m.preSeconds : 5,
      postSeconds: Number.isFinite(m.postSeconds) ? m.postSeconds : 10,
      accumulatedMs: Number(m.accumulatedMs) || 0,
      startedAt: Number(m.startedAt) || null,
    };
  } catch {
    return null;
  }
};

const XmlCreator = () => {
  const [saved] = useState(loadMatch);
  const [tagTypes, setTagTypes] = useState([]); // [{ name, color }]
  const [instances, setInstances] = useState(saved?.instances || []); // schema-aligned entries
  const [exportOpen, setExportOpen] = useState(false);
  const [teamA, setTeamA] = useState(saved?.teamA || "");
  const [teamB, setTeamB] = useState(saved?.teamB || "");
  const [restored, setRestored] = useState(
    () => !!saved && (saved.instances.length > 0 || saved.accumulatedMs > 0 || saved.startedAt !== null)
  );
  const [saveFailed, setSaveFailed] = useState(false);

  // Match timer state: wall-clock based, so throttled/frozen tabs and reloads keep correct time.
  // elapsed = accumulatedMs + (now - startedAt) while running.
  const [accumulatedMs, setAccumulatedMs] = useState(saved?.accumulatedMs || 0);
  const [startedAt, setStartedAt] = useState(saved?.startedAt || null);
  const [, setTick] = useState(0);
  const isRunning = startedAt !== null;

  // Separate clip window controls
  const [preSeconds, setPreSeconds] = useState(saved?.preSeconds ?? 5);
  const [postSeconds, setPostSeconds] = useState(saved?.postSeconds ?? 10);

  const getElapsedMs = () => accumulatedMs + (startedAt !== null ? Math.max(0, Date.now() - startedAt) : 0);
  const elapsedMs = getElapsedMs();

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

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
    const ok = window.confirm("Reset timer? This will set match time back to 00:00.");
    if (ok) resetTimer();
  };

  const handleNewMatch = () => {
    const ok = window.confirm("Start a new match? All tagged moments and the timer will be cleared.");
    if (!ok) return;
    resetTimer();
    setInstances([]);
    setTeamA("");
    setTeamB("");
    setRestored(false);
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
        JSON.stringify({ v: 1, instances, teamA, teamB, preSeconds, postSeconds, accumulatedMs, startedAt })
      );
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [instances, teamA, teamB, preSeconds, postSeconds, accumulatedMs, startedAt]);

  const loadTags = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const normalized = Array.isArray(parsed)
        ? parsed.map((t) => {
            if (typeof t === "string") return { name: t, color: "#10b981", group: 1 };
            return { ...t, group: t.group || 1 };
          })
        : [];
      setTagTypes(normalized);
    } catch {
      setTagTypes([]);
    }
  };

  useEffect(() => {
    loadTags();
    const handle = () => loadTags();
    window.addEventListener("catotag-tags-updated", handle);
    window.addEventListener("storage", handle);
    return () => {
      window.removeEventListener("catotag-tags-updated", handle);
      window.removeEventListener("storage", handle);
    };
  }, []);

  const handleTagClick = (tagName) => {
    const codeUpper = (tagName || "").toUpperCase();
    const nowSec = parseFloat(toSecondsFixed(getElapsedMs()));
    const start = Math.max(0, parseFloat((nowSec - preSeconds).toFixed(3)));
    const end = parseFloat((nowSec + postSeconds).toFixed(3));
    const tag = tagTypes.find((t) => t.name === tagName);
    setInstances((prev) => [
      ...prev,
      {
        ID: prev.length ? Math.max(...prev.map((i) => Number(i.ID) || 0)) + 1 : 0,
        code: codeUpper,
        color: tag?.color || "#10b981",
        group: tag?.group || 1,
        tagName: tagName, // Store original name for display
        start,
        end,
        label: { group: "Event", text: codeUpper },
        time_iso: new Date().toISOString(),
      },
    ]);
  };

  const handleUndo = () => setInstances((prev) => prev.slice(0, -1));
  const lastInstance = instances[instances.length - 1];

  // Export: generate XML on demand
  const generateXml = async () => {
    try {
      const res = await fetch(`${API_BASE}/generate-xml`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances }),
      });
      return await res.text();
    } catch {
      return "";
    }
  };

  // Helper to safely encode text for XML
  const escapeXml = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>&"']/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&apos;';
        default: return c;
      }
    });
  };

  // New function to build the XML string in the exact required schema
  const generateXmlFromInstances = (instancesList) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<file>\n';
    xml += '  <SORT_INFO>\n';
    xml += '    <sort_type>sort order</sort_type>\n';
    xml += '  </SORT_INFO>\n';
    xml += '  <ALL_INSTANCES>\n';

    for (const inst of instancesList) {
      const id = typeof inst.ID === 'number' ? inst.ID : Number(inst.ID) || 0;
      const code = escapeXml((inst.code ?? '').toString().toUpperCase());
      const start = Number(inst.start ?? 0).toFixed(3);
      const end = Number(inst.end ?? 0).toFixed(3);
      const labelText = escapeXml((inst.label?.text ?? inst.code ?? '').toString().toUpperCase());

      xml += '    <instance>\n';
      xml += `      <ID>${id}</ID>\n`;
      xml += `      <code>${code}</code>\n`;
      xml += `      <start>${start}</start>\n`;
      xml += `      <end>${end}</end>\n`;
      xml += '      <label>\n';
      xml += '        <group>Event</group>\n';
      xml += `        <text>${labelText}</text>\n`;
      xml += '      </label>\n';
      xml += '    </instance>\n';
    }

    xml += '  </ALL_INSTANCES>\n';
    xml += '</file>';
    return xml;
  };

  const downloadText = (filename, text, mime = "application/xml;charset=utf-8") => {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.setAttribute("download", filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoking immediately cancels the download on iOS Safari and some Android browsers
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch {
      return false;
    }
  };

  // Filesystem-safe name (quotes and slashes break downloads on Android/Windows)
  const buildFileName = () => {
    const clean = (s, fallback) =>
      (s.trim() || fallback).toUpperCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || fallback;
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${clean(teamA, "TEAM_A")}_vs_${clean(teamB, "TEAM_B")}_${date}.xml`;
  };

  const handleDownloadXml = async () => {
    const text = generateXmlFromInstances(instances);
    const filename = buildFileName();
    // On phones prefer the native share sheet (Files, Drive, mail...) when the browser accepts the file
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches;
    if (isTouch && navigator.canShare) {
      try {
        const file = new File([text], filename, { type: "application/xml" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          setExportOpen(false);
          return;
        }
      } catch (err) {
        if (err?.name === "AbortError") return; // user closed the share sheet
      }
    }
    if (downloadText(filename, text)) {
      setExportOpen(false);
    } else {
      window.alert("Download failed. If you opened this inside another app (WhatsApp, Instagram...), open it in Safari/Chrome instead.");
    }
  };

  const getTextColor = (bg) => {
    try {
      const r = parseInt(bg.slice(1, 3), 16);
      const g = parseInt(bg.slice(3, 5), 16);
      const b = parseInt(bg.slice(5, 7), 16);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return luminance > 0.6 ? "#111827" : "#ffffff";
    } catch {
      return "#ffffff";
    }
  };

  // Timeline calculations with dynamic duration (no fixed 90-minute minimum)
  const nowSec = parseFloat(toSecondsFixed(elapsedMs));
  const maxEndSeen = Math.max(...instances.map((i) => i.end || 0), 0);
  // Add a small headroom buffer so the current-time indicator isn't pinned
  const totalDuration = Math.max(nowSec + 5, maxEndSeen + 2, 30);
  const pct = (sec) => `${Math.min(100, Math.max(0, (sec / totalDuration) * 100))}%`;

  // Get all unique group numbers from both tags and instances
  const tagGroupNumbers = tagTypes.map((t) => t.group || 1);
  const instanceGroupNumbers = instances.map((i) => i.group || 1);
  const allGroupNumbers = [...new Set([...tagGroupNumbers, ...instanceGroupNumbers])].sort((a, b) => a - b);
  
  // If no groups exist, default to group 1
  const displayGroups = allGroupNumbers.length > 0 ? allGroupNumbers : [1];
  
  // Create group data for timeline display
  const groupsForTimeline = displayGroups.map((gNum) => ({
    group: gNum,
    tags: tagTypes.filter((t) => (t.group || 1) === gNum),
    instances: instances.filter((i) => (i.group || 1) === gNum),
  }));

  return (
    <div className="min-h-screen flex flex-col gap-6 p-6">
      <main className="w-full text-center">
        <span className="text-white font-semibold tracking-wide text-xl">fooTag</span>
        <div className="max-w-5xl mx-auto bg-white/10 rounded-3xl shadow-xl p-8 space-y-8 border border-white/10">
          {restored && (
            <div className="flex items-center justify-between gap-3 flex-wrap bg-emerald-500/20 border border-emerald-400/40 text-white text-sm rounded-2xl px-4 py-2">
              <span>Previous match restored ({instances.length} tags, {formatTime(elapsedMs)}).</span>
              <div className="flex gap-2">
                <button onClick={() => setRestored(false)} className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30">OK</button>
                <button onClick={handleNewMatch} className="px-3 py-1 rounded-full bg-red-500/80 hover:bg-red-500">New match</button>
              </div>
            </div>
          )}
          {saveFailed && (
            <div className="bg-red-500/30 border border-red-400/50 text-white text-sm rounded-2xl px-4 py-2">
              Autosave failed (storage full or private mode). Export your XML regularly.
            </div>
          )}
          <div className="flex items-center justify-center gap-4">
          {/* Timer controls */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="text-white text-xl font-mono px-4 py-2 rounded-2xl bg-black/40 border border-white/10">
              {formatTime(elapsedMs)}
            </div>
            {!isRunning ? (
              <button onClick={startTimer} className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition">Start</button>
            ) : (
              <button onClick={pauseTimer} className="px-4 py-2 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition">Pause</button>
            )}
            <button onClick={handleConfirmResetTimer} className="px-4 py-2 rounded-full bg-gray-300 hover:bg-gray-400 text-gray-900 transition">Reset</button>
            <div className="flex items-center gap-2 bg-white/20 rounded-2xl px-3 py-2">
              <label className="text-white text-sm">− sec</label>
              <input
                type="number"
                min={0}
                max={120}
                value={preSeconds}
                onChange={(e) => setPreSeconds(Math.max(0, Math.min(120, Number(e.target.value) || 0)))}
                className="w-24 px-2 py-1 rounded-xl bg-white text-gray-900"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-2xl px-3 py-2">
              <label className="text-white text-sm">+ sec</label>
              <input
                type="number"
                min={0}
                max={120}
                value={postSeconds}
                onChange={(e) => setPostSeconds(Math.max(0, Math.min(120, Number(e.target.value) || 0)))}
                className="w-24 px-2 py-1 rounded-xl bg-white text-gray-900"
              />
            </div>
          </div>
          </div>
{/* Gruplu tag/etiket butonları */}
          <div className="flex flex-row flex-wrap gap-6 justify-center">
            
            {/* Sadece hiç tag yoksa bu mesajı göster */}
            {tagTypes.length === 0 && (
              <div className="text-white/80 text-sm">No tags yet. Add tags from the Tags page.</div>
            )}

            {/* Tag varsa, gruplara ayırarak göster */}
            {tagTypes.length > 0 && groupsForTimeline.map((groupData) => (
              
              // Sadece içinde tag olan gruplar için bir sütun oluştur
              groupData.tags.length > 0 && (
                <div 
                  key={`tag-group-${groupData.group}`} 
                  className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg" // Dikey sütun
                >
                  {/* Grup Başlığı */}
                  <h3 className="text-white/70 text-sm font-semibold mb-1 text-center">
                    Grup {groupData.group}
                  </h3>
                  
                  {/* Bu gruptaki tag'ler (yukarıdan aşağıya) */}
                  {groupData.tags.map((t) => (
                    <button
                      key={t.name} // key olarak index yerine adı kullanmak daha iyidir
                      onClick={() => handleTagClick(t.name)}
                      className="px-4 py-2 rounded-full shadow transition"
                      style={{ backgroundColor: t.color, color: getTextColor(t.color) }}
                    >
                      {(t.name || '').toUpperCase()}
                    </button>
                  ))}
                </div>
              )
              
            ))}
          </div>

          {lastInstance && (
            <div className="flex justify-center">
              <button onClick={handleUndo} className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm transition">
                Undo {(lastInstance.tagName || lastInstance.code || "").toUpperCase()} ({formatTime(lastInstance.start * 1000)}–{formatTime(lastInstance.end * 1000)})
              </button>
            </div>
          )}

          {/* Shared time line at the top */}
          <div className="relative w-full h-8">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-white/40 rounded-full" />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-yellow-400"
              style={{ left: pct(nowSec) }}
              title={`Now ${nowSec.toFixed(2)}s`}
            />
          </div>

          {/* Compact stacked rows grouped by group number - one row per group */}
          <div className="space-y-2">
            {groupsForTimeline.map((groupData) => (
              <div key={`group-${groupData.group}`} className="flex items-center gap-2">
                <div className="w-8 text-white text-xs font-medium text-center shrink-0">G{groupData.group}</div>
                <div className="relative flex-1 h-6">
                  <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/20 rounded-full" />
                  {groupData.instances.map((inst) => {
                    const tagName = inst.tagName || inst.code || '';
                    const displayName = tagName.toUpperCase();
                    return (
                      <div
                        key={`seg-${inst.ID}`}
                        className="absolute top-1/2 -translate-y-1/2 h-4 rounded-md opacity-95 flex items-center justify-center"
                        style={{ left: pct(inst.start), width: `calc(${pct(inst.end)} - ${pct(inst.start)})`, backgroundColor: inst.color }}
                        title={`Group ${groupData.group} - #${inst.ID} ${inst.code} ${inst.start}s → ${inst.end}s`}
                      >
                        <span className="px-1 text-[10px] font-semibold whitespace-nowrap overflow-hidden" style={{ color: getTextColor(inst.color) }}>
                          {displayName.length > 10 ? displayName.slice(0,10) + '…' : displayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {groupsForTimeline.length === 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 text-white text-xs font-medium text-center shrink-0">G1</div>
                <div className="relative flex-1 h-5">
                  <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/20 rounded-full" />
                </div>
              </div>
            )}
          </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                <button onClick={() => setExportOpen((v) => !v)} className="px-4 py-2 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition">Export</button>
                <button onClick={handleNewMatch} className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition">New match</button>
              </div>
              {exportOpen && (
                <div className="w-full max-w-lg bg-white rounded-xl shadow-lg overflow-hidden p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      placeholder="Home Team"
                      value={teamA}
                      onChange={(e) => setTeamA(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200"
                    />
                    <input
                      placeholder="Away Team"
                      value={teamB}
                      onChange={(e) => setTeamB(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200"
                    />
                  </div>
                  <button onClick={handleDownloadXml} className="w-full px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Download XML ({instances.length} tags)</button>
                </div>
              )}
            </div>
        </div>
      </main>

      <div className="h-10" />
    </div>
  );
};

export default XmlCreator;