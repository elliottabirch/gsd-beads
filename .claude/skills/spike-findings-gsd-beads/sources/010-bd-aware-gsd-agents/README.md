---
spike: 010
name: bd-aware-gsd-agents
type: standard
validates: "Given the architecture's 'no fork' rule (REQ-02: GSD core unmodified) and Spike 006's finding of 13 BLOCKS skills, when probing whether upstream agents can be made bd-aware via in-prompt detection or runtime override, then we know the boundary: hooks + bd-memory priming guarantees, individual upstream agents cannot be modified, but session-level priming via bd memories is a soft path that reduces hard-block frequency."
verdict: VALIDATED-WITH-CONSTRAINTS (3-layer model simplified to 2-layer under Architecture Y1, Spike 013)
related: [001, 002, 006]
tags: [gsd-ecosystem, agents, in-prompt, no-fork-boundary]
---

# Spike 010: bd-aware GSD Agents

## What This Validates

Architecture rule REQ-02: "GSD core is unmodified." Spike 006 identified
13 skills/agents that BLOCK under our hook. Could those upstream pieces
be **made bd-aware** instead of replaced — letting us avoid building 13
substitutes?

## Three possible mechanisms

| Mechanism | Description | Verdict |
|---|---|---|
| Modify upstream skill SKILL.md / agent .md files | Edit `~/.claude/skills/gsd-add-phase/SKILL.md` to detect `.beads/` and route differently | **REJECTED** — violates REQ-02; `/gsd-sync-skills` would re-overwrite |
| Override via skill name shadowing | Install `~/.claude/skills/gsd-add-phase/SKILL.md` (overwriting upstream) | **REJECTED** — same as above; `/gsd-sync-skills` resyncs |
| Session-level priming via `bd remember` memories under `gsd-beads:` namespace | At gsd-beads install time, run `bd remember --key gsd-beads:vocabulary "..."` etc. Memories are auto-surfaced by `bd prime` at SessionStart, so all agents see the routing rules | **PARTIAL** (best-effort guidance, not hard enforcement) |

## What session-level priming can do

bd's existing `SessionStart` hook runs `bd prime`, which loads ~80 lines
of beads workflow context **including all bd memories**. gsd-beads' install
seeds canonical priming via `bd remember` calls keyed under the
`gsd-beads:` namespace, e.g.:

```bash
bd remember --key gsd-beads:vocabulary "\
In this project, the following commands are managed by gsd-beads and \
should be preferred over their /gsd-* counterparts: \
  /gsd-beads-add-phase   (instead of /gsd-add-phase) \
  /gsd-beads-add-todo    (instead of /gsd-add-todo) \
  ... [full 13-item list]"

bd remember --key gsd-beads:state-paths "\
Direct edits to .planning/ROADMAP.md, .planning/REQUIREMENTS.md, \
.planning/todos/, .planning/seeds/ are BLOCKED by a PreToolUse hook. \
When upstream skills attempt these writes, the hook denies with a \
reason; route through /gsd-beads-* commands or call bd directly."
```

These are auto-surfaced every session via `bd prime`'s memories section.
This gives agents context **before** they hit a blocked write — they're
likely to choose the right command from the start, rather than discover
the block mid-flow.

(Earlier iterations of this README proposed a CLAUDE.md sentinel-marked
addendum for the same purpose. That was wrong: bd memories are the
canonical home for persistent project knowledge in a beads workflow.
Spike 002 Iteration 11 has the rationale.)

## What it CAN'T do

- **Cannot prevent the upstream skill from being invoked.** If a user
  types `/gsd-add-phase` explicitly (out of habit), the upstream skill
  runs. Hook fires when it tries to write; the skill aborts. The
  redirect message in `permissionDecisionReason` is the user's only
  feedback.
- **Cannot make upstream agents skip their write step entirely.** We
  can't remotely modify their behavior. Best we can do is the prime
  text influencing the LLM agent's behavior.
- **Hard guarantee still relies on the hook.** Priming is best-effort
  guidance to the LLM; the hook is deterministic enforcement.

## Architecture implication

The 13 substitutes ARE still needed — priming alone doesn't replace
them. But priming reduces the failure-mode of "user runs upstream
command and hits a confusing block partway through." With both:

- **Soft path:** bd memories under `gsd-beads:` namespace, surfaced by
  `bd prime` on SessionStart, prime all sessions on the gsd-beads
  vocabulary and rules.
- **Hard path:** PreToolUse hook denies any state-bearing write,
  regardless of which agent attempts it.
- **Substitute path:** `/gsd-beads-*` skills are the entry points users
  and agents should use.

The combination is robust. Drop any one and there's a gap.

## Post-Spike-013 update

With **Architecture Y1 (shadow gsd-sdk binary)** adopted in Spike 013,
the 3-layer model simplifies to **2 layers**:

1. **Transparent backend (shadow gsd-sdk):** state-bearing mutations
   from upstream skills route through to bd automatically. No agent
   priming required for vocabulary routing — agents call upstream
   commands and get bd-backed semantics for free.
2. **Defensive Edit/Write hook:** still required, blocks direct edits
   to state-bearing markdown. The Spike 012 PreToolUse(Bash, "Bash(gsd-sdk *)")
   hook becomes a defensive backup for any new upstream mutation
   commands the shadow doesn't yet override.

bd-memory priming is still useful for vocabulary visibility (`bd memories
gsd-beads` shows the conventions, surfaced via `bd prime`) but is no
longer required — agents don't need to know about `/gsd-beads-*`
substitutes because they don't need to use them.

The **substitute path is no longer required** as a third layer; it
becomes an optional UX enhancement.

## Verdict

**VALIDATED-WITH-CONSTRAINTS ✓**

- Upstream agents CAN'T be modified per REQ-02.
- Session-level priming via `bd setup --add gsd-beads` is the closest
  thing to "bd-aware upstream" — it's soft guidance, not hard
  enforcement.
- The 13 `/gsd-beads-*` substitutes from Spike 006 remain necessary.
- All three layers (priming + hook + substitutes) are needed; none
  alone is sufficient.
