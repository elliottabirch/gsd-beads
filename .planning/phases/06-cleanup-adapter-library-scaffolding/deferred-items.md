# Phase 6 deferred items

Items discovered during plan execution that are out of scope for the
current plan. Logged per executor scope-boundary rule.

## From plan 06-06 (adapter shell + clusters)

### tests/unit/structural-cleanup.test.mjs failure (pre-existing)

- **Test:** `CLEAN-03: REQUIREMENTS.md adopts D-12 cascade-loop archives`
- **Assertion:** Expects regex `/scripts\/cascade-loop\.sh also archives/`
  to match REQUIREMENTS.md content.
- **Status:** Pre-existing failure; verified by running the same test on
  a stash of plan 06-06 work — fails identically without our changes.
- **Out of scope:** This is a CLEAN-03 D-12 task in a different plan
  (likely 06-02 or 06-03 archive-shadow). Not caused by plan 06-06.
- **Action:** None taken. Surface for whoever owns CLEAN-03 follow-up.

### Plan 06-06 acceptance arithmetic mismatch (cosmetic)

- **Plan said:** longTail.mjs should have 80 methods (verify regex
  `M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/longTail.mjs); test "$M" -eq 80`).
- **Reality:** REQUIREMENTS.md IMPL-08 lists 37 methods (not 32 as the
  plan's section comment claims). REQUIREMENTS.md is source of truth.
  Total: 18+37+8+12+10 = 85 methods.
- **Regex artifact:** `bootstrapFromGsd2` contains a digit (`2`) so the
  plan's regex `[a-zA-Z]+` does not match it; grep returns 84 even
  though the file has 85 actual methods.
- **Action:** longTail.mjs ships with the full REQUIREMENTS.md surface
  (85 methods). The plan's overall ±5 tolerance on the 282-method
  total covers the deviation (actual 287). No code change needed; this
  note documents the count drift between PLAN comment and REQUIREMENTS.
