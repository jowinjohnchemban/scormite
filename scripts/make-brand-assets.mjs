/**
 * Generates every brand asset in `public/` from the mark's geometry
 * (`scripts/brand/mark.mjs`), so all of them stay consistent:
 *
 *   logo-mark.svg         the mark, 32-unit grid — dark surfaces, social image
 *   logo-mark-24.svg      the mark drawn on a 24-unit grid — the 24px app header
 *   logo.svg              the mark on the app tile — favicon, README, light surfaces
 *   icon-192.png          web app manifest icon
 *   icon-512.png          web app manifest icon
 *   apple-touch-icon.png  180×180, full-bleed (iOS rounds icons itself)
 *   og-image.png          1200×630 social preview (Open Graph / Twitter)
 *
 * The outputs are committed, so builds and CI never run this. Regenerate
 * after changing the mark, the colours, or the headline:
 *
 *   node scripts/make-brand-assets.mjs
 */

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { HEADER_GEOMETRY, iconSvg, markSvg } from './brand/mark.mjs'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

// Theme tokens from src/index.css.
const SURFACE_950 = '#0b0d10'
const SURFACE_800 = '#171b21'
const BORDER = '#262b33'
const ACCENT = '#4da3ff'
const MUTED = '#7f93ab'

const svgFiles = {
  'logo-mark.svg': markSvg(),
  'logo-mark-24.svg': markSvg(HEADER_GEOMETRY),
  'logo.svg': iconSvg(),
}

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: ${SURFACE_950}; color: #f0f6fc;
         font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; display: flex; }
  .wrap { padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; width: 100%;
          background: radial-gradient(circle at 85% 20%, rgba(77,163,255,0.16), transparent 45%); }
  .brand { display: flex; align-items: center; gap: 20px; font-size: 40px; font-weight: 600; letter-spacing: -0.5px; }
  .brand img { width: 64px; height: 64px; image-rendering: pixelated; }
  h1 { font-size: 60px; line-height: 1.12; font-weight: 700; letter-spacing: -1px; max-width: 980px; }
  h1 em { font-style: normal; color: ${ACCENT}; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; }
  .chip { border: 1px solid ${BORDER}; background: ${SURFACE_800}; color: #c9d1d9; border-radius: 999px;
          padding: 8px 18px; font-size: 22px; }
  .foot { color: ${MUTED}; font-size: 22px; }
</style></head><body><div class="wrap">
  <div class="brand"><img src="${dataUri(svgFiles['logo-mark.svg'])}" alt="">SCORMite</div>
  <h1>Test, debug and validate <em>SCORM&nbsp;1.2 &amp; 2004</em> packages in your browser</h1>
  <div class="chips">
    <span class="chip">Multi-SCO player</span><span class="chip">SCORM 2004 sequencing</span>
    <span class="chip">Resume testing</span><span class="chip">API log</span>
    <span class="chip">Validation</span><span class="chip">QA reports</span>
  </div>
  <div class="foot">Runs locally — your package never leaves the browser</div>
</div></body></html>`

const iconHtml = (svg, size) => `<!doctype html><html><head><style>
  * { margin: 0; } body { width: ${size}px; height: ${size}px; background: transparent; }
  img { width: ${size}px; height: ${size}px; display: block; }
</style></head><body><img src="${dataUri(svg)}" alt=""></body></html>`

for (const [file, svg] of Object.entries(svgFiles)) {
  await writeFile(join(publicDir, file), svg)
  console.log(`wrote public/${file}`)
}

const browser = await chromium.launch()
try {
  const shots = [
    { file: 'icon-192.png', size: [192, 192], html: iconHtml(iconSvg(), 192) },
    { file: 'icon-512.png', size: [512, 512], html: iconHtml(iconSvg(), 512) },
    { file: 'apple-touch-icon.png', size: [180, 180], html: iconHtml(iconSvg({ rounded: false }), 180) },
    { file: 'og-image.png', size: [1200, 630], html: ogHtml },
  ]
  for (const shot of shots) {
    const [width, height] = shot.size
    const page = await browser.newPage({ viewport: { width, height } })
    await page.setContent(shot.html, { waitUntil: 'load' })
    await page.screenshot({
      path: join(publicDir, shot.file),
      type: 'png',
      omitBackground: shot.file !== 'og-image.png',
    })
    await page.close()
    console.log(`wrote public/${shot.file} (${width}×${height})`)
  }
} finally {
  await browser.close()
}
