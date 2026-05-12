// src/format/schemas/index.ts
// Barrel for per-canonical-file schemas (D-MAPPING Outcome A).
//
// Each schema exports a kind-tag constant + a typed record interface.
// Schemas with non-trivial parsers (requirements.ts) also export a
// purpose-built parse function. Simple type-only schemas rely on the
// generic section.ts + frontmatter.ts parsing substrate — the record
// type is the canonical shape, not the parser.
//
// state.ts is a sibling schema living at src/format/state.ts (has its
// own full parseState/formatState pair); it's re-exported here for
// convenient single-import access.

export * from './roadmap.js';
export * from './project.js';
export * from './requirements.js';
export * from './decisions.js';
export * from './ai-spec.js';
export * from './spec.js';
export * from './uat.js';
export * from './verification.js';
export * from './plan.js';
export * from './context.js';
export * from './debug-session.js';

// state.ts lives at src/format/state.ts (sibling to this barrel) and
// owns its own parseState/formatState — re-exported here for unified
// downstream import `import { parseState, ... } from './format/schemas'`.
export {
  parseState,
  formatState,
  type ParsedState,
  type EventRecord,
} from '../state.js';
