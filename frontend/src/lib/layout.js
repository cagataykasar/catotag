// Free-form button grid (like a Sportscode code window).
// Each tag may carry a cell rectangle {x, y, w, h}; tags without one are auto-placed.

export const LAYOUT_KEY = "catotag.layout";
export const MIN_COLS = 2;
export const MAX_COLS = 8;
export const MAX_ROW_SPAN = 4;
export const DEFAULT_LAYOUT = { cols: 3 };

export const normalizeLayout = (l) => {
  const cols = Math.round(Number(l?.cols));
  return { cols: Number.isFinite(cols) ? Math.max(MIN_COLS, Math.min(MAX_COLS, cols)) : DEFAULT_LAYOUT.cols };
};

const isCell = (n) => Number.isInteger(n) && n >= 0;
const hasPosition = (t) => isCell(t.x) && isCell(t.y) && isCell(t.w) && isCell(t.h) && t.w >= 1 && t.h >= 1;

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Inside the grid and not covering any already placed rectangle
export const fits = (rect, placed, cols) =>
  rect.x >= 0 && rect.y >= 0 && rect.w >= 1 && rect.h >= 1 && rect.x + rect.w <= cols && !placed.some((p) => overlaps(rect, p));

const firstFreeSlot = (w, h, placed, cols, minY = 0) => {
  for (let y = minY; ; y++) {
    for (let x = 0; x + w <= cols; x++) {
      const rect = { x, y, w, h };
      if (fits(rect, placed, cols)) return rect;
    }
  }
};

// Every tag at a valid, non-overlapping cell rectangle: stored positions win in list order,
// the rest are auto-placed (each new group starting on its own row).
export const resolveLayout = (tags, cols) => {
  const placed = [];
  const byName = new Map();

  for (const t of tags) {
    if (!hasPosition(t)) continue;
    const w = Math.min(t.w, cols);
    const rect = { x: Math.min(t.x, cols - w), y: t.y, w, h: Math.min(t.h, MAX_ROW_SPAN) };
    if (fits(rect, placed, cols)) {
      placed.push(rect);
      byName.set(t.name, rect);
    }
  }

  const rest = tags.filter((t) => !byName.has(t.name)).sort((a, b) => (a.group || 1) - (b.group || 1));
  let lastGroup = null;
  let groupStartY = 0;
  for (const t of rest) {
    const group = t.group || 1;
    if (group !== lastGroup) {
      groupStartY = lastGroup === null ? 0 : rowCount(placed);
      lastGroup = group;
    }
    const rect = firstFreeSlot(1, 1, placed, cols, groupStartY);
    placed.push(rect);
    byName.set(t.name, rect);
  }

  return tags.map((tag) => ({ tag, ...byName.get(tag.name) }));
};

export const rowCount = (rects) => rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);

export const gridArea = (r) => ({ gridColumn: `${r.x + 1} / span ${r.w}`, gridRow: `${r.y + 1} / span ${r.h}` });

// Strip stored positions so every tag is auto-placed again
export const clearPositions = (tags) => tags.map(({ x, y, w, h, ...rest }) => rest);
