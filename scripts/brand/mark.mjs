/**
 * The SCORMite mark, generated from a handful of parameters so every size
 * stays pixel-exact and the variants stay consistent.
 *
 * Concept — "open the package, find the mite": an isometric SCORM package
 * with its lid lifted, and the mite (the tiny defect SCORMite exists to
 * find) visible inside. Original construction, not derived from any icon
 * set.
 *
 * Pixel-perfect: true pixel-art isometry. Every edge has a 2:1 slope and
 * every vertex lies on an integer coordinate of a 32-unit grid, so at 32px
 * (and its multiples) each edge steps exactly one pixel down per two across.
 *
 * Colours are the app's tokens (src/index.css): accent, accent-muted, a deep
 * accent shade, surfaces, and success for the mite.
 */

export const COLORS = {
  lid: '#4da3ff',
  light: '#2f6fb0',
  dark: '#1d4a78',
  innerWall: '#1f242c',
  floor: '#0b0d10',
  mite: '#3fb950',
  miteLight: '#2ea043',
  miteDark: '#1f7a34',
  tile: '#101317',
}

const points = (list) => list.map(([x, y]) => `${x},${y}`).join(' ')
const down = ([x, y], d) => [x, y + d]

function diamond(cx, top, w) {
  const h = w / 2
  return { t: [cx, top], r: [cx + w, top + h], b: [cx, top + 2 * h], l: [cx - w, top + h] }
}

/**
 * @param {object} g geometry, all integers on the 32-unit grid
 * @param {number} g.cx    horizontal centre
 * @param {number} g.top   top vertex of the lid
 * @param {number} g.w     half-width of the package (even, so w/2 is an integer)
 * @param {number} g.lidT  lid thickness
 * @param {number} g.rimTop top vertex of the open rim (how far the lid is lifted)
 * @param {number} g.wall  wall height
 * @param {number} g.miteW half-width of the mite (even)
 * @param {number} g.miteY vertical centre of the mite
 */
export function markShapes({ cx, top, w, lidT, rimTop, wall, miteW, miteY }) {
  const lid = diamond(cx, top, w)
  const rim = diamond(cx, rimTop, w)
  const mh = miteW / 2
  return [
    // Inside the open package: back inner walls, then the floor.
    `<polygon points="${points([rim.l, rim.t, rim.r, down(rim.r, wall), down(rim.t, wall), down(rim.l, wall)])}" fill="${COLORS.innerWall}"/>`,
    `<polygon points="${points([down(rim.l, wall), down(rim.t, wall), down(rim.r, wall), down(rim.b, wall)])}" fill="${COLORS.floor}"/>`,
    // The mite: a tiny cube in the package's own visual language.
    `<polygon points="${points([[cx - miteW, miteY], [cx, miteY + mh], down([cx, miteY + mh], mh), down([cx - miteW, miteY], mh)])}" fill="${COLORS.miteLight}"/>`,
    `<polygon points="${points([[cx + miteW, miteY], [cx, miteY + mh], down([cx, miteY + mh], mh), down([cx + miteW, miteY], mh)])}" fill="${COLORS.miteDark}"/>`,
    `<polygon points="${points([
      [cx, miteY - mh],
      [cx + miteW, miteY],
      [cx, miteY + mh],
      [cx - miteW, miteY],
    ])}" fill="${COLORS.mite}"/>`,
    // Front walls.
    `<polygon points="${points([rim.l, rim.b, down(rim.b, wall), down(rim.l, wall)])}" fill="${COLORS.light}"/>`,
    `<polygon points="${points([rim.r, rim.b, down(rim.b, wall), down(rim.r, wall)])}" fill="${COLORS.dark}"/>`,
    // The lifted lid: its thickness, then its top.
    `<polygon points="${points([lid.l, lid.b, down(lid.b, lidT), down(lid.l, lidT)])}" fill="${COLORS.light}"/>`,
    `<polygon points="${points([lid.r, lid.b, down(lid.b, lidT), down(lid.r, lidT)])}" fill="${COLORS.dark}"/>`,
    `<polygon points="${points([lid.l, lid.t, lid.r, lid.b])}" fill="${COLORS.lid}"/>`,
  ]
}

/** Transparent mark, for dark surfaces (app header, social image). */
export const MARK_GEOMETRY = { cx: 16, top: 1, w: 12, lidT: 2, rimTop: 12, wall: 8, miteW: 4, miteY: 18 }

/** The mark drawn natively on a 24-unit grid, for 24px placements (app header). */
export const HEADER_GEOMETRY = { size: 24, cx: 12, top: 0, w: 10, lidT: 2, rimTop: 9, wall: 5, miteW: 4, miteY: 14 }

/** The mark on the app tile, for favicons and app icons (any background). */
export const ICON_GEOMETRY = { cx: 16, top: 5, w: 10, lidT: 2, rimTop: 14, wall: 6, miteW: 4, miteY: 19 }

export function markSvg(geometry = MARK_GEOMETRY) {
  const size = geometry.size ?? 32
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="SCORMite">
  ${markShapes(geometry).join('\n  ')}
</svg>
`
}

/** `rounded: false` gives a full-bleed square, for platforms that round icons themselves (iOS). */
export function iconSvg({ rounded = true, geometry = ICON_GEOMETRY } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="SCORMite">
  <rect width="32" height="32"${rounded ? ' rx="7"' : ''} fill="${COLORS.tile}"/>
  <g shape-rendering="crispEdges">
  ${markShapes(geometry).join('\n  ')}
  </g>
</svg>
`
}
