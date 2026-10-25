import React, { useState } from "react";
import useStoredState from "../lib/useStoredState";
import {
  DEFAULTS_KEY,
  DEFAULT_WINDOW,
  GROUP_COUNT,
  MAX_SECONDS,
  PRESETS_KEY,
  TAGS_KEY,
  clampSeconds,
  normalizeDefaults,
  normalizeTags,
  optionalSeconds,
} from "../lib/tags";
import { Card, MiniField, inputClass, miniInputClass } from "../components/ui";
import { XIcon } from "../components/Icons";

const SWATCHES = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#f4f4f5",
];

const normalizePresets = (list) => (Array.isArray(list) ? list.filter((p) => p && p.name) : []);

const GroupSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    className="h-7 rounded-md bg-ink-950 text-white text-sm px-1 focus:outline-none focus:ring-2 focus:ring-accent/40"
  >
    {Array.from({ length: GROUP_COUNT }, (_, i) => i + 1).map((n) => (
      <option key={n} value={n}>{n}</option>
    ))}
  </select>
);

// Empty = use the default clip window
const SecondsInput = ({ value, placeholder, onChange, label }) => (
  <input
    type="number"
    inputMode="numeric"
    min={0}
    max={MAX_SECONDS}
    value={value ?? ""}
    placeholder={String(placeholder)}
    onChange={(e) => onChange(optionalSeconds(e.target.value))}
    aria-label={label}
    className={miniInputClass}
  />
);

const Tags = () => {
  const [tags, setTags] = useStoredState(TAGS_KEY, [], normalizeTags);
  const [defaults, setDefaults] = useStoredState(DEFAULTS_KEY, DEFAULT_WINDOW, normalizeDefaults);
  const [presets, setPresets] = useStoredState(PRESETS_KEY, [], normalizePresets);

  const [newTag, setNewTag] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [group, setGroup] = useState(1);
  const [pre, setPre] = useState(null);
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [presetName, setPresetName] = useState("");

  const addTag = () => {
    const name = newTag.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setError(`“${name}” already exists.`);
      return;
    }
    setTags([...tags, { name, color, group, pre, post }]);
    setNewTag("");
    setError("");
  };

  const updateTag = (name, patch) => setTags(tags.map((t) => (t.name === name ? { ...t, ...patch } : t)));

  const removeTag = (name) => setTags(tags.filter((t) => t.name !== name));

  const savePreset = () => {
    const name = presetName.trim();
    if (!name || tags.length === 0) return;
    setPresets([...presets.filter((p) => p.name.toLowerCase() !== name.toLowerCase()), { name, tags }]);
    setPresetName("");
  };

  const applyPreset = (preset) => {
    if (tags.length > 0 && !window.confirm(`Replace your current ${tags.length} tags with “${preset.name}”?`)) return;
    setTags(normalizeTags(preset.tags));
  };

  const deletePreset = (preset) => {
    if (!window.confirm(`Delete preset “${preset.name}”?`)) return;
    setPresets(presets.filter((p) => p.name !== preset.name));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-extrabold">Tags</h1>

      <Card title="Add tag">
        <input
          value={newTag}
          onChange={(e) => {
            setNewTag(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          placeholder="Tag name, e.g. Goal"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`w-8 h-8 rounded-full transition ${
                color === c ? "ring-2 ring-offset-2 ring-offset-ink-900 ring-white scale-110" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Custom color"
            className={`w-8 h-8 ${SWATCHES.includes(color) ? "" : "ring-2 ring-offset-2 ring-offset-ink-900 ring-white rounded-[10px]"}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MiniField label="Group">
            <GroupSelect value={group} onChange={setGroup} />
          </MiniField>
          <MiniField label="Before">
            <SecondsInput value={pre} placeholder={defaults.pre} onChange={setPre} label="Seconds before tap" />
          </MiniField>
          <MiniField label="After">
            <SecondsInput value={post} placeholder={defaults.post} onChange={setPost} label="Seconds after tap" />
          </MiniField>
          <button
            onClick={addTag}
            disabled={!newTag.trim()}
            className="ml-auto h-11 px-6 rounded-xl bg-accent text-ink-950 font-bold hover:brightness-110 disabled:opacity-40 transition"
          >
            Add
          </button>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </Card>

      <Card
        title={`Your tags (${tags.length})`}
        description="Before/After are seconds around the tap. Leave empty to use the default clip window."
      >
        {tags.length === 0 ? (
          <p className="text-sm text-ink-400">No tags yet. Add your first tag above.</p>
        ) : (
          <ul className="-my-3 divide-y divide-ink-800">
            {tags.map((t) => (
              <li key={t.name} className="py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={t.color}
                    onChange={(e) => updateTag(t.name, { color: e.target.value })}
                    title="Change color"
                    className="w-9 h-9 shrink-0"
                  />
                  <span className="flex-1 min-w-0 truncate font-bold uppercase tracking-wide">{t.name}</span>
                  <button
                    onClick={() => removeTag(t.name)}
                    aria-label={`Delete ${t.name}`}
                    className="w-9 h-9 grid place-items-center rounded-lg text-ink-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 sm:pl-12">
                  <MiniField label="Group">
                    <GroupSelect value={t.group || 1} onChange={(g) => updateTag(t.name, { group: g })} />
                  </MiniField>
                  <MiniField label="Before">
                    <SecondsInput
                      value={t.pre}
                      placeholder={defaults.pre}
                      onChange={(v) => updateTag(t.name, { pre: v })}
                      label={`${t.name} seconds before tap`}
                    />
                  </MiniField>
                  <MiniField label="After">
                    <SecondsInput
                      value={t.post}
                      placeholder={defaults.post}
                      onChange={(v) => updateTag(t.name, { post: v })}
                      label={`${t.name} seconds after tap`}
                    />
                  </MiniField>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Default clip window" description="How much video to keep around each tap, unless a tag sets its own.">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-ink-400">Seconds before tap</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_SECONDS}
              value={defaults.pre}
              onChange={(e) => setDefaults({ ...defaults, pre: clampSeconds(e.target.value) })}
              className={`${inputClass} mt-1 tabular-nums`}
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink-400">Seconds after tap</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_SECONDS}
              value={defaults.post}
              onChange={(e) => setDefaults({ ...defaults, post: clampSeconds(e.target.value) })}
              className={`${inputClass} mt-1 tabular-nums`}
            />
          </label>
        </div>
      </Card>

      <Card title="Presets" description="Save the current tag set and switch between setups (e.g. per team or competition).">
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && savePreset()}
            placeholder="Preset name, e.g. Tactical analysis"
            className={inputClass}
          />
          <button
            onClick={savePreset}
            disabled={!presetName.trim() || tags.length === 0}
            className="h-11 px-5 shrink-0 rounded-xl bg-ink-700 font-bold hover:bg-ink-600 disabled:opacity-40 transition"
          >
            Save
          </button>
        </div>
        {presets.length === 0 ? (
          <p className="text-sm text-ink-400">No saved presets yet.</p>
        ) : (
          <ul className="space-y-2">
            {presets.map((p) => (
              <li key={p.name} className="rounded-xl bg-ink-800 border border-ink-700 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate font-bold">{p.name}</span>
                  <button
                    onClick={() => applyPreset(p)}
                    className="h-9 px-4 rounded-lg bg-accent text-ink-950 text-sm font-bold hover:brightness-110"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => deletePreset(p)}
                    aria-label={`Delete preset ${p.name}`}
                    className="w-9 h-9 grid place-items-center rounded-lg text-ink-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {normalizeTags(p.tags).map((t) => (
                    <span
                      key={t.name}
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: `${t.color}33`, color: t.color }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default Tags;
