The bd sandbox lives outside the project repo at:

  ~/code/gsd-beads-spike-sandbox/

It's intentionally NOT inside .planning/spikes/002-beads-modeling/ because
`bd init` (without --stealth) auto-commits to the parent repo. Per the
spike-validation-plan.md exit criterion ("Throwaway test repo... separate from
gsd-beads/ itself so test pollution can't dirty the source repo"), the sandbox
is external.

The cascade-close script lives in this spike directory and operates against
that sandbox.
