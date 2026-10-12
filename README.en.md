# ResinDB Pro by SunHJ — English Design Edition

[中文设计版](README.zh-CN.md) · [Complete bilingual technical documentation](README.md)


<!-- CLOSURE_STATUS_START -->
## Current qualification and operating boundary

- `CI` is the authoritative full software gate; `contracts-v17` adds cross-platform screening regressions.
- Redundant exact-tree, V19 custom-status, and duplicate full-qualification workflows were removed. The primary CI already emits exact-tree evidence.
- The Spearman correlation matrix uses the shared finite-number parser and complete-case selection; missing, blank, boolean, malformed and non-finite inputs remain unobserved rather than being silently rewritten as physical zeroes.
- Browser AI is restricted to the same-origin `/api/ai/proxy`, stores no provider key, and denies grade/vendor/formulation/free-text egress by default.
- A software pass does not establish proxy deployment, key custody, privacy/legal approval, material release, regulatory compliance, or experimental truth.
<!-- CLOSURE_STATUS_END -->

<!-- LOCALIZED_VISION_EN:START -->
## Project vision: from resin data to material decisions and scientific visualization

<p align="center">
  <img src="docs/localized-vision/resindb-vision-en.svg" width="100%" alt="ResinDB Pro English material data and scientific decision architecture">
</p>

> Every module and equation maps to current data, compute, Worker, ECharts and acceptance code. The figure is not resin test data, grade certification or force-field validation.

<!-- LOCALIZED_VISION_EN:END -->

## Positioning

ResinDB Pro joins resin grades, experimental/reference properties, statistical models, scientific-compute Workers, polymer-physics templates and reproducible acceptance in one evidence chain. It is not a certified LIMS, ERP, material-release system or validated force-field platform.

## Mathematical core

Multivariate anomaly magnitude uses the Mahalanobis distance:

$$
D_M(\mathbf{x})=
\sqrt{(\mathbf{x}-\boldsymbol{\mu})^{\mathsf T}
\boldsymbol{\Sigma}^{-1}
(\mathbf{x}-\boldsymbol{\mu})}.
$$

A non-Newtonian rheology proxy uses the Carreau–Yasuda form:

$$
\eta(\dot\gamma)=
\eta_\infty+
(\eta_0-\eta_\infty)
\left[1+(\lambda\dot\gamma)^a\right]^{(n-1)/a}.
$$

The decision-observable uncertainty budget keeps parameter, sampling, model-form and scale-transfer terms distinct:

$$
\boldsymbol{\Sigma}_y
\approx
\mathbf{J}\boldsymbol{\Sigma}_\theta\mathbf{J}^{\mathsf T}
+
\boldsymbol{\Sigma}_{\mathrm{sample}}
+
\boldsymbol{\Sigma}_{\mathrm{model}}
+
\boldsymbol{\Sigma}_{\mathrm{transfer}}.
$$

A scientific figure is accepted only when values are finite, semantics are labelled, ECharts has completed rendering and the Canvas is non-blank:

$$
C_{\mathrm{figure}}
=
C_{\mathrm{finite}}
\land C_{\mathrm{labeled}}
\land C_{\mathrm{finished}}
\land C_{\mathrm{nonblank}}.
$$

Direct addition of these components, including the sum-of-squares budget in the conceptual diagram, assumes unit-consistent, uncorrelated contributions expressed in the same observable. Correlated inputs require cross-covariance terms: general first-order propagation is $u_y^2\approx\sum_{i,j}J_iJ_j\operatorname{Cov}(x_i,x_j)$. These equations specify modeling assumptions; they do not establish validated uncertainty for an arbitrary material system.

## Similarity and radar profiles: implemented numerical contracts

The implementation is `src/services/mathUtils.ts`; permanent regressions live in `tests/unit/mathUtils.test.ts`. Harmonize units before parsing complete decimal or scientific-notation values. Empty strings, booleans, partial numeric strings, NaN and infinities are not observations.

For finite feature bounds $a$ and $b$, ordinary min-max normalization is $z=(x-a)/(b-a)$. Opposite-sign finite endpoints can still overflow the floating-point difference $b-a$. In that case, set $s=\max(|a|,|b|)$ and use the equivalent scaled expression:

$$
z=\frac{x/s-a/s}{b/s-a/s}.
$$

Clamp the result to $[0,1]$. The existing constant-feature policy is unchanged: the numerical range must exceed $32\epsilon\max(1,|a|,|b|)$ and have at least two finite observations. This threshold is a software screening rule, not an instrument-resolution claim.

Let $q$ be the target's comparable active-feature count and $m$ the candidate's shared active-feature count. Candidates require $m\ge2$. The score is:

$$
S=\operatorname{round}\left[
100\frac{m}{q}\max\left(0,1-
\sqrt{\frac{1}{m}\sum_{j=1}^{m}(z_{tj}-z_{pj})^2}
\right)\right].
$$

Missing dimensions reduce supported coverage through $m/q$; they are not imputed as zero. Radar profiles use the same global ranges, display $100z$, and retain only dimensions observed finitely for every selected product.

Euclidean distances accumulate with pairwise `Math.hypot`, avoiding false overflow or underflow from direct squaring. A true distance beyond the floating-point representation range still requires the caller to reject a non-finite result before plotting. Feature statistics use prototype-free dictionaries so that `__proto__`, `constructor` and `toString` remain ordinary feature names.

Targeted reproduction after installing locked dependencies:

```bash
npm ci
npx vitest run tests/unit/mathUtils.test.ts --pool=forks --maxWorkers=1
npm run validate:unicode
npm run validate:scientific-ui
```

Regressions cover large and tiny values, 601 orders of magnitude, extreme signed ranges, reserved property names, ordinary coverage-aware scoring and radar coordinates. A targeted regression pass is not full CI, browser visual acceptance or six-hour endurance qualification.

## Operating strategy

1. Validate Schema, units, standards, temperature, provenance and evidence class first.
2. Run statistics, fitting and material screening only on finite, dimensionally compatible data.
3. Keep observations, fits, proxies and scenario projections distinct; association must not be promoted to causation.
4. Polymer/LAMMPS templates require external force-field, equilibration and experimental validation before supporting scientific conclusions.
5. Scientific figures must pass CJK/font readiness where relevant, the ECharts `finished` event, non-blank Canvas and PNG evidence gates.
6. READMEs, SVGs and translations are audited for UTF-8, Unicode controls, CJK fallbacks and local-image integrity.

## Acceptance

```bash
npm ci
npm run validate:docs
npm run validate:i18n-visuals
npm run validate:scientific-ui
npm run typecheck
npm run test:unit
npm run build
npm run test:ui
```

Software acceptance covers data contracts, implemented computations, interface rendering and reproducible evidence. Grade release, experimental truth, force-field applicability and industrial decisions still require independent qualification.

<!-- CURRENT_MAIN_ACCEPTANCE_V2:START -->
## Current implementation: code, mathematics and usage

![English code and mathematical-contract concept](docs/current-main/resindb-current-main-en.svg)

> ResinDB Pro is a local-first scientific data and analysis workbench, not a certified LIMS/ERP, commercial force field, industrial grade-release system or automatic scientific approval engine.

#### Continuous-coordinate KDE

$$
\widehat f(x,y)=\frac{1}{2\pi n h_xh_y}\sum_{i=1}^n\exp\!\left[-\frac12\left(\frac{x-x_i}{h_x}\right)^2-\frac12\left(\frac{y-y_i}{h_y}\right)^2\right]
$$

The separable bivariate Gaussian kernel requires positive bandwidths; density has inverse-product coordinate units. The figure layer uses custom cells on continuous axes and preserves original density rather than treating coordinates as category indices. A finite display window generally integrates to less than one; color intensity or relative maximum is not probability.

Source mapping: [`src/compute/gaussianKde.ts`](src/compute/gaussianKde.ts) · [`src/components/charts/kdeFigure.ts`](src/components/charts/kdeFigure.ts)

#### Weibull median-rank fit

$$
F(v)=1-e^{-(v/\eta)^m},\qquad \ln[-\ln(1-F(v))]=m\ln v-m\ln\eta,\qquad B_5=\eta[-\ln(0.95)]^{1/m}
$$

Positive v and η are required; m is the shape parameter. The UI uses ordinary least-squares linearization of Bernard median ranks, not maximum-likelihood estimation (not MLE). B5 is the fitted 5% failure quantile, not a 95% parameter-confidence bound or a safety-release guarantee. Titles, legends and tooltips follow the selected language.

Source mapping: [`src/components/charts/WeibullChart.tsx`](src/components/charts/WeibullChart.tsx)

#### Figure delivery gate

$$
C_{\mathrm{figure}}=C_{\mathrm{finite}}\land C_{\mathrm{labels}}\land C_{\mathrm{finished}}\land C_{\mathrm{nonblank}}
$$

This explanatory figure contract combines finite-data counts, labels, completion events and nonblank-canvas evidence, while distinguishing no data from an unavailable renderer. A screenshot alone is not proof of scientific correctness; test browser behavior, themes, locales and reopening charts.

Source mapping: [`src/components/charts/ScientificEChart.tsx`](src/components/charts/ScientificEChart.tsx)

### Usage and acceptance sequence

1. Check the installation environment, input structure, units, applicability and execution permissions.
2. Use the source mappings above to distinguish native implementation, explanatory contracts and external execution requirements.
3. Run focused regression and full quality gates before long-duration testing of pinned commits.
4. Preserve original logs, machine-readable reports and limitations; missing evidence must never be reported as PASS.

```bash
npm ci
npm run validate:ci
```

Retest every changed commit. Baseline regression, two three-hour regression segments, browser visual checks and external engineering qualification are distinct evidence classes. Without original receipts, no six-hour completion is claimed.

Implementation anchors: [`src/data/dataContract.ts`](src/data/dataContract.ts) · [`src/services/mathUtils.ts`](src/services/mathUtils.ts) · [`src/compute/capabilityProbe.ts`](src/compute/capabilityProbe.ts)

<!-- CURRENT_MAIN_ACCEPTANCE_V2:END -->
