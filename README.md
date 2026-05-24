# vite-windows-alias-duplication

> **AI disclosure** — This minimal reproduction repo (the repro code, the CI workflow,
> and this README) was created with the assistance of AI (Claude). The bug itself was
> first observed in a real codebase; the AI was used to isolate it down to this minimal,
> CI-verified case.

Minimal reproduction of a **Vite 8 / Rolldown** bug on **Windows**: when one source
file is imported through two specifiers that resolve to the same physical file — one a
**relative** path (`./shared`) and one a **tsconfig path alias** (`@shared/index`,
resolved by `vite-tsconfig-paths`) — the production build emits **two copies** of that
module. The two copies are distinct instances, so a module-level singleton (here a
`Symbol`) is duplicated and the two values are no longer `===`. In a real app this
showed up as a duplicated `React.createContext`, so a Provider and a `useContext`
bound to different context objects ("must be used within a Provider").

## Continuous verification

A GitHub Actions matrix (`.github/workflows/repro.yml`) runs the repro on both
`ubuntu-latest` and `windows-latest` on every push.

Expected outcome:

- **Linux job green** — prints `OK`, single module instance, exit 0.
- **Windows job red** — prints `DUPLICATED`, exit 1.

A failing Windows job is the bug being present — that asymmetry IS the proof that this
is Windows-specific. (CI has no `continue-on-error`, so the red Windows job is intentional.)

Confirmed run: <https://github.com/caillou/vite-windows-alias-duplication/actions/runs/26358951646>
(ubuntu-latest `success` / `OK`, 5 modules; windows-latest `failure` / `DUPLICATED`, 6 modules).

Latest runs: <https://github.com/caillou/vite-windows-alias-duplication/actions/workflows/repro.yml>

The root cause is a path-normalization mismatch: the two import specifiers resolve to
ids that differ **only by slash direction** (forward vs back slash). Rolldown's module
graph keys on the raw id string and treats them as two modules.

## Reproduce

```sh
pnpm install
pnpm run repro    # = vite build && node dist/index.js
```

## Observed

### Windows (reproduced)

```
✓ 6 modules transformed.
DUPLICATED: shared module bundled more than once.
  viaRelative: Symbol(shared-singleton)
  viaAlias   : Symbol(shared-singleton)
```
Exit code: **1**. Expected (if not buggy): `OK: single shared module instance ...`, exit 0.

`dist/index.js` contains the shared module **twice** (`grep -c 'Symbol("shared-singleton")' dist/index.js` → **2**), emitted as two separate `//#region src/shared/index.js` blocks producing `TOKEN$1` and `TOKEN`.

### Linux

Verified in CI on `ubuntu-latest`: a single shared module instance (`OK`, exit 0).
The bug is Windows-specific. See **Continuous verification** above for the live matrix
run.

## Resolver smoking gun

A `load`-hook inspection plugin showed the same file loaded under two ids that differ
only by slash direction:

```
"C:/dev/vite-windows-alias-duplication/src/shared/index.js"     <- relative  ./shared
"C:\\dev\\vite-windows-alias-duplication\\src\\shared\\index.js" <- alias @shared/index (vite-tsconfig-paths)
```

The relative import resolves to a POSIX-style (forward-slash) id; `vite-tsconfig-paths`
returns a Windows-style (back-slash) id. Rolldown does not normalize these to a single
module key on Windows, hence the duplicate.

## Which layer is implicated

Reproduced at **Rung C** (`vite-tsconfig-paths` plugin). It does **not** reproduce with
Vite core's manual `resolve.alias` (Rung A, all specifier variations, and Rung B with
two separate importer files all printed `OK`). So the duplication is introduced by the
**alias plugin emitting a back-slash id**, not by Vite core's own alias resolution.

## Pinned versions

| Tool | Version |
|------|---------|
| node | 24.15.0 |
| pnpm | 10.33.0 (via corepack / `packageManager`) |
| vite | 8.0.10 |
| rolldown (bundled in vite) | 1.0.0-rc.17 |
| vite-tsconfig-paths | 6.1.1 |
