# Contributing to gsd-beads

## Local development against the fork

`gsd-beads` declares an **optional** peer dependency on
`get-shit-done-cc` (the fork). During development, link the fork
into this repo's `node_modules`:

```bash
# In the fork:
cd ~/code/get-shit-done
npm link

# In gsd-beads:
cd ~/code/gsd-beads
npm link get-shit-done-cc
# OR equivalently (per package.json scripts):
npm run link:fork
```

This makes `import { ... } from 'get-shit-done-cc'` resolve to the
fork's source. Phase 7+ adapter methods that delegate to fork
internals will work; Phase 6 stubs throw before hitting any fork
import.

### Strict peer-deps note

If `npm install gsd-beads` errors on missing `get-shit-done-cc`,
your project has `strict-peer-deps` enabled in its `.npmrc`. Either:
- Link the fork (`npm run link:fork`), OR
- Set `--no-strict-peer-deps` for the install.

See [npm/feedback#225](https://github.com/npm/feedback/discussions/225)
for context.

## Testing

```bash
npm test                  # unit + conformance (Phase 6: only unit, conformance is empty)
npm run test:unit         # unit only (fast)
npm run test:conformance  # conformance only (Phase 7+)
```

Tests run via Node's built-in `node:test` runner — no framework install
needed (Node >= 20 is the engines floor).

## Branch model

- `main` — released versions (`v1.0-alpha.0` and onward)
- Working branches: one per phase (e.g., `phase-6-cleanup`,
  `phase-7-primitives`, ...)

See `.planning/ROADMAP.md` for the v1.0 phase plan.

## Phase work

Each phase ships independently per the GSD workflow. Read the
phase's `.planning/phases/XX-<slug>/06-CONTEXT.md` and
`.planning/phases/XX-<slug>/06-RESEARCH.md` before opening any
`XX-NN-*-PLAN.md` for execution. Locked decisions (D-NN) in
CONTEXT.md are non-negotiable.
