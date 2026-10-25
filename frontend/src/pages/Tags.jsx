import React, { useEffect, useState } from "react";

const STORAGE_KEY = "catotag.tags";
const GROUPS_KEY = "catotag.tagGroups";

const Tags = () => {
  const [tags, setTags] = useState([]); // [{ name, color, group }]
  const [newTag, setNewTag] = useState("");
  const [color, setColor] = useState("#10b981");
  const [groupNumber, setGroupNumber] = useState(1);
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalized = Array.isArray(parsed)
          ? parsed.map((t) => {
              if (typeof t === "string") return { name: t, color: "#10b981", group: 1 };
              return { ...t, group: t.group || 1 };
            })
          : [];
        setTags(normalized);
      }
    } catch {}
    try {
      const g = localStorage.getItem(GROUPS_KEY);
      if (g) setGroups(JSON.parse(g));
    } catch {}
  }, []);

  const persistTags = (next) => {
    setTags(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("catotag-tags-updated"));
    } catch {}
  };

  const persistGroups = (next) => {
    setGroups(next);
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {}
  };

  const addTag = () => {
    const name = newTag.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) return;
    persistTags([...tags, { name, color, group: groupNumber || 1 }]);
    setNewTag("");
  };

  const updateTagGroup = (tagName, newGroup) => {
    persistTags(tags.map((t) => (t.name === tagName ? { ...t, group: newGroup || 1 } : t)));
  };

  const removeTag = (name) => {
    persistTags(tags.filter((x) => x.name !== name));
  };

  const saveGroup = () => {
    const gname = groupName.trim();
    if (!gname) return;
    const next = [...groups.filter((g) => g.name.toLowerCase() !== gname.toLowerCase()), { name: gname, tags }];
    persistGroups(next);
    setGroupName("");
  };

  const applyGroup = (g) => {
    persistTags(g.tags || []);
  };

  return (
    <div className="max-w-xl mx-auto bg-white/10 rounded-3xl shadow-xl p-6 space-y-6 border border-white/10">
      <h2 className="text-2xl font-semibold text-white text-center">Manage Tags</h2>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          placeholder="Add a tag (e.g., Person)"
          className="flex-1 min-w-[200px] px-4 py-3 rounded-2xl bg-white/80 focus:bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-300"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-12 h-12 p-1 rounded-xl bg-white/70 cursor-pointer"
          title="Pick color"
        />
        <input
          type="number"
          min={1}
          max={10}
          value={groupNumber}
          onChange={(e) => setGroupNumber(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          placeholder="Group"
          className="w-20 px-3 py-3 rounded-2xl bg-white/80 focus:bg-white text-gray-900 focus:outline-none focus:ring-4 focus:ring-indigo-300"
          title="Group number"
        />
        <button onClick={addTag} className="px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow transition">
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-white shadow"
            style={{ backgroundColor: t.color }}
          >
            <span>{t.name}</span>
            <span className="text-xs opacity-80">G{t.group || 1}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={t.group || 1}
              onChange={(e) => updateTagGroup(t.name, Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="w-10 px-1 py-0.5 rounded bg-black/20 text-white text-xs"
              onClick={(e) => e.stopPropagation()}
            />
            <button onClick={() => removeTag(t.name)} className="rounded-full bg-black/20 hover:bg-black/30 px-2">×</button>
          </div>
        ))}
        {!tags.length && (
          <div className="text-white/80 text-sm">No tags yet. Add your first tag above.</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name (e.g., First Half)"
          className="flex-1 px-4 py-3 rounded-2xl bg-white/80 focus:bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-300"
        />
        <button onClick={saveGroup} className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow transition">
          Save Tag Group
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium text-white">Saved Groups</h3>
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <div key={g.name} className="flex items-center justify-between bg-white/10 rounded-2xl p-3 border border-white/10">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-white font-medium mr-2">{g.name}</span>
                {(g.tags || []).map((t) => (
                  <span key={t.name} className="px-2 py-1 rounded-full text-white text-xs" style={{ backgroundColor: t.color }}>{t.name} G{t.group || 1}</span>
                ))}
              </div>
              <button onClick={() => applyGroup(g)} className="px-4 py-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition">Use</button>
            </div>
          ))}
          {!groups.length && <div className="text-white/70 text-sm">No saved groups yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default Tags;
