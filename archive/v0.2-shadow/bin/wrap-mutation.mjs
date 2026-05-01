// Source-attribution: derived from upstream get-shit-done-cc/sdk/dist/query/index.js
//                     lines 121-199 (buildMutationEvent body — NOT EXPORTED)
//                     lines 486-503 (wrapMutation wrapper pattern)
// Pitfall 2 mitigation: re-implemented because upstream does not export buildMutationEvent.
// Spy-based snapshot test in tests/shadow-tests/wrap-mutation.test.mjs verifies parity.

const SDK_BASE = process.env.GSD_SDK_PATH
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;
const TYPES_PATH = `${SDK_BASE}/sdk/dist/types.js`;

const { GSDEventType } = await import(TYPES_PATH);

/**
 * Reproduces upstream buildMutationEvent's prefix-dispatch logic.
 * Returns a GSDEvent matching the shape upstream's wrap-pass emits.
 *
 * Source: upstream get-shit-done-cc/sdk/dist/query/index.js lines 121-199.
 * NOTE: buildMutationEvent is NOT exported by upstream (module-internal).
 *       This re-implementation is verified by the spy-based snapshot test.
 *
 * 7 prefix branches:
 *   Branch 1: template.*      → GSDEventType.TemplateFill
 *   Branch 2: commit          → GSDEventType.GitCommit
 *   Branch 3: frontmatter.*   → GSDEventType.FrontmatterMutation
 *   Branch 4: config-*        → GSDEventType.ConfigMutation
 *   Branch 5: validate.*      → GSDEventType.ConfigMutation (same as upstream)
 *   Branch 6: phase.* / phases.* → GSDEventType.StateMutation
 *   Branch 7: state.*         → GSDEventType.StateMutation
 *   Fallback (roadmap, requirements, todo, milestone, etc.) → GSDEventType.StateMutation
 */
export function buildMutationEvent(sessionId, cmd, args, result) {
  const base = {
    timestamp: new Date().toISOString(),
    sessionId,
  };

  // Branch 1: template.*
  if (cmd.startsWith('template.') || cmd.startsWith('template ')) {
    const data = result?.data;
    return {
      ...base,
      type: GSDEventType.TemplateFill,
      templateType: data?.template ?? args[0] ?? '',
      path: data?.path ?? args[1] ?? '',
      created: data?.created ?? false,
    };
  }

  // Branch 2: commit (including check-commit and commit-to-subrepo)
  if (cmd === 'commit' || cmd === 'check-commit' || cmd === 'commit-to-subrepo') {
    const data = result?.data;
    return {
      ...base,
      type: GSDEventType.GitCommit,
      hash: data?.hash ?? null,
      committed: data?.committed ?? false,
      reason: data?.reason ?? '',
    };
  }

  // Branch 3: frontmatter.*
  if (cmd.startsWith('frontmatter.') || cmd.startsWith('frontmatter ')) {
    return {
      ...base,
      type: GSDEventType.FrontmatterMutation,
      command: cmd,
      file: args[0] ?? '',
      fields: args.slice(1),
      success: true,
    };
  }

  // Branch 4: config-*
  if (cmd.startsWith('config-')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    };
  }

  // Branch 5: validate.* (uses ConfigMutation per upstream — same as config-*)
  if (cmd.startsWith('validate.') || cmd.startsWith('validate ')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    };
  }

  // Branch 6: phase.* / phases.*
  if (
    cmd.startsWith('phase.') || cmd.startsWith('phase ') ||
    cmd.startsWith('phases.') || cmd.startsWith('phases ')
  ) {
    return {
      ...base,
      type: GSDEventType.StateMutation,
      command: cmd,
      fields: args.slice(0, 2),
      success: true,
    };
  }

  // Branch 7: state.*
  if (cmd.startsWith('state.') || cmd.startsWith('state ')) {
    return {
      ...base,
      type: GSDEventType.StateMutation,
      command: cmd,
      fields: args.slice(0, 2),
      success: true,
    };
  }

  // Fallback: roadmap, requirements, todo, milestone, workstream, intel, profile, etc.
  return {
    ...base,
    type: GSDEventType.StateMutation,
    command: cmd,
    fields: args.slice(0, 2),
    success: true,
  };
}

/**
 * Wrap a QueryHandler with GSDEvent emission post-execution.
 * Fire-and-forget: emit errors do NOT propagate.
 * NULL eventStream → no-op (MVP production path; W3 invariant).
 *
 * Source: upstream get-shit-done-cc/sdk/dist/query/index.js lines 486-503.
 */
export function wrapMutation(handler, cmd, eventStream, sessionId) {
  return async (args, projectDir) => {
    const result = await handler(args, projectDir);
    try {
      eventStream?.emitEvent(buildMutationEvent(sessionId, cmd, args, result));
    } catch {
      // Fire-and-forget per upstream pattern (line 502 of index.js).
    }
    return result;
  };
}
