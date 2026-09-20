/**
 * Build the /brands/[id] detail href for a brand card.
 *
 * Links MUST carry the brand's UUID whenever one is resolvable — the detail
 * page and its APIs are UUID-based (`getBrandById` → `brands.id`). Cards
 * whose accounts were never backfilled (brand_id NULL — e.g. «کبریت»,
 * «سینه فیلیا», 8 legacy brands total) used to fall back to the brand NAME,
 * which broke the detail page. `resolvedId` comes from the RLS-scoped
 * /api/brands name→id map; the encoded-name fallback remains ONLY for
 * social-only brands that have no brands row at all (getBrandById resolves
 * those by name).
 */
export function brandDetailHref(
  name: string,
  resolvedId?: string | null,
): string {
  return `/brands/${resolvedId ? resolvedId : encodeURIComponent(name)}`;
}
