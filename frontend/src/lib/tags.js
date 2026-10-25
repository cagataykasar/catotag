export const TAGS_KEY = "catotag.tags";
export const PRESETS_KEY = "catotag.tagGroups";
export const DEFAULTS_KEY = "catotag.defaults";

export const DEFAULT_WINDOW = { pre: 5, post: 10 };
export const MAX_SECONDS = 300;
export const GROUP_COUNT = 10;

export const clampSeconds = (v) => Math.max(0, Math.min(MAX_SECONDS, Math.round(Number(v) || 0)));

// null = "use the default clip window"
export const optionalSeconds = (v) => (v === null || v === undefined || v === "" ? null : clampSeconds(v));

export const normalizeTags = (list) =>
  Array.isArray(list)
    ? list.filter(Boolean).map((t) =>
        typeof t === "string"
          ? { name: t, color: "#10b981", group: 1, pre: null, post: null }
          : {
              ...t,
              color: t.color || "#10b981",
              group: t.group || 1,
              pre: optionalSeconds(t.pre),
              post: optionalSeconds(t.post),
            }
      )
    : [];

export const normalizeDefaults = (d) => ({
  pre: d && Number.isFinite(d.pre) ? clampSeconds(d.pre) : DEFAULT_WINDOW.pre,
  post: d && Number.isFinite(d.post) ? clampSeconds(d.post) : DEFAULT_WINDOW.post,
});

export const clipWindow = (tag, defaults) => ({
  pre: tag.pre ?? defaults.pre,
  post: tag.post ?? defaults.post,
});

export const formatTime = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const getTextColor = (bg) => {
  try {
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? "#07090d" : "#ffffff";
  } catch {
    return "#ffffff";
  }
};
