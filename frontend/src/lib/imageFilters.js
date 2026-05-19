/**
 * imageFilters — CSS filter string + style builder for media filter persistence.
 *
 * Filter shape (persisted on media_library.filters jsonb):
 *   {
 *     brightness: number  // default 1   range [0.5..1.5]
 *     contrast:   number  // default 1   range [0.5..1.5]
 *     saturation: number  // default 1   range [0..2]
 *     rotate:     number  // default 0   range -180..180  (degrees)
 *   }
 *
 * NOT implemented (out of scope on purpose):
 *   • blur, grayscale, sepia, hue-rotate
 *   • complex layer masks
 *   • per-channel curves
 *
 * Rendering: storefront, Blueprint preview, projects, magazine, moodboards,
 * media library all consume `imageStyle(asset)` so a single update on the
 * Library re-renders consistently everywhere.
 */

export const DEFAULT_FILTERS = {
  brightness: 1,
  contrast:   1,
  saturation: 1,
  rotate:     0,
};

export const hasFilters = (f) => {
  if (!f) return false;
  return (
    (f.brightness != null && f.brightness !== 1) ||
    (f.contrast   != null && f.contrast   !== 1) ||
    (f.saturation != null && f.saturation !== 1) ||
    (f.rotate     != null && f.rotate     !== 0)
  );
};

export const cssFilterOf = (f) => {
  if (!hasFilters(f)) return undefined;
  const parts = [];
  if (f.brightness != null && f.brightness !== 1) parts.push(`brightness(${f.brightness})`);
  if (f.contrast   != null && f.contrast   !== 1) parts.push(`contrast(${f.contrast})`);
  if (f.saturation != null && f.saturation !== 1) parts.push(`saturate(${f.saturation})`);
  return parts.length ? parts.join(' ') : undefined;
};

/**
 * Builds a complete inline style for an asset (filter + transform + focal point).
 * Usage:
 *   <img src={asset.display_url} style={imageStyle(asset)} alt={asset.alt_text} />
 *
 * asset shape (only the fields we need):
 *   { filters?: {...}, focal_point?: {x, y} }
 */
export const imageStyle = (asset) => {
  if (!asset) return undefined;
  const f = asset.filters || {};
  const fp = asset.focal_point || {};
  const style = {};
  const css = cssFilterOf(f);
  if (css) style.filter = css;
  if (f.rotate != null && f.rotate !== 0) style.transform = `rotate(${f.rotate}deg)`;
  if (fp.x != null || fp.y != null) {
    style.objectPosition = `${(fp.x ?? 0.5) * 100}% ${(fp.y ?? 0.5) * 100}%`;
  }
  return Object.keys(style).length ? style : undefined;
};
