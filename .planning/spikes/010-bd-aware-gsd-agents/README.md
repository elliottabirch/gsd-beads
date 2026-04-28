---
spike: 010
name: bd-aware-gsd-agents
type: standard
validates: "Given the architecture's 'no fork' rule (REQ-02: GSD core unmodified) and Spike 006's finding of 13 BLOCKS skills, when probing whether upstream agents can be made bd-aware via in-prompt detection or runtime override, then we know the boundary: hooks + CLAUDE.md addendum guarantees, individual upstream agents cannot be modified, but session-level priming from bd setup recipes is a soft path that reduces hard-block frequency."
verdict: VALIDATED-WITH-CONSTRAINTS
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
| Session-level priming via `bd setup --add gsd-beads` recipe | Add a CLAUDE.md / AGENTS.md block (sentinel-merged) that ALL agents see at SessionStart, instructing them to detect beads-mode and route accordingly | **PARTIAL** |

## What session-level priming can do

bd's `bd setup --add gsd-beads <recipe>` (Spike 002 finding) lets us
inject markdown into the project's CLAUDE.md via sentinel-marker merge.
Bd's existing `SessionStart` hook runs `bd prime` which loads ~80 lines
of beads workflow context. **We can append a gsd-beads-specific
addendum** that primes all agents in the session with rules like:

> **In this project, the following commands are managed by gsd-beads
> and should be preferred over their /gsd-* counterparts:**
> - `/gsd-beads-add-phase` instead of `/gsd-add-phase`
> - `/gsd-beads-add-todo` instead of `/gsd-add-todo`
> - [full 13-item list]
>
> **Direct edits to `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`,
> `.planning/todos/`, `.planning/seeds/` are blocked by hook.** When
> upstream skills attempt these writes, the hook will deny with a
> reason; route through the listed `/gsd-beads-*` commands instead.

This gives agents context **before** they hit a blocked write — they're
likely to choose the right command from the start, rather than discover
the block mid-flow.

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

- **Soft path:** CLAUDE.md addendum (bd setup recipe) primes all
  sessions to know about gsd-beads vocabulary.
- **Hard path:** PreToolUse hook denies any state-bearing write,
  regardless of which agent attempts it.
- **Substitute path:** `/gsd-beads-*` skills are the entry points users
  and agents should use.

The combination is robust. Drop any one and there's a gap.

## Verdict

**VALIDATED-WITH-CONSTRAINTS ✓**

- Upstream agents CAN'T be modified per REQ-02.
- Session-level priming via `bd setup --add gsd-beads` is the closest
  thing to "bd-aware upstream" — it's soft guidance, not hard
  enforcement.
- The 13 `/gsd-beads-*` substitutes from Spike 006 remain necessary.
- All three layers (priming + hook + substitutes) are needed; none
  alone is sufficient.
