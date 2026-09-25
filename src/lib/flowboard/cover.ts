/**
 * v2 board covers — section-aligned palette.
 *
 * Data finding from the real-data review (phase 2 → 3): every FlowBoard
 * shipped the flat Trello-blue default (#0079bf), which read as alien to
 * the vivid dashboard design. Boards whose color is one of the section
 * identity colors below render as a rich two-stop gradient (vivid top,
 * fading into the dark navy base) instead of a flat fill. The set is
 * persisted only in code — the DB stores the hex — so the look survives
 * reloads without a schema change.
 */
export const GRADIENT_COVER_COLORS = new Set<string>([
  '#7C5CFC', // بنفش Tasks
  '#2E8BFF', // آبی Command Center
  '#F59E0B', // کهربایی Brands
  '#17BFC4', // فیروزه‌ای Social
  '#10B981', // زمردی Finance
  '#EC4899', // سرخابی Content
]);

/** Default cover when a board has no color/image — purple tasks gradient. */
export const DEFAULT_BOARD_COVER =
  'linear-gradient(135deg, hsl(var(--section-tasks)) 0%, hsl(254 45% 24%) 120%)';

/**
 * CSS background for a board cover: a vivid gradient for v2 section
 * colors, the raw color otherwise. `${color}66` alpha works because v2
 * colors are always 6-digit hex.
 */
export function coverBackground(color: string): string {
  return GRADIENT_COVER_COLORS.has(color)
    ? `linear-gradient(135deg, ${color} 0%, ${color}66 55%, #0B1526 130%)`
    : color;
}
