# vite-windows-alias-duplication

> **AI disclosure** — This minimal reproduction repo (the repro code, the CI workflow,
> and this README) was created with the assistance of AI (Claude). The bug itself was
> first observed in a real codebase; the AI was used to isolate it down to this minimal,
> CI-verified case.

Minimal reproduction of a **Vite 8 / Rolldown** bug on **Windows**: when one source
file is imported through two specifiers that resolve to the same physical file — one a
**relative** path (`./shared`) and one a **tsconfig path alias** (`@shared/index`) —
the production build emits **two copies** of that module. The two copies are distinct
instances, so a module-level singleton (here a `Symbol`) is duplicated and the two
values are no longer `===`. In a real app this showed up as a duplicated
`React.createContext`, so a Provider and a `useContext` bound to different context
objects ("must be used within a Provider").

The alias is resolved by **Vite 8 / Rolldown's own native tsconfig-path resolution** —
**no plugin is involved.** This repo ships with no Vite plugins at all. Rolldown's
native resolver auto-discovers `tsconfig.json` and applies its `compilerOptions.paths`,
and on Windows it emits the resolved id with **back-slashes** while the relative import
resolves to a **forward-slash** id. Rolldown keys its module graph on the raw id string
and treats the two as separate modules.

> **`vite-tsconfig-paths` was ruled out.** An earlier draft of this repo blamed that
> plugin. That attribution was wrong. The plugin only resolves importers whose
> extension matches `/\.[mc]?tsx?$/` by default (it skips `.js` importers unless
> `allowJs` or a `jsconfig.json` is in play), and dropping the plugin entirely does
> **not** change the outcome: the duplication persists. The duplication is produced by
> Vite/Rolldown's native resolution, not by the plugin.

## Continuous verification

A GitHub Actions matrix (`.github/workflows/repro.yml`) runs the repro on both
`ubuntu-latest` and `windows-latest` on every push.

Expected outcome:

- **Linux job green** — prints `OK`, single module instance, exit 0.
- **Windows job red** — prints `DUPLICATED`, exit 1.

A failing Windows job is the bug being present — that asymmetry IS the proof that this
is Windows-specific. (CI has no `continue-on-error`, so the red Windows job is intentional.)

Confirmed run: <https://github.com/caillou/vite-windows-alias-duplication/actions/runs/26359787682>
(ubuntu-latest `success` / `OK`, 5 modules; windows-latest `failure` / `DUPLICATED`, 6 modules).

Latest runs: <https://github.com/caillou/vite-windows-alias-duplication/actions/workflows/repro.yml>

The root cause is a path-normalization mismatch inside **Vite 8 / Rolldown's native
tsconfig-path resolution**: the two import specifiers resolve to ids that differ **only
by slash direction** (forward vs back slash). Rolldown's module graph keys on the raw
id string and treats them as two modules.

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

A temporary `load`-hook inspection plugin (not shipped) showed the same file loaded
under two ids that differ only by slash direction:

```
"C:/dev/vite-windows-alias-duplication/src/shared/index.js"      <- relative  ./shared
"C:\\dev\\vite-windows-alias-duplication\\src\\shared\\index.js"  <- alias @shared/index
```

The relative import resolves to a POSIX-style (forward-slash) id; Rolldown's native
tsconfig-path resolution returns a Windows-style (back-slash) id. Rolldown does not
normalize these to a single module key on Windows, hence the duplicate.

## Which layer is implicated

Isolated empirically on Windows, one variable at a time:

- **`vite-tsconfig-paths` plugin — NOT implicated.** Removing the plugin entirely (no
  plugins in `vite.config.js`, dependency dropped) still reproduces the duplication.
  The plugin's default importer filter is `/\.[mc]?tsx?$/`, so it skips `.js` importers
  anyway.
- **Vite core `resolve.alias` — NOT implicated.** Mapping `@shared` via Vite's own
  `resolve.alias`, even feeding a deliberately back-slashed replacement, normalizes to a
  single forward-slash id and prints `OK`.
- **Vite 8 / Rolldown native tsconfig-path resolution — IMPLICATED.** With no plugin and
  the default `resolve.tsconfigPaths: false`, Rolldown's resolver auto-discovers
  `tsconfig.json` and applies `compilerOptions.paths`, emitting the alias id with
  back-slashes. Proof it is this layer: renaming `tsconfig.json` so it cannot be found
  makes the build fail with `Rolldown failed to resolve import "@shared/index"` — so
  this resolution is reading the tsconfig directly, independent of any plugin.

### The `resolve.tsconfigPaths` option (and the surprising fix)

Vite 8 exposes `resolve.tsconfigPaths` (boolean, **default `false`**). Counter-
intuitively, the **default `false` is the buggy state** and setting it to **`true` fixes
the duplication**:

| `resolve.tsconfigPaths` | who resolves `@shared` | resolved id | result |
|---|---|---|---|
| `false` (default) | Rolldown native auto-discovery | back-slash | **6 modules, DUPLICATED** |
| `true` | Vite's native handling | forward-slash | 5 modules, `OK` |

So `resolve.tsconfigPaths: true` routes tsconfig-paths resolution through Vite's own
(normalized) handling instead of letting Rolldown's resolver emit a back-slash id. This
repo intentionally leaves the option at its default to demonstrate the out-of-the-box
behavior.

## Pinned versions

| Tool | Version |
|------|---------|
| node | 24.15.0 |
| pnpm | 10.33.0 (via corepack / `packageManager`) |
| vite | 8.0.10 |
| rolldown (bundled in vite) | 1.0.0-rc.17 |
