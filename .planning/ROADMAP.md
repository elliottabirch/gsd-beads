# Roadmap

## Milestone v0.1 — Foundation

### Phase 1: Spike — validate beads + GSD topology

Throwaway test of the architectural assumptions in
`notes/beads-gsd-architecture.md` before committing to the full layer. See
`notes/spike-validation-plan.md` for what it must validate.

**Status:** complete
**Depends on:** —

### Phase 2: Build the layer

The full skill + hook + script implementation. Gated on Phase 1 success.

**Goal:** Productionize the 13 spike POCs into a `git clone && ./install.sh` distribution that gates GSD planning state behind beads, leaving GSD core untouched (REQ-01..REQ-08).

**Status:** complete (2026-04-28)
**Depends on:** Phase 1
**Requirements:** [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08]
**Plans:** 7 plans

Plans:
- [x] 02-01-bd-helpers-PLAN.md — `cascade-loop.sh`, `regen-roadmap.sh`, `regen-requirements.sh` (REQ-01)
- [x] 02-02-hooks-PLAN.md — `block-state-md.sh`, `bd-sync.sh`, `block-gsd-sdk-mutation.sh` + `settings.fragment.json` + 3 hook test suites (REQ-04, REQ-07)
- [x] 02-03-shadow-binary-PLAN.md — `gsd-sdk-shadow.mjs` + 13 bd-backed handlers + `wrap-mutation.mjs` (REQ-01, REQ-02, REQ-04)
- [x] 02-04-worktree-init-PLAN.md — `worktree-post-checkout.sh` sentinel-marker shim + idempotency tests (REQ-03)
- [x] 02-05-install-script-PLAN.md — `install.sh` self-contained installer + bd memory seeding + symlink (REQ-02, REQ-06, REQ-08)
- [x] 02-06-e2e-smoke-test-PLAN.md — fresh fixture E2E + perf gate + concurrent-merge + post-gsd-update + bd-ready (REQ-01..REQ-08)
- [x] 02-07-gap-closure-PLAN.md — install.sh path substitution + portable awk capitalization in regen-requirements.sh (REQ-04, REQ-06; closes 02-VERIFICATION.md gaps)

### Phase 3: Cross-worktree validation

Verify shared `BEADS_DIR` works across multiple worktrees in real use. Document
the recommended worktree setup.

**Status:** complete (2026-04-28)
**Depends on:** Phase 2
