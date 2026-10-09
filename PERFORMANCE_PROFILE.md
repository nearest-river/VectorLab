# VectorLab Performance Profile (baseline, nothing optimized)

Measured on 2026-10-08 against the project exactly as it stands after the Eigen
Vector rename and the four new guides. **No performance changes have been
made.** This file is the baseline for the optimization step.

## 1. How this was measured (and what it can't tell us)

- **Project type:** static site, no bundler or build step. "Production build" =
  the files served as-is. Served locally by a small Node server that gzips text
  assets (level 6) to mimic a compressing static host.
- **Tools:** Lighthouse (mobile preset, simulated throttling) via CLI, plus a
  Puppeteer harness driving headless Chrome 131: mobile viewport 412×823 @2.625
  DPR, **4× CPU throttle**, CDP `Performance.getMetrics`, `Profiler` (self-time
  per script), `PerformanceObserver` (paint/LCP/longtask/layout-shift). 3 runs
  for page load; medians quoted unless noted.
- **Sandbox limits (important):**
  - Google Fonts, AdSense, cdnjs and jsDelivr are **blocked in the sandbox**.
    Lighthouse therefore saw them as ~0.2 KB failures. For the Puppeteer runs I
    served the _same versions_ from npm (three.js r128, KaTeX 0.16.11) via
    request interception, so their sizes and CPU cost are real; their **network
    time is not measured**. **Fonts and AdSense are not measured at all.**
  - Headless Chrome uses **software WebGL/compositing**, with no real GPU and no
    real phone. GPU-bound numbers (3D tab, blur/compositing) are inflated or
    unrepresentative. Treat them as relative evidence and re-check on a real
    mid-range Android device.
  - Hosting headers (compression, cache lifetime) of the live domain were not
    verified from here.
- Raw Lighthouse JSON and the harness scripts were produced in a scratch folder
  and are **not** committed.

## 2. Headline numbers

| Metric                                              | Result                                                                     | Notes                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Lighthouse mobile, home (gzip server)               | **98**                                                                     | FCP 1.9 s, LCP 1.9 s, TBT 0 ms, CLS 0, TTI 2.1 s                                   |
| Lighthouse mobile, home (**no compression**)        | **88**                                                                     | FCP 3.0 s, LCP 3.1 s, TBT 70 ms. Compression alone moves the score about 10 points |
| Lighthouse mobile, guide `/guides/eigenvalues.html` | **100**                                                                    | FCP 1.5 s, 10 KiB transferred, **with KaTeX/fonts/ads blocked** (see B7)           |
| 4× CPU throttle, home load (median of 3)            | FCP/LCP **673 ms**, DOMContentLoaded 1,502 ms, load 1,565 ms               | runs: FCP 934/586/673                                                              |
| 4× CPU throttle, Total Blocking Time (3 runs)       | **840 / 568 / 556 ms**                                                     | first long task 336 ms at ~430 ms; 9 long tasks (>50 ms) in run 1                  |
| 4× CPU throttle, main thread (median)               | Script 878 ms, Layout 123 ms, Style recalc 47 ms, total task time 2,321 ms | 22–29 layouts, 14–15 style recalcs during load                                     |
| DOM size at load                                    | **4,044 elements**                                                         | all tabs' markup is in the initial HTML; 29 `.glass` cards                         |
| JS heap after load                                  | 7–7.6 MB                                                                   | no leak signal over the interaction run (7.0 MB at the end)                        |

## 3. Bundle sizes

No bundling, so "initial bundle" = everything the `<script>` tags in
`index.html` fetch. All are classic synchronous scripts at the end of `<body>`
(no `defer`/`async`/modules).

### 3.1 Initial JS on `/` (raw / gzip bytes, gzip per file)

| File                                        |           Raw |        Gzip |
| ------------------------------------------- | ------------: | ----------: |
| `js/algebra/stepmath-engine.js`             |        43,066 |      12,381 |
| `js/linear-algebra/row-reduction.js`        |        22,470 |       8,873 |
| `js/calculus/calculus-ui.js`                |        20,992 |       7,839 |
| `js/algebra/stepmath-ui.js`                 |        18,018 |       4,674 |
| `js/visualization/eigen-visualizer.js`      |        17,797 |       6,939 |
| `js/linear-algebra/linear-combination.js`   |        16,535 |       6,246 |
| `js/linear-algebra/eigen-calculator.js`     |        14,341 |       5,603 |
| `js/linear-algebra/vector-explorer.js`      |        11,743 |       4,428 |
| `js/linear-algebra/eigen-core.js`           |        11,669 |       4,657 |
| `js/visualization/three-helpers.js`         |         7,551 |       2,848 |
| `js/core/legal.js`                          |         4,501 |       1,910 |
| `js/visualization/null-space.js`            |         4,435 |       2,195 |
| `js/visualization/vector3d.js`              |         4,408 |       1,788 |
| `js/visualization/matrix-transform3d.js`    |         3,290 |       1,526 |
| `js/linear-algebra/matrix-core.js`          |         1,984 |         881 |
| `js/core/tabs.js`                           |         1,738 |         720 |
| `js/core/utils.js`                          |         1,069 |         579 |
| **Local JS subtotal (17 files)**            |   **205,607** |  **74,087** |
| `three.min.js` r128 (cdnjs, **eager**)      |       603,445 |     148,737 |
| `katex.min.js` 0.16.11 (cdnjs, **eager**)   |       275,414 |      75,496 |
| **Initial JS total incl. third-party libs** | **1,084,466** | **298,320** |

Not measured: `adsbygoogle.js` (async, in `<head>`), Google Fonts CSS and font
files.

### 3.2 Lazy JS (loaded on first open of the Calculus category: works as intended)

| File                               |     Raw |    Gzip |
| ---------------------------------- | ------: | ------: |
| `js/vendor/nerdamer.bundle.min.js` | 540,799 | 134,727 |
| `js/vendor/function-plot.min.js`   | 202,953 |  59,891 |
| `js/calculus/calculus-engine.js`   |  28,427 |  10,260 |

Confirmed in the browser: the two vendor files are requested only after clicking
the Calculus category. Opening it caused long tasks of 59, 352 and 103 ms at 4×
throttle.

### 3.3 CSS (all render-blocking, loaded for every visit)

| File               |    Raw |  Gzip |
| ------------------ | -----: | ----: |
| `css/style.css`    | 25,211 | 5,926 |
| `css/calculus.css` | 14,429 | 3,732 |
| `css/eigen.css`    |  7,356 | 2,253 |

Plus ~6 KB of inline `<style>` in `index.html` and the render-blocking Google
Fonts stylesheet.

### 3.4 Page weights by route (HTML only, raw / gzip bytes)

| Page                                             |    Raw |   Gzip |
| ------------------------------------------------ | -----: | -----: |
| `index.html`                                     | 56,383 | 12,780 |
| `guides/calculus-differentiation.html`           | 12,300 |  3,627 |
| `guides/calculus-integration.html`               | 11,353 |  3,487 |
| `guides/calculus-limits.html`                    | 11,166 |  3,488 |
| `guides/eigenvalues-matrix-transformations.html` | 14,385 |  4,052 |
| `guides/eigenvalues.html`                        | 14,996 |  4,881 |
| `guides/eigenvectors.html`                       | 15,522 |  4,565 |
| `guides/gaussian-elimination.html`               |  7,219 |  2,709 |
| `guides/index.html`                              |  5,825 |  1,699 |
| `guides/long-division.html`                      |  5,758 |  2,109 |
| `guides/matrix-diagonalization.html`             | 14,525 |  4,258 |
| `guides/matrix-rank.html`                        |  7,552 |  2,865 |
| `guides/null-space-3d.html`                      |  6,091 |  2,253 |
| `guides/partial-fractions.html`                  |  5,594 |  2,094 |
| `guides/row-reduction.html`                      |  7,659 |  2,844 |
| `guides/synthetic-division.html`                 |  5,674 |  2,088 |
| `guides/vectors-span.html`                       |  6,192 |  2,268 |

Every guide additionally loads `guides.css` (3.7 KB), AdSense and Google Fonts;
the calculus and eigen guides also load KaTeX (275 KB raw / 75 KB gzip) from
cdnjs. Images: there are no `<img>` tags in `index.html`; `og-image.png` is 26
KB and the icons are ≤10 KB, so images are not a bottleneck.

### 3.5 Largest dependencies (raw)

1. `three.min.js` 603 KB (**eager**, third-party)
2. `nerdamer.bundle.min.js` 541 KB (lazy)
3. `katex.min.js` 275 KB (**eager**, third-party)
4. `function-plot.min.js` 203 KB (lazy)
5. `stepmath-engine.js` 43 KB (eager, unminified)

## 4. Bottlenecks

Format: **Problem → Evidence → Likely impact → Possible optimization.** Impact
is my read of the evidence, not a promise.

### B1. three.js (603 KB) loaded eagerly on every home visit, used by one tab

- **Problem:** the whole library is fetched and evaluated at startup.
- **Evidence:** `three.min.js` is a synchronous `<script>` in `index.html` (plus
  a `document.write` fallback to jsDelivr). Only `three-helpers.js`,
  `vector3d.js`, `matrix-transform3d.js` and `null-space.js` use it, all behind
  the "3D & null space" tab. CPU profile self-time at 4× throttle: **~231 ms**
  to parse/evaluate it.
- **Likely impact:** High for first load on mobile: ~149 KB gzip plus a few
  hundred ms of main thread, for visitors who never open that tab. If cdnjs is
  slow or blocked, the `document.write` fallback blocks the parser.
- **Possible optimization:** load three.js and the four 3D scripts on first
  visit to tab 4 (the Calculus libs already use this pattern in
  `calculus-ui.js`); drop the `document.write` fallback.

### B2. KaTeX (275 KB) loaded eagerly on the home page

- **Problem:** loaded for everyone, needed only by some tabs.
- **Evidence:** synchronous script; CPU self-time **~235 ms** at 4× throttle. It
  is used only by `stepmath-ui.js` (Higher Algebra tabs) and `calculus-ui.js`,
  both with a plain-text fallback when `window.katex` is absent.
- **Likely impact:** High, same size class as B1. It is also on every guide page
  that renders math.
- **Possible optimization:** load on first use of the Higher Algebra / Calculus
  categories, or `defer` it; for guides, consider build-time MathML so they
  don't need the library.

### B3. Everything initializes at startup, including tabs the user hasn't opened

- **Problem:** all tabs' init code runs before the page is interactive.
- **Evidence:** 17 local scripts plus 2 libs run synchronously; `tabs.js`
  bootstraps every tab (`renderVecs`, `renderOpsSel`, `renderAnalysis`,
  `renderExpr`, `r3Init`, `renderInputs`, `renderResults`, `draw`, and
  `animate(I3, …)` at load). Lighthouse bootup-time attributes the most script
  time to `linear-combination.js` (211 ms scripting) and `tabs.js` (189 ms); the
  profiler shows `linear-combination.js` at ~220 ms self-time at 4× throttle,
  the largest of the app's own files. Lighthouse lists 24 render-blocking
  resources (est. savings 900 ms on the gzip server, 1,720 ms uncompressed).
- **Likely impact:** High on mid/low-end phones: this is the source of the
  556–840 ms TBT and the 9 long tasks under 4× throttle. Unthrottled Lighthouse
  TBT is only 0–70 ms.
- **Possible optimization:** defer non-visible tabs' init until first open;
  `defer` the scripts; keep only tab 1 on the critical path.

### B4. First open of the 3D tab is very slow (and renders three scenes)

- **Problem:** opening "3D & null space" blocks the main thread for seconds.
- **Evidence:** at 4× throttle, clicking tab 4 took **4.7 s** to the second
  frame (long tasks 621 ms + **4,106 ms**); a second measurement later in the
  session took **2.6 s** (208 ms + 2,371 ms). Three WebGL canvases (`c3v`,
  `c3m`, `c3n`) are each **913×685 px** (renderer pixel ratio is
  `min(devicePixelRatio, 3)`). `draw4()` ran **3 times** for a single tab visit
  (see B6), each time rebuilding geometry and label sprites for all three
  scenes.
- **Caveat:** headless Chrome uses software WebGL, so absolute times are far
  worse than on a real GPU. The context count, the DPR cap of 3 and the triple
  redraw are real code facts.
- **Likely impact:** High on mobile; probably the heaviest interaction. Three
  simultaneous WebGL contexts also risk memory pressure on low-end devices.
- **Possible optimization:** cap pixel ratio at ~2 on mobile; render only the
  visible scene(s); avoid the redundant `draw4()` calls; reuse label textures;
  verify on a real device first.

### B5. Unminified, unbundled app JS

- **Problem:** 17 separate unminified files.
- **Evidence:** Lighthouse "minify JavaScript": est. 24 KiB raw savings
  (`stepmath-engine.js` 8.5 KB, `eigen-visualizer.js` 4.2 KB, `eigen-core.js`
  3.8 KB, …). Per-file gzip total is 74 KB vs. 206 KB raw.
- **Likely impact:** Low to medium. Gzip hides most of the size cost;
  parse/compile is small (Lighthouse 34–77 ms).
- **Possible optimization:** minify and group per tab; this needs a small build
  step.

### B6. Redundant redraws when switching tabs

- **Problem:** each tab visit runs its draw function more than once.
- **Evidence:** cycling tabs 2→3→4→5→6→1 once, with the draw functions wrapped:
  `drawE` ×3, `r3Draw` ×3, `draw4` ×3, `draw` ×2, `egvDraw` ×1. `showTab()`
  calls `redraw()`, and the `ResizeObserver`s on `#vizE`, `#rgeo`, `#p4`, `#viz`
  call it again when the panel gets a size. A viewport height change on tab 1
  triggered 0 redraws, so plain resizes are not the problem.
- **Likely impact:** Low for 2D tabs (30–137 ms to the second frame at 4×);
  medium for the 3D tab (B4).
- **Possible optimization:** schedule one `requestAnimationFrame` draw per
  visit; guard the observers on the active tab.

### B7. Guides depend on KaTeX from a CDN; raw LaTeX shows until it runs (new guides included)

- **Problem:** math in guides is rendered at runtime by a 275 KB library.
- **Evidence:** the guides reuse `calculus-guides.js`, which renders `.tex`
  nodes with KaTeX loaded from cdnjs at the end of `<body>`. Until then the raw
  LaTeX source is visible (seen in a screenshot with the CDN blocked).
  Lighthouse for `/guides/eigenvalues.html` scored 100 and CLS 0, but **only
  because KaTeX/fonts/ads were blocked**; real layout shift and load cost are
  unmeasured. The 4 new guides contain 193 math snippets.
- **Likely impact:** Medium for guide LCP/CLS on real networks (unverified),
  plus 75 KB gzip of JS for mostly static content.
- **Possible optimization:** pre-render math to MathML at authoring time
  (`output: 'mathml'` is already used) so guides need no runtime library.

### B8. Render-blocking CSS and fonts

- **Problem:** four blocking stylesheets before first paint.
- **Evidence:** `style.css` 25 KB, `calculus.css` 14 KB, `eigen.css` 7 KB plus
  the Google Fonts stylesheet (Sora ×4 weights, STIX Two Text ×3 faces).
  Lighthouse unused CSS: **30 KiB** potential savings; `calculus.css` is 100%
  unused on first view, `style.css` 63%. Font transfer cost could not be
  measured here (`display=swap` is set). Lighthouse found no preconnect hints.
- **Likely impact:** Medium: delays first paint (FCP 1.9 s on Lighthouse's
  simulated mobile).
- **Possible optimization:** load tab-specific CSS lazily or inline the critical
  part; trim font weights/faces; preconnect to the font hosts.

### B9. Third-party scripts (not measurable here)

- **Problem:** unknown cost.
- **Evidence:** `adsbygoogle.js` (async, in `<head>` of the home page and every
  guide), Google Fonts, cdnjs (KaTeX, three), jsDelivr fallback. All blocked in
  the sandbox, so **transfer size, CPU cost and layout impact are unknown**.
- **Likely impact:** Unknown. Ad scripts are often a large main-thread
  contributor, but that is not established for this site.
- **Possible optimization:** none until measured on the live site with a real
  device or WebPageTest.

### B10. Compositing-heavy styling: `backdrop-filter`, fixed background, masks

- **Problem:** possible paint/compositing cost on phones.
- **Evidence:** `.glass` uses `backdrop-filter: blur(18px)` on **31 elements**
  (4 visible on first screen; the rest are in hidden tabs). `body` has
  `background-attachment: fixed` plus a fixed full-screen masked grid
  (`body::before`), and several `mask-image` rules in `calculus.css`. Lighthouse
  puts **Rendering at ~1.44 s of 3.8 s** main-thread time in its runs. **But**
  my A/B scroll test (4× throttle, 90 frames, 3 runs per variant) showed **no
  difference**: median frame 16.7 ms in all variants, 0 to 1 frames over 33 ms,
  with and without `backdrop-filter`, and with and without the fixed background.
- **Likely impact:** **Unconfirmed.** In software-rendered headless Chrome these
  effects did not hurt scrolling, and Lighthouse's Rendering figure is also
  software-rendered. Real phone GPUs may behave differently.
- **Possible optimization:** don't change anything on this evidence alone. Test
  on a real device first; if it shows up there, reduce blur radius or the number
  of blurred layers.

### B11. Large DOM from all tabs being in the initial HTML

- **Evidence:** 4,044 elements at load; `index.html` is 56 KB raw / 12.8 KB
  gzip; 22–29 layouts and 14–15 style recalcs during load (123 ms layout + 47 ms
  style at 4×).
- **Likely impact:** Low to medium.
- **Possible optimization:** worth doing only together with B3.

### B12. Animations and canvas redraws (checked, mostly fine)

- **Evidence:** the Eigen Vector "Play" animation held **16.7 ms median, 33 ms
  p95** over 120 frames at 4× throttle. Eigen 2×2 Calculate took 15 ms to the
  next frame; 4×4 + Calculate 64 ms with one 56 ms long task. CSS animations are
  short (`cardIn` 0.38 s, `rflash`/`egFresh` 0.9 s; `egFresh` animates
  `box-shadow`, which repaints); the only infinite animations (`clSpin`,
  `clShim`) are in the Calculus loading state. JS animations redraw the whole
  canvas each frame.
- **Likely impact:** Low today.
- **Possible optimization:** none needed; keep this as the "must not regress"
  baseline.

### B13. Compression and caching depend on the host

- **Evidence:** the same site scored **88 uncompressed vs. 98 with gzip** in
  Lighthouse. Filenames are not hashed, so long cache lifetimes aren't safe. The
  live domain's headers could not be checked from the sandbox.
- **Likely impact:** High if the live host doesn't compress; none if it does.
- **Possible optimization:** confirm `Content-Encoding` and `Cache-Control` on
  `vectorlab.co.in` first.

### B14. SVG

- **Evidence:** the app has one tiny inline SVG (the logo, under 1 KB) and draws
  everything else on 8 `<canvas>` elements. The new guide figures are 2.8–3.6 KB
  each.
- **Likely impact:** None.

## 5. Things that are already fine

- Calculus libraries (~772 KB raw / ~205 KB gzip) load lazily only when needed.
- Resize observers don't redraw on unrelated viewport changes.
- Hidden-tab canvases stay at the 300×150 default until shown; visible ones
  (`cin`, `cout`) are 700×700.
- No large images; CLS 0 on the home page (with fonts/KaTeX blocked).
- JS heap stayed ~7 MB through the whole interaction run.

## 6. Suggested order for the next step (not done yet)

1. Confirm host compression/caching (B13) and measure the live site on a real
   device (B9, B10).
2. Lazy-load three.js + the 3D scripts (B1) and KaTeX (B2); `defer` the
   remaining scripts.
3. Make non-visible tab init lazy and coalesce redraws (B3, B6).
4. Reduce the 3D rendering cost (B4) after a real-device check.
5. Trim CSS/fonts (B8), then re-run this harness and compare against section 2.
