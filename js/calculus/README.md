# calculus/

Live: **Limits**, **Differentiation**, **Integration** (indefinite) and **Definite Integral** (`calculus-engine.js` + `calculus-ui.js`).

- **Math is done by [Nerdamer](https://nerdamer.com)** (`js/vendor/nerdamer.bundle.min.js`, v2.0.0): `diff()`, `limit()` and `integrate()`.
  VectorLab never parses, simplifies, differentiates or integrates by itself.
- `calculus-engine.js` (no DOM): input cleanup (`ln`→`log`), two guards around Nerdamer limit quirks
  (two-sided limits are decided by comparing left/right; numeric fallback is labelled "estimate"),
  and small rule *templates* (sum/product/quotient/chain/power/exponential) for the explanations.
- `calculus-ui.js` (DOM): panels, examples, rendering. Plots use **function-plot** (`js/vendor/function-plot.min.js`).
- Both libraries lazy-load the first time the Calculus tab is opened, so other pages are unaffected.

Integration: `integrate()` results are verified numerically (d/dx of the answer must match the integrand) and rejected if unevaluated/complex; fallbacks (expand + term by term, u-substitution) still call Nerdamer. Unsupported inputs return a friendly error.

Not yet built: higher-derivative/Leibniz extras, L'Hôpital page, series, improper integrals.

Definite integrals: `CalcLab.definite(expr,a,b)` reuses `integrate()` for the antiderivative and lets Nerdamer substitute the bounds. Bounds must be finite constants. Integrands undefined/unbounded on [a,b] are refused (FTC would be wrong), and F(b)-F(a) is cross-checked against a numerical sum before display.
