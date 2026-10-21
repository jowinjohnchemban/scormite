/**
 * Renders the committed brand images in `public/` with headless Chromium:
 *
 *   og-image.png          1200×630 social preview (Open Graph / Twitter)
 *   icon-192.png          web app manifest icon
 *   icon-512.png          web app manifest icon
 *   apple-touch-icon.png  180×180 iOS home-screen icon
 *
 * The outputs are checked in, so builds and CI never run this. Regenerate
 * after changing the logo, colors, or the SEO headline:
 *
 *   node scripts/make-brand-assets.mjs
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')

const logo = `data:image/png;base64,${(await readFile(join(publicDir, 'logo.png'))).toString('base64')}`

// Theme tokens from src/index.css.
const SURFACE_950 = '#0b0d10'
const SURFACE_800 = '#171b21'
const BORDER = '#262b33'
const ACCENT = '#4da3ff'
const MUTED = '#7f93ab'

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: ${SURFACE_950}; color: #f0f6fc;
         font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; display: flex; }
  .wrap { padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; width: 100%;
          background: radial-gradient(circle at 85% 20%, rgba(77,163,255,0.16), transparent 45%); }
  .brand { display: flex; align-items: center; gap: 20px; font-size: 40px; font-weight: 600; letter-spacing: -0.5px; }
  .brand img { width: 64px; height: 64px; object-fit: contain; }
  h1 { font-size: 60px; line-height: 1.12; font-weight: 700; letter-spacing: -1px; max-width: 980px; }
  h1 em { font-style: normal; color: ${ACCENT}; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; }
  .chip { border: 1px solid ${BORDER}; background: ${SURFACE_800}; color: #c9d1d9; border-radius: 999px;
          padding: 8px 18px; font-size: 22px; }
  .foot { color: ${MUTED}; font-size: 22px; }
</style></head><body><div class="wrap">
  <div class="brand"><img src="${logo}" alt="">SCORMite</div>
  <h1>Test, debug and validate <em>SCORM&nbsp;1.2 &amp; 2004</em> packages in your browser</h1>
  <div class="chips">
    <span class="chip">Multi-SCO player</span><span class="chip">API monitor</span>
    <span class="chip">CMI inspector</span><span class="chip">Resume testing</span>
    <span class="chip">Validation</span><span class="chip">QA reports</span>
  </div>
  <div class="foot">Runs locally — your package never leaves the browser</div>
</div></body></html>`

const iconHtml = (size) => `<!doctype html><html><head><style>
  * { margin: 0; } body { width: ${size}px; height: ${size}px; background: ${SURFACE_950};
  display: grid; place-items: center; }
  img { width: ${Math.round(size * 0.68)}px; height: ${Math.round(size * 0.68)}px; object-fit: contain; }
</style></head><body><img src="${logo}" alt=""></body></html>`

const browser = await chromium.launch()
try {
  const shots = [
    { file: 'og-image.png', width: 1200, height: 630, html: ogHtml },
    { file: 'icon-192.png', width: 192, height: 192, html: iconHtml(192) },
    { file: 'icon-512.png', width: 512, height: 512, html: iconHtml(512) },
    { file: 'apple-touch-icon.png', width: 180, height: 180, html: iconHtml(180) },
  ]
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } })
    await page.setContent(shot.html, { waitUntil: 'load' })
    await page.screenshot({ path: join(publicDir, shot.file), type: 'png' })
    await page.close()
    console.log(`wrote public/${shot.file} (${shot.width}×${shot.height})`)
  }
} finally {
  await browser.close()
}
