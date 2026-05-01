---
phase: 6
plan: 06
type: execute
wave: 2
depends_on: [01, 04]
files_modified:
  - src/adapter.mjs
  - src/adapter/primitives.mjs
  - src/adapter/phaseLifecycle.mjs
  - src/adapter/roadmapMilestone.mjs
  - src/adapter/state.mjs
  - src/adapter/verifyReviews.mjs
  - src/adapter/discussTodos.mjs
  - src/adapter/longTail.mjs
  - src/adapter/initBundlers.mjs
autonomous: true
requirements:
  - ARCH-04
must_haves:
  truths:
    - "src/adapter.mjs exports BeadsAdapter class as both default and named export"
    - "BeadsAdapter constructor accepts a string projectRoot and rejects empty/non-string with TypeError"
    - "BeadsAdapter.capabilities is a frozen object with 7 boolean keys"
    - "BeadsAdapter._ensureBd lazily validates via findBeadsRoot per D-02"
    - "Every stub method throws Error matching the canonical regex per D-05"
    - "All 8 cluster files exist under src/adapter/ and are Object.assign'd onto BeadsAdapter.prototype at module load"
    - "Wave 0 tests/unit/adapter-shell.test.mjs is green after this plan"
  artifacts:
    - path: "src/adapter.mjs"
      provides: "BeadsAdapter shell + capabilities + cluster binding"
      exports: ["BeadsAdapter", "default"]
    - path: "src/adapter/primitives.mjs"
      provides: "Bin A 10 + 6 foundational stubs (Phase 7 / PRIM-01, PRIM-02)"
    - path: "src/adapter/phaseLifecycle.mjs"
      provides: "Phase/plan lifecycle stubs (Phase 8 / IMPL-01)"
    - path: "src/adapter/roadmapMilestone.mjs"
      provides: "Roadmap/milestone stubs (Phase 8 / IMPL-02)"
    - path: "src/adapter/state.mjs"
      provides: "State + decisions/blockers/sessions stubs (Phase 9 / IMPL-03)"
    - path: "src/adapter/verifyReviews.mjs"
      provides: "Verify/UAT/validation/patterns/security/reviews stubs (Phase 10 / IMPL-04)"
    - path: "src/adapter/discussTodos.mjs"
      provides: "Discuss/spec/research + todos/notes/seeds stubs (Phase 11 / IMPL-05+IMPL-06)"
    - path: "src/adapter/longTail.mjs"
      provides: "Workstream/spike/debug/reports/ingestion stubs (Phase 12 / IMPL-07..11)"
    - path: "src/adapter/initBundlers.mjs"
      provides: "Workflow init bundler stubs (Phase 13 / IMPL-12)"
  key_links:
    - from: "src/adapter.mjs"
      to: "src/bd/findRoot.mjs"
      via: "import findBeadsRoot"
      pattern: "from\\s+'\\./bd/findRoot\\.mjs'"
    - from: "src/adapter.mjs"
      to: "src/bd/errors.mjs"
      via: "import BeadsEmpty for _ensureBd throw"
      pattern: "BeadsEmpty"
    - from: "src/adapter.mjs"
      to: "8 cluster files"
      via: "Object.assign(BeadsAdapter.prototype, ...8imports)"
      pattern: "Object\\.assign\\(BeadsAdapter\\.prototype"
---

<objective>
Build the BeadsAdapter shell + 8 cluster stub files per D-01..D-05.
Every named adapter method throws the canonical error per D-05:
`BeadsAdapter.<method>: not implemented (Phase N / IMPL-NN)`.

The shell:
- Constructor stores projectRoot, lazy-validates bd via _ensureBd (D-02)
- Static capabilities flag with 7 booleans (D-03; placeholder values
  Phase 7 will finalize)
- Object.assign binds the 8 cluster bags onto the prototype (D-04)

Purpose: Phase 7 fills in primitives.mjs; Phases 8-13 each fill in their
assigned cluster file. Until then every public method throws the
canonical message; Wave 0 tests/unit/adapter-shell.test.mjs verifies the
format and the cluster boundary structure.

Output: 9 files (1 shell + 8 cluster bags), all wired at module load.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md
@.planning/research/fork-investigation/SYNTHESIS.md

<interfaces>
Stub format per D-05 (tested in adapter-shell.test.mjs):
  throw new Error('BeadsAdapter.' + name + ': not implemented (Phase ' + phase + ' / ' + impl + ')');
or template-literal equivalent. Regex pattern from Wave 0 test:
  /^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/

NOT_IMPLEMENTED helper local to each cluster file:
  const NOT_IMPLEMENTED = (name, phase, impl) => {
    throw new Error(`BeadsAdapter.${name}: not implemented (Phase ${phase} / ${impl})`);
  };

Capabilities flag per RESEARCH.md §4 lines 506-515 (placeholder booleans
that Phase 7 will finalize):
  Object.freeze({
    record: true,
    section: true,
    binaryAsset: false,
    snapshot: true,
    transaction: false,
    namedDoc: true,
    commitPlanningState: false,
  });

Cluster method lists — extracted verbatim from REQUIREMENTS.md:

primitives.mjs (Phase 7 / PRIM-01 + PRIM-02) — 16 methods:
  PRIM-01 Bin A: getRecord, putRecord, removeRecord, listCollection,
                 exists, getSection, updateSection, getFrontmatter,
                 updateFrontmatter, mergeFrontmatter
  PRIM-02 foundational: recordStateEvent, snapshot, restore,
                        putNamedDoc, getNamedDoc, writeBinaryAsset
  (getSection + updateSection are listed in PRIM-01; do NOT duplicate.)

phaseLifecycle.mjs (Phase 8 / IMPL-01) — 32 methods per REQUIREMENTS.md:
  addPhase, addPhaseBatch, insertPhase, removePhase,
  completePhaseAndCascade, completeMilestone, archivePhases,
  clearPhases, findNextDecimalPhase, scaffoldPhaseArtifact,
  addBacklogEntry, promoteBacklogEntry, removeBacklogEntry,
  getPhase, findPhase, listPhases, listPhasePlans, listPhaseSummaries,
  listPhaseArtifacts, getPlan, addPlan, recordPlanAdded, addSummary,
  getSummary, getPlanTaskStructure, listPhasePlanSummaryPairs,
  findPriorSummary, findNextIncompletePlan, checkPhaseReady,
  roadmapUpdatePlanProgress, updateRoadmapPhasePlanList, phasePlanIndex

roadmapMilestone.mjs (Phase 8 / IMPL-02) — 22 methods:
  getRoadmap, getRoadmapPhase, getRoadmapSection, getCurrentMilestone,
  getNextMilestone, evolveRoadmap, updateRoadmapDependencies,
  reorganizeRoadmapForMilestone, recordBacklogDeferral,
  annotateRoadmapDependencies, listMilestones, listMilestoneArchives,
  getArchivedMilestoneRoadmap, getArchivedMilestoneDoc,
  getMilestoneAudit, writeMilestoneAudit, addGapClosurePhases,
  appendRetrospective, getRetrospective, getMilestoneStats,
  getMilestoneCompletion, digestPhaseHistory

state.mjs (Phase 9 / IMPL-03) — 21 methods (recordStateEvent is in
primitives.mjs; do NOT duplicate):
  getState, getStateField, getStateSnapshot, updateStateField,
  patchStateFields, recordSession, beginPhase, advancePlan,
  markPhasePlanned, switchMilestone, signalWaiting, clearWaitingSignal,
  validateState, syncState, pruneState, updateStateProgress,
  evolveProject, getProject, updateProjectValidatedRequirements,
  getProjectLoad, getProjectTitle

verifyReviews.mjs (Phase 10 / IMPL-04) — 50 methods per REQUIREMENTS.md
IMPL-04 backtick-quoted list:
  getVerification, getVerificationStatus, recordVerification,
  listVerificationsAcrossPhases, getUat, listActiveUat,
  listOutstandingUat, createUat, updateUat, updateUatGap,
  updateUatStatus, updateUatGapDiagnoses, getValidation,
  recordValidation, appendValidationAudit, recordPatterns,
  getSecurity, putSecurity, updateSecurityAuditTrail,
  getThreatRegister, getReview, addReview, getReviewFix, addReviewFix,
  archiveReviewIteration, getUiSpec, addUiSpec, getUiReview, addUiReview,
  addUiReviewScreenshot, getEvalReview, addEvalReview, getAiSpec,
  putAiSpec, getAiSpecTemplate, validateAiSpec, updateAiSpecSection,
  getReviews, addReviews, recordDocVerification, verifyPlanArtifacts,
  verifySummary, checkDecisionCoveragePlan, checkDecisionCoverageVerify,
  getPhaseCompletion, listSafetyGates, routeNextAction, detectPhaseType,
  getAutoMode, getConfigGates

discussTodos.mjs (Phase 11 / IMPL-05 + IMPL-06):
  IMPL-05 (21 methods): getContext, putContext, updatePhaseContext,
    getSpec, putSpec, getResearch, writeResearch, getDiscovery,
    putDiscovery, putDiscussionLog, getCheckpoint, putCheckpoint,
    removeCheckpoint, putQuestionsState, getQuestionsState,
    putQuestionsCompanion, getMethodology, getDecisionsIndex,
    listPriorPhaseContexts, listPhaseDecisions, getDecisions
  IMPL-06 (27 methods): listTodos, getTodo, addTodo, completeTodo,
    closeTodosByResolvesPhase, findNextTodoId, tagTodoResolvesPhase,
    listNotes, addNote, markNotePromoted, findRelatedTodos,
    addSeed, listSeeds, getSeed, findNextSeedId, getHandoff,
    putHandoff, removeHandoff, listOrphanedHandoffs, getContinueHere,
    putContinueHere, findContinueHere, listMemoryEntries,
    findDeferredScopeRefs, findPlaceholderSummaries,
    detectActiveContext, listIncompletePlans

longTail.mjs (Phase 12 / IMPL-07..11):
  IMPL-07 (18 methods): getActiveWorkstream, listWorkstreams,
    createWorkstream, setActiveWorkstream, getWorkstreamStatus,
    archiveWorkstream, listWorkstreamProgress, createWorkspaceShell,
    removeWorkspaceShell, getConfig, updateConfig, ensureConfigSection,
    createInitialConfig, updateModelProfile, getConfigPath,
    writeSkillManifest, listProjectSkills, getDocsInitContext
  IMPL-08 (32 methods): addSpike, listSpikes, getSpike, getSpikeManifest,
    updateSpikeManifest, getSpikeConventions, updateSpikeConventions,
    recordSpikeResult, addSpikeRequirement, recordSpikeWrapUp,
    markSpikeProcessed, addSketch, listSketches, getSketchManifest,
    updateSketchManifest, recordSketchWinner, recordSketchWrapUp,
    markSketchProcessed, getSketchTheme, putSketchTheme, putSketchAsset,
    putCodebaseDoc, getCodebaseDoc, listCodebaseDocs, addCodebaseDoc,
    putIntelDoc, getIntelDoc, getIntelStatus, getIntelDiff,
    snapshotIntel, validateIntel, queryIntel, patchIntelMeta,
    recordIntelSnapshot, recordLearnings, markGraduated,
    listLearningSections
  IMPL-09 (8 methods): listDebugSessions, getDebugSession,
    addDebugSession, updateDebugSession, archiveDebugSession,
    getDebugKnowledgeBase, appendDebugKnowledgeBase,
    appendDebugSpecialistReview
  IMPL-10 (12 methods): addForensicReport, listSessionReports,
    putSessionReport, writeInboxTriageReport, putReport, getPhaseManifest,
    findDependentPhases, findIntraPhasePlanDependencies,
    getNextCallCount, incrementNextCallCount, recordTempArtifact,
    getTempArtifact
  IMPL-11 (10 methods, writeIntel folds into putIntelDoc per
  REQUIREMENTS.md so omit it): writeDocClassification,
    listDocClassifications, writeIngestConflicts, getIngestConflicts,
    bootstrapFromGsd2, selectPhaseTemplate, fillTemplate,
    commitPlanningState, commitToSubrepo, checkCommitReady

initBundlers.mjs (Phase 13 / IMPL-12) — 13 methods:
  getExecutePhaseInit, getPlanPhaseInit, getNewMilestoneInit,
  getQuickInit, getResumeInit, getVerifyWorkInit, getPhaseOpInit,
  getMilestoneOpInit, getMapCodebaseInit, getNewProjectInit,
  getProgressInit, getManagerInit, getProjectExistence
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/adapter.mjs shell</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §4 lines 444-533
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-01..D-05
    - tests/unit/adapter-shell.test.mjs (the test driver)
    - src/bd/findRoot.mjs
    - src/bd/errors.mjs
  </read_first>
  <files>
    - src/adapter.mjs
  </files>
  <action>
    Create src/adapter.mjs per RESEARCH.md §4 lines 449-533. Reproduce
    structure: imports, BeadsAdapter class with constructor + _ensureBd,
    static capabilities, Object.assign cluster binding, default export.

    Use this exact source body (the 8 cluster imports reference files
    Tasks 2-9 will create — Node will fail on require until those exist,
    but the file itself parses):

    ```js
    // src/adapter.mjs
    // BeadsAdapter shell. Per D-01..D-05 + RESEARCH.md §4.
    //
    // All methods are bound to BeadsAdapter.prototype via Object.assign at
    // module load. Each cluster file exports a method-bag object whose
    // property names match the public adapter surface. Stack traces show
    // real method names because Object.assign preserves the function name.

    import { findBeadsRoot } from './bd/findRoot.mjs';
    import { BeadsEmpty } from './bd/errors.mjs';

    import primitives       from './adapter/primitives.mjs';
    import phaseLifecycle   from './adapter/phaseLifecycle.mjs';
    import roadmapMilestone from './adapter/roadmapMilestone.mjs';
    import state            from './adapter/state.mjs';
    import verifyReviews    from './adapter/verifyReviews.mjs';
    import discussTodos     from './adapter/discussTodos.mjs';
    import longTail         from './adapter/longTail.mjs';
    import initBundlers     from './adapter/initBundlers.mjs';

    export class BeadsAdapter {
      /**
       * @param {string} projectRoot — absolute path to project root.
       * Per D-02: bd availability is NOT validated here; first method call
       * triggers _ensureBd which runs findBeadsRoot and caches the result.
       */
      constructor(projectRoot) {
        if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
          throw new TypeError('BeadsAdapter: projectRoot must be a non-empty string');
        }
        this.projectRoot = projectRoot;
        this._beadsRoot = null;
        this._beadsValidated = false;
      }

      /** Lazy bd validation per D-02. */
      _ensureBd() {
        if (this._beadsValidated) return this._beadsRoot;
        const root = findBeadsRoot(this.projectRoot);
        if (!root) {
          throw new BeadsEmpty(
            'BeadsAdapter: project at ' + this.projectRoot + ' is not bd-managed'
          );
        }
        this._beadsRoot = root;
        this._beadsValidated = true;
        return root;
      }
    }

    // Static capabilities flag per D-03 / CAP-01 / D-2026-04-30-05.
    // Placeholder booleans; Phase 7 sets to implementation reality.
    BeadsAdapter.capabilities = Object.freeze({
      record: true,
      section: true,
      binaryAsset: false,
      snapshot: true,
      transaction: false,
      namedDoc: true,
      commitPlanningState: false,
    });

    // Bind cluster methods to prototype per D-04.
    Object.assign(
      BeadsAdapter.prototype,
      primitives,
      phaseLifecycle,
      roadmapMilestone,
      state,
      verifyReviews,
      discussTodos,
      longTail,
      initBundlers,
    );

    export default BeadsAdapter;
    ```

    The 8 cluster imports reference files Tasks 2-9 create. Run
    node --check src/adapter.mjs after Tasks 2-9 complete. Running it
    now will fail on the missing imports — that's expected.
  </action>
  <verify>
    <automated>test -f src/adapter.mjs &amp;&amp; grep -q "export class BeadsAdapter" src/adapter.mjs &amp;&amp; grep -q "Object.freeze" src/adapter.mjs &amp;&amp; grep -q "Object.assign" src/adapter.mjs</automated>
  </verify>
  <acceptance_criteria>
    - src/adapter.mjs exists
    - Contains the line `export class BeadsAdapter {`
    - Contains the line `BeadsAdapter.capabilities = Object.freeze({`
    - Contains the line `Object.assign(`
    - Contains 7 capability keys (record, section, binaryAsset, snapshot, transaction, namedDoc, commitPlanningState)
    - Imports findBeadsRoot from `./bd/findRoot.mjs` and BeadsEmpty from `./bd/errors.mjs`
    - Imports the 8 cluster default exports
  </acceptance_criteria>
  <done>Shell file in place; cluster imports unresolved until Tasks 2-9</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create src/adapter/primitives.mjs (Phase 7 / PRIM-01 + PRIM-02)</name>
  <read_first>
    - .planning/REQUIREMENTS.md PRIM-01 lines 386-394 (10 Bin A methods)
    - .planning/REQUIREMENTS.md PRIM-02 lines 396-413 (6 foundational methods)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §4 lines 540-570 (sample cluster file)
  </read_first>
  <files>
    - src/adapter/primitives.mjs
  </files>
  <action>
    Create the primitives cluster file. 16 methods total (10 Bin A
    PRIM-01 + 6 foundational PRIM-02). Note: the SYNTHESIS.md catalog
    lists getSection + updateSection in BOTH PRIM-01 and PRIM-02, but
    they appear ONCE in this file (cross-cutting per RESEARCH.md §4).

    Create src/adapter directory:

    ```bash
    mkdir -p src/adapter
    ```

    Create src/adapter/primitives.mjs:

    ```js
    // src/adapter/primitives.mjs
    // Bin A (10 methods, PRIM-01) + 6 foundational (PRIM-02). Phase 7 / IMPL.
    // Stub style per D-05.

    const NOT_IMPLEMENTED = (name, phase, impl) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase ' + phase + ' / ' + impl + ')');
    };

    export default {
      // PRIM-01 Bin A (10 methods)
      async getRecord(path)            { NOT_IMPLEMENTED('getRecord', 7, 'PRIM-01'); },
      async putRecord(path, body)      { NOT_IMPLEMENTED('putRecord', 7, 'PRIM-01'); },
      async removeRecord(path)         { NOT_IMPLEMENTED('removeRecord', 7, 'PRIM-01'); },
      async listCollection(prefix, filter) { NOT_IMPLEMENTED('listCollection', 7, 'PRIM-01'); },
      async exists(path)               { NOT_IMPLEMENTED('exists', 7, 'PRIM-01'); },
      async getSection(path, anchor)   { NOT_IMPLEMENTED('getSection', 7, 'PRIM-01'); },
      async updateSection(path, anchor, body, mode) { NOT_IMPLEMENTED('updateSection', 7, 'PRIM-01'); },
      async getFrontmatter(path, field) { NOT_IMPLEMENTED('getFrontmatter', 7, 'PRIM-01'); },
      async updateFrontmatter(path, field, value) { NOT_IMPLEMENTED('updateFrontmatter', 7, 'PRIM-01'); },
      async mergeFrontmatter(path, patch) { NOT_IMPLEMENTED('mergeFrontmatter', 7, 'PRIM-01'); },

      // PRIM-02 foundational (6 methods; getSection + updateSection above also count)
      async recordStateEvent({ type, payload }) { NOT_IMPLEMENTED('recordStateEvent', 7, 'PRIM-02'); },
      async snapshot()                 { NOT_IMPLEMENTED('snapshot', 7, 'PRIM-02'); },
      async restore(snapshotRef)       { NOT_IMPLEMENTED('restore', 7, 'PRIM-02'); },
      async putNamedDoc(category, key, body) { NOT_IMPLEMENTED('putNamedDoc', 7, 'PRIM-02'); },
      async getNamedDoc(category, key) { NOT_IMPLEMENTED('getNamedDoc', 7, 'PRIM-02'); },
      async writeBinaryAsset(path, bytes) { NOT_IMPLEMENTED('writeBinaryAsset', 7, 'PRIM-02'); },
    };
    ```
  </action>
  <verify>
    <automated>test -f src/adapter/primitives.mjs &amp;&amp; node --check src/adapter/primitives.mjs &amp;&amp; METHOD_COUNT=$(grep -cE "async [a-zA-Z]+\(" src/adapter/primitives.mjs); test "$METHOD_COUNT" -eq 16</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses (node --check)
    - Contains exactly 16 `async <name>(` method declarations
    - Every method body invokes `NOT_IMPLEMENTED(name, 7, 'PRIM-01' or 'PRIM-02')`
    - Default export is a plain object (not a class, not a function)
    - Method names match REQUIREMENTS.md PRIM-01 and PRIM-02 lists
  </acceptance_criteria>
  <done>primitives cluster file in place with 16 stubs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create src/adapter/phaseLifecycle.mjs (Phase 8 / IMPL-01)</name>
  <read_first>
    - .planning/REQUIREMENTS.md IMPL-01 lines 416-427 (32 method names)
    - src/adapter/primitives.mjs (for the NOT_IMPLEMENTED helper template)
  </read_first>
  <files>
    - src/adapter/phaseLifecycle.mjs
  </files>
  <action>
    Create src/adapter/phaseLifecycle.mjs with the 32 methods from
    REQUIREMENTS.md IMPL-01. Use the same stub helper pattern.

    ```js
    // src/adapter/phaseLifecycle.mjs
    // Phase/plan lifecycle methods. Phase 8 / IMPL-01.

    const NOT_IMPLEMENTED = (name) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 8 / IMPL-01)');
    };

    export default {
      async addPhase(spec)                       { NOT_IMPLEMENTED('addPhase'); },
      async addPhaseBatch(specs)                 { NOT_IMPLEMENTED('addPhaseBatch'); },
      async insertPhase(spec)                    { NOT_IMPLEMENTED('insertPhase'); },
      async removePhase(phaseRef)                { NOT_IMPLEMENTED('removePhase'); },
      async completePhaseAndCascade(phaseRef)    { NOT_IMPLEMENTED('completePhaseAndCascade'); },
      async completeMilestone(milestoneRef)      { NOT_IMPLEMENTED('completeMilestone'); },
      async archivePhases(phaseRefs)             { NOT_IMPLEMENTED('archivePhases'); },
      async clearPhases()                        { NOT_IMPLEMENTED('clearPhases'); },
      async findNextDecimalPhase(base)           { NOT_IMPLEMENTED('findNextDecimalPhase'); },
      async scaffoldPhaseArtifact(phase, kind)   { NOT_IMPLEMENTED('scaffoldPhaseArtifact'); },
      async addBacklogEntry(entry)               { NOT_IMPLEMENTED('addBacklogEntry'); },
      async promoteBacklogEntry(id)              { NOT_IMPLEMENTED('promoteBacklogEntry'); },
      async removeBacklogEntry(id)               { NOT_IMPLEMENTED('removeBacklogEntry'); },
      async getPhase(phaseRef)                   { NOT_IMPLEMENTED('getPhase'); },
      async findPhase(hint)                      { NOT_IMPLEMENTED('findPhase'); },
      async listPhases(filter)                   { NOT_IMPLEMENTED('listPhases'); },
      async listPhasePlans(phase)                { NOT_IMPLEMENTED('listPhasePlans'); },
      async listPhaseSummaries(phase)            { NOT_IMPLEMENTED('listPhaseSummaries'); },
      async listPhaseArtifacts(phase)            { NOT_IMPLEMENTED('listPhaseArtifacts'); },
      async getPlan(phase, planNumber)           { NOT_IMPLEMENTED('getPlan'); },
      async addPlan(phase, planSpec)             { NOT_IMPLEMENTED('addPlan'); },
      async recordPlanAdded(phase, planId)       { NOT_IMPLEMENTED('recordPlanAdded'); },
      async addSummary(phase, summarySpec)       { NOT_IMPLEMENTED('addSummary'); },
      async getSummary(phase, planNumber)        { NOT_IMPLEMENTED('getSummary'); },
      async getPlanTaskStructure(phase, planNumber) { NOT_IMPLEMENTED('getPlanTaskStructure'); },
      async listPhasePlanSummaryPairs(phase)     { NOT_IMPLEMENTED('listPhasePlanSummaryPairs'); },
      async findPriorSummary(phase, planNumber)  { NOT_IMPLEMENTED('findPriorSummary'); },
      async findNextIncompletePlan(phase)        { NOT_IMPLEMENTED('findNextIncompletePlan'); },
      async checkPhaseReady(phase)               { NOT_IMPLEMENTED('checkPhaseReady'); },
      async roadmapUpdatePlanProgress(phase)     { NOT_IMPLEMENTED('roadmapUpdatePlanProgress'); },
      async updateRoadmapPhasePlanList(phase)    { NOT_IMPLEMENTED('updateRoadmapPhasePlanList'); },
      async phasePlanIndex(phase)                { NOT_IMPLEMENTED('phasePlanIndex'); },
    };
    ```
  </action>
  <verify>
    <automated>test -f src/adapter/phaseLifecycle.mjs &amp;&amp; node --check src/adapter/phaseLifecycle.mjs &amp;&amp; M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/phaseLifecycle.mjs); test "$M" -eq 32</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses
    - Contains exactly 32 async method declarations
    - All methods invoke `NOT_IMPLEMENTED(name)` (helper hardcodes Phase 8 / IMPL-01)
    - Default export is a plain object
  </acceptance_criteria>
  <done>phaseLifecycle cluster file in place with 32 stubs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Create src/adapter/roadmapMilestone.mjs (Phase 8 / IMPL-02)</name>
  <read_first>
    - .planning/REQUIREMENTS.md IMPL-02 lines 429-439 (22 method names)
  </read_first>
  <files>
    - src/adapter/roadmapMilestone.mjs
  </files>
  <action>
    Create src/adapter/roadmapMilestone.mjs:

    ```js
    // src/adapter/roadmapMilestone.mjs
    // Roadmap/milestone methods. Phase 8 / IMPL-02.

    const NOT_IMPLEMENTED = (name) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 8 / IMPL-02)');
    };

    export default {
      async getRoadmap()                         { NOT_IMPLEMENTED('getRoadmap'); },
      async getRoadmapPhase(phaseRef)            { NOT_IMPLEMENTED('getRoadmapPhase'); },
      async getRoadmapSection(anchor)            { NOT_IMPLEMENTED('getRoadmapSection'); },
      async getCurrentMilestone()                { NOT_IMPLEMENTED('getCurrentMilestone'); },
      async getNextMilestone()                   { NOT_IMPLEMENTED('getNextMilestone'); },
      async evolveRoadmap(patch)                 { NOT_IMPLEMENTED('evolveRoadmap'); },
      async updateRoadmapDependencies(patch)     { NOT_IMPLEMENTED('updateRoadmapDependencies'); },
      async reorganizeRoadmapForMilestone(milestoneRef) { NOT_IMPLEMENTED('reorganizeRoadmapForMilestone'); },
      async recordBacklogDeferral(entry)         { NOT_IMPLEMENTED('recordBacklogDeferral'); },
      async annotateRoadmapDependencies(annotations) { NOT_IMPLEMENTED('annotateRoadmapDependencies'); },
      async listMilestones()                     { NOT_IMPLEMENTED('listMilestones'); },
      async listMilestoneArchives()              { NOT_IMPLEMENTED('listMilestoneArchives'); },
      async getArchivedMilestoneRoadmap(milestoneRef) { NOT_IMPLEMENTED('getArchivedMilestoneRoadmap'); },
      async getArchivedMilestoneDoc(milestoneRef, docName) { NOT_IMPLEMENTED('getArchivedMilestoneDoc'); },
      async getMilestoneAudit(milestoneRef)      { NOT_IMPLEMENTED('getMilestoneAudit'); },
      async writeMilestoneAudit(milestoneRef, body) { NOT_IMPLEMENTED('writeMilestoneAudit'); },
      async addGapClosurePhases(milestoneRef, phases) { NOT_IMPLEMENTED('addGapClosurePhases'); },
      async appendRetrospective(milestoneRef, body) { NOT_IMPLEMENTED('appendRetrospective'); },
      async getRetrospective(milestoneRef)       { NOT_IMPLEMENTED('getRetrospective'); },
      async getMilestoneStats(milestoneRef)      { NOT_IMPLEMENTED('getMilestoneStats'); },
      async getMilestoneCompletion(milestoneRef) { NOT_IMPLEMENTED('getMilestoneCompletion'); },
      async digestPhaseHistory(milestoneRef)     { NOT_IMPLEMENTED('digestPhaseHistory'); },
    };
    ```
  </action>
  <verify>
    <automated>test -f src/adapter/roadmapMilestone.mjs &amp;&amp; node --check src/adapter/roadmapMilestone.mjs &amp;&amp; M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/roadmapMilestone.mjs); test "$M" -eq 22</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses
    - Contains exactly 22 async method declarations
    - All methods invoke `NOT_IMPLEMENTED(name)` (helper hardcodes Phase 8 / IMPL-02)
    - Default export is a plain object
  </acceptance_criteria>
  <done>roadmapMilestone cluster file in place with 22 stubs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Create src/adapter/state.mjs (Phase 9 / IMPL-03)</name>
  <read_first>
    - .planning/REQUIREMENTS.md IMPL-03 lines 441-449 (21 method names; recordStateEvent excluded — already in primitives.mjs)
  </read_first>
  <files>
    - src/adapter/state.mjs
  </files>
  <action>
    Create src/adapter/state.mjs:

    ```js
    // src/adapter/state.mjs
    // State + decisions/blockers/sessions methods. Phase 9 / IMPL-03.
    // (recordStateEvent is in primitives.mjs / PRIM-02 — not duplicated here.)

    const NOT_IMPLEMENTED = (name) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 9 / IMPL-03)');
    };

    export default {
      async getState()                           { NOT_IMPLEMENTED('getState'); },
      async getStateField(field)                 { NOT_IMPLEMENTED('getStateField'); },
      async getStateSnapshot()                   { NOT_IMPLEMENTED('getStateSnapshot'); },
      async updateStateField(field, value)       { NOT_IMPLEMENTED('updateStateField'); },
      async patchStateFields(patch)              { NOT_IMPLEMENTED('patchStateFields'); },
      async recordSession(spec)                  { NOT_IMPLEMENTED('recordSession'); },
      async beginPhase(phaseRef)                 { NOT_IMPLEMENTED('beginPhase'); },
      async advancePlan(phase, planNumber)       { NOT_IMPLEMENTED('advancePlan'); },
      async markPhasePlanned(phaseRef)           { NOT_IMPLEMENTED('markPhasePlanned'); },
      async switchMilestone(milestoneRef)        { NOT_IMPLEMENTED('switchMilestone'); },
      async signalWaiting(reason)                { NOT_IMPLEMENTED('signalWaiting'); },
      async clearWaitingSignal()                 { NOT_IMPLEMENTED('clearWaitingSignal'); },
      async validateState()                      { NOT_IMPLEMENTED('validateState'); },
      async syncState()                          { NOT_IMPLEMENTED('syncState'); },
      async pruneState()                         { NOT_IMPLEMENTED('pruneState'); },
      async updateStateProgress(progress)        { NOT_IMPLEMENTED('updateStateProgress'); },
      async evolveProject(patch)                 { NOT_IMPLEMENTED('evolveProject'); },
      async getProject()                         { NOT_IMPLEMENTED('getProject'); },
      async updateProjectValidatedRequirements(reqs) { NOT_IMPLEMENTED('updateProjectValidatedRequirements'); },
      async getProjectLoad()                     { NOT_IMPLEMENTED('getProjectLoad'); },
      async getProjectTitle()                    { NOT_IMPLEMENTED('getProjectTitle'); },
    };
    ```
  </action>
  <verify>
    <automated>test -f src/adapter/state.mjs &amp;&amp; node --check src/adapter/state.mjs &amp;&amp; M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/state.mjs); test "$M" -eq 21</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses
    - Contains exactly 21 async method declarations (recordStateEvent NOT included; it's in primitives.mjs)
    - All methods invoke `NOT_IMPLEMENTED(name)` with Phase 9 / IMPL-03 hardcoded
    - Default export is a plain object
  </acceptance_criteria>
  <done>state cluster file in place with 21 stubs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Create src/adapter/verifyReviews.mjs (Phase 10 / IMPL-04)</name>
  <read_first>
    - .planning/REQUIREMENTS.md IMPL-04 lines 451-468 (50 method names)
  </read_first>
  <files>
    - src/adapter/verifyReviews.mjs
  </files>
  <action>
    Create src/adapter/verifyReviews.mjs with all 50 methods. Same
    stub pattern (NOT_IMPLEMENTED helper hardcoded to Phase 10 / IMPL-04):

    ```js
    // src/adapter/verifyReviews.mjs
    // Verify/UAT/validation/patterns/security/reviews methods. Phase 10 / IMPL-04.

    const NOT_IMPLEMENTED = (name) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 10 / IMPL-04)');
    };

    export default {
      async getVerification(phase)               { NOT_IMPLEMENTED('getVerification'); },
      async getVerificationStatus(phase)         { NOT_IMPLEMENTED('getVerificationStatus'); },
      async recordVerification(phase, report)    { NOT_IMPLEMENTED('recordVerification'); },
      async listVerificationsAcrossPhases()      { NOT_IMPLEMENTED('listVerificationsAcrossPhases'); },
      async getUat(phase)                        { NOT_IMPLEMENTED('getUat'); },
      async listActiveUat()                      { NOT_IMPLEMENTED('listActiveUat'); },
      async listOutstandingUat()                 { NOT_IMPLEMENTED('listOutstandingUat'); },
      async createUat(phase, spec)               { NOT_IMPLEMENTED('createUat'); },
      async updateUat(phase, patch)              { NOT_IMPLEMENTED('updateUat'); },
      async updateUatGap(phase, gap)             { NOT_IMPLEMENTED('updateUatGap'); },
      async updateUatStatus(phase, status)       { NOT_IMPLEMENTED('updateUatStatus'); },
      async updateUatGapDiagnoses(phase, diagnoses) { NOT_IMPLEMENTED('updateUatGapDiagnoses'); },
      async getValidation(phase)                 { NOT_IMPLEMENTED('getValidation'); },
      async recordValidation(phase, report)      { NOT_IMPLEMENTED('recordValidation'); },
      async appendValidationAudit(phase, audit)  { NOT_IMPLEMENTED('appendValidationAudit'); },
      async recordPatterns(phase, patterns)      { NOT_IMPLEMENTED('recordPatterns'); },
      async getSecurity(phase)                   { NOT_IMPLEMENTED('getSecurity'); },
      async putSecurity(phase, body)             { NOT_IMPLEMENTED('putSecurity'); },
      async updateSecurityAuditTrail(phase, audit) { NOT_IMPLEMENTED('updateSecurityAuditTrail'); },
      async getThreatRegister(phase)             { NOT_IMPLEMENTED('getThreatRegister'); },
      async getReview(phase, kind)               { NOT_IMPLEMENTED('getReview'); },
      async addReview(phase, kind, body)         { NOT_IMPLEMENTED('addReview'); },
      async getReviewFix(phase, kind)            { NOT_IMPLEMENTED('getReviewFix'); },
      async addReviewFix(phase, kind, body)      { NOT_IMPLEMENTED('addReviewFix'); },
      async archiveReviewIteration(phase, kind, iteration) { NOT_IMPLEMENTED('archiveReviewIteration'); },
      async getUiSpec(phase)                     { NOT_IMPLEMENTED('getUiSpec'); },
      async addUiSpec(phase, body)               { NOT_IMPLEMENTED('addUiSpec'); },
      async getUiReview(phase)                   { NOT_IMPLEMENTED('getUiReview'); },
      async addUiReview(phase, body)             { NOT_IMPLEMENTED('addUiReview'); },
      async addUiReviewScreenshot(phase, screenshot) { NOT_IMPLEMENTED('addUiReviewScreenshot'); },
      async getEvalReview(phase)                 { NOT_IMPLEMENTED('getEvalReview'); },
      async addEvalReview(phase, body)           { NOT_IMPLEMENTED('addEvalReview'); },
      async getAiSpec(phase)                     { NOT_IMPLEMENTED('getAiSpec'); },
      async putAiSpec(phase, body)               { NOT_IMPLEMENTED('putAiSpec'); },
      async getAiSpecTemplate()                  { NOT_IMPLEMENTED('getAiSpecTemplate'); },
      async validateAiSpec(phase)                { NOT_IMPLEMENTED('validateAiSpec'); },
      async updateAiSpecSection(phase, sectionId, body) { NOT_IMPLEMENTED('updateAiSpecSection'); },
      async getReviews(phase)                    { NOT_IMPLEMENTED('getReviews'); },
      async addReviews(phase, body)              { NOT_IMPLEMENTED('addReviews'); },
      async recordDocVerification(phase, doc)    { NOT_IMPLEMENTED('recordDocVerification'); },
      async verifyPlanArtifacts(phase, plan)     { NOT_IMPLEMENTED('verifyPlanArtifacts'); },
      async verifySummary(phase, plan)           { NOT_IMPLEMENTED('verifySummary'); },
      async checkDecisionCoveragePlan(phase, plan) { NOT_IMPLEMENTED('checkDecisionCoveragePlan'); },
      async checkDecisionCoverageVerify(phase)   { NOT_IMPLEMENTED('checkDecisionCoverageVerify'); },
      async getPhaseCompletion(phase)            { NOT_IMPLEMENTED('getPhaseCompletion'); },
      async listSafetyGates()                    { NOT_IMPLEMENTED('listSafetyGates'); },
      async routeNextAction(context)             { NOT_IMPLEMENTED('routeNextAction'); },
      async detectPhaseType(phase)               { NOT_IMPLEMENTED('detectPhaseType'); },
      async getAutoMode()                        { NOT_IMPLEMENTED('getAutoMode'); },
      async getConfigGates()                     { NOT_IMPLEMENTED('getConfigGates'); },
    };
    ```
  </action>
  <verify>
    <automated>test -f src/adapter/verifyReviews.mjs &amp;&amp; node --check src/adapter/verifyReviews.mjs &amp;&amp; M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/verifyReviews.mjs); test "$M" -eq 50</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses
    - Contains exactly 50 async method declarations
    - All methods invoke `NOT_IMPLEMENTED(name)` with Phase 10 / IMPL-04
    - Default export is a plain object
  </acceptance_criteria>
  <done>verifyReviews cluster file in place with 50 stubs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: Create src/adapter/discussTodos.mjs (Phase 11 / IMPL-05+IMPL-06)</name>
  <read_first>
    - .planning/REQUIREMENTS.md IMPL-05 lines 470-479 (21 methods)
    - .planning/REQUIREMENTS.md IMPL-06 lines 481-491 (27 methods)
  </read_first>
  <files>
    - src/adapter/discussTodos.mjs
  </files>
  <action>
    Create src/adapter/discussTodos.mjs combining IMPL-05 (21 discuss methods)
    and IMPL-06 (27 todos/notes/seeds methods). recordDecision is excluded
    — it folds into recordStateEvent per REQUIREMENTS.md IMPL-05 note.

    ```js
    // src/adapter/discussTodos.mjs
    // Discuss/spec/research (IMPL-05) + todos/notes/seeds/memory/handoff (IMPL-06).
    // Phase 11.

    const NOT_IMPLEMENTED_05 = (name) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 11 / IMPL-05)');
    };
    const NOT_IMPLEMENTED_06 = (name) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 11 / IMPL-06)');
    };

    export default {
      // IMPL-05 (21 methods)
      async getContext(phase)                    { NOT_IMPLEMENTED_05('getContext'); },
      async putContext(phase, body)              { NOT_IMPLEMENTED_05('putContext'); },
      async updatePhaseContext(phase, patch)     { NOT_IMPLEMENTED_05('updatePhaseContext'); },
      async getSpec(phase)                       { NOT_IMPLEMENTED_05('getSpec'); },
      async putSpec(phase, body)                 { NOT_IMPLEMENTED_05('putSpec'); },
      async getResearch(phase, kind)             { NOT_IMPLEMENTED_05('getResearch'); },
      async writeResearch(phase, kind, body)     { NOT_IMPLEMENTED_05('writeResearch'); },
      async getDiscovery(phase)                  { NOT_IMPLEMENTED_05('getDiscovery'); },
      async putDiscovery(phase, body)            { NOT_IMPLEMENTED_05('putDiscovery'); },
      async putDiscussionLog(phase, body)        { NOT_IMPLEMENTED_05('putDiscussionLog'); },
      async getCheckpoint(phase)                 { NOT_IMPLEMENTED_05('getCheckpoint'); },
      async putCheckpoint(phase, body)           { NOT_IMPLEMENTED_05('putCheckpoint'); },
      async removeCheckpoint(phase)              { NOT_IMPLEMENTED_05('removeCheckpoint'); },
      async putQuestionsState(phase, body)       { NOT_IMPLEMENTED_05('putQuestionsState'); },
      async getQuestionsState(phase)             { NOT_IMPLEMENTED_05('getQuestionsState'); },
      async putQuestionsCompanion(phase, body)   { NOT_IMPLEMENTED_05('putQuestionsCompanion'); },
      async getMethodology()                     { NOT_IMPLEMENTED_05('getMethodology'); },
      async getDecisionsIndex()                  { NOT_IMPLEMENTED_05('getDecisionsIndex'); },
      async listPriorPhaseContexts(currentPhase, limit) { NOT_IMPLEMENTED_05('listPriorPhaseContexts'); },
      async listPhaseDecisions(phase)            { NOT_IMPLEMENTED_05('listPhaseDecisions'); },
      async getDecisions()                       { NOT_IMPLEMENTED_05('getDecisions'); },

      // IMPL-06 (27 methods)
      async listTodos(filter)                    { NOT_IMPLEMENTED_06('listTodos'); },
      async getTodo(id)                          { NOT_IMPLEMENTED_06('getTodo'); },
      async addTodo(spec)                        { NOT_IMPLEMENTED_06('addTodo'); },
      async completeTodo(id)                     { NOT_IMPLEMENTED_06('completeTodo'); },
      async closeTodosByResolvesPhase(phase)     { NOT_IMPLEMENTED_06('closeTodosByResolvesPhase'); },
      async findNextTodoId()                     { NOT_IMPLEMENTED_06('findNextTodoId'); },
      async tagTodoResolvesPhase(id, phase)      { NOT_IMPLEMENTED_06('tagTodoResolvesPhase'); },
      async listNotes(filter)                    { NOT_IMPLEMENTED_06('listNotes'); },
      async addNote(spec)                        { NOT_IMPLEMENTED_06('addNote'); },
      async markNotePromoted(id)                 { NOT_IMPLEMENTED_06('markNotePromoted'); },
      async findRelatedTodos(query)              { NOT_IMPLEMENTED_06('findRelatedTodos'); },
      async addSeed(spec)                        { NOT_IMPLEMENTED_06('addSeed'); },
      async listSeeds(filter)                    { NOT_IMPLEMENTED_06('listSeeds'); },
      async getSeed(id)                          { NOT_IMPLEMENTED_06('getSeed'); },
      async findNextSeedId()                     { NOT_IMPLEMENTED_06('findNextSeedId'); },
      async getHandoff(phase)                    { NOT_IMPLEMENTED_06('getHandoff'); },
      async putHandoff(phase, body)              { NOT_IMPLEMENTED_06('putHandoff'); },
      async removeHandoff(phase)                 { NOT_IMPLEMENTED_06('removeHandoff'); },
      async listOrphanedHandoffs()               { NOT_IMPLEMENTED_06('listOrphanedHandoffs'); },
      async getContinueHere(phase)               { NOT_IMPLEMENTED_06('getContinueHere'); },
      async putContinueHere(phase, body)         { NOT_IMPLEMENTED_06('putContinueHere'); },
      async findContinueHere()                   { NOT_IMPLEMENTED_06('findContinueHere'); },
      async listMemoryEntries(filter)            { NOT_IMPLEMENTED_06('listMemoryEntries'); },
      async findDeferredScopeRefs()              { NOT_IMPLEMENTED_06('findDeferredScopeRefs'); },
      async findPlaceholderSummaries()           { NOT_IMPLEMENTED_06('findPlaceholderSummaries'); },
      async detectActiveContext()                { NOT_IMPLEMENTED_06('detectActiveContext'); },
      async listIncompletePlans()                { NOT_IMPLEMENTED_06('listIncompletePlans'); },
    };
    ```
  </action>
  <verify>
    <automated>test -f src/adapter/discussTodos.mjs &amp;&amp; node --check src/adapter/discussTodos.mjs &amp;&amp; M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/discussTodos.mjs); test "$M" -eq 48</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses
    - Contains exactly 48 async method declarations (21 IMPL-05 + 27 IMPL-06)
    - Two NOT_IMPLEMENTED helpers (one per IMPL group); each method calls the right one
    - recordDecision is NOT in this file (folds into recordStateEvent in primitives.mjs)
    - Default export is a plain object
  </acceptance_criteria>
  <done>discussTodos cluster file in place with 48 stubs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: Create src/adapter/longTail.mjs (Phase 12 / IMPL-07..11)</name>
  <read_first>
    - .planning/REQUIREMENTS.md IMPL-07..11 lines 493-543 (~80 method names total)
  </read_first>
  <files>
    - src/adapter/longTail.mjs
  </files>
  <action>
    Create src/adapter/longTail.mjs with all methods from IMPL-07..11.
    Use 5 NOT_IMPLEMENTED helpers (one per IMPL group), or one helper
    that takes the impl ID — either is fine; the example below uses one
    helper for clarity.

    ```js
    // src/adapter/longTail.mjs
    // Workstream/workspace/config/skill (IMPL-07) +
    // spike/sketch/codebase/intel/learnings (IMPL-08) +
    // debug subsystem (IMPL-09) +
    // reports/forensics/dependency/sidecar (IMPL-10) +
    // doc ingestion + templates + commit (IMPL-11). Phase 12.

    const NOT_IMPLEMENTED = (name, impl) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 12 / ' + impl + ')');
    };

    export default {
      // IMPL-07 (18 methods)
      async getActiveWorkstream()                { NOT_IMPLEMENTED('getActiveWorkstream', 'IMPL-07'); },
      async listWorkstreams()                    { NOT_IMPLEMENTED('listWorkstreams', 'IMPL-07'); },
      async createWorkstream(spec)               { NOT_IMPLEMENTED('createWorkstream', 'IMPL-07'); },
      async setActiveWorkstream(id)              { NOT_IMPLEMENTED('setActiveWorkstream', 'IMPL-07'); },
      async getWorkstreamStatus(id)              { NOT_IMPLEMENTED('getWorkstreamStatus', 'IMPL-07'); },
      async archiveWorkstream(id)                { NOT_IMPLEMENTED('archiveWorkstream', 'IMPL-07'); },
      async listWorkstreamProgress()             { NOT_IMPLEMENTED('listWorkstreamProgress', 'IMPL-07'); },
      async createWorkspaceShell(spec)           { NOT_IMPLEMENTED('createWorkspaceShell', 'IMPL-07'); },
      async removeWorkspaceShell(id)             { NOT_IMPLEMENTED('removeWorkspaceShell', 'IMPL-07'); },
      async getConfig()                          { NOT_IMPLEMENTED('getConfig', 'IMPL-07'); },
      async updateConfig(patch)                  { NOT_IMPLEMENTED('updateConfig', 'IMPL-07'); },
      async ensureConfigSection(section)         { NOT_IMPLEMENTED('ensureConfigSection', 'IMPL-07'); },
      async createInitialConfig(spec)            { NOT_IMPLEMENTED('createInitialConfig', 'IMPL-07'); },
      async updateModelProfile(profile)          { NOT_IMPLEMENTED('updateModelProfile', 'IMPL-07'); },
      async getConfigPath()                      { NOT_IMPLEMENTED('getConfigPath', 'IMPL-07'); },
      async writeSkillManifest(manifest)         { NOT_IMPLEMENTED('writeSkillManifest', 'IMPL-07'); },
      async listProjectSkills()                  { NOT_IMPLEMENTED('listProjectSkills', 'IMPL-07'); },
      async getDocsInitContext()                 { NOT_IMPLEMENTED('getDocsInitContext', 'IMPL-07'); },

      // IMPL-08 (32 methods)
      async addSpike(spec)                       { NOT_IMPLEMENTED('addSpike', 'IMPL-08'); },
      async listSpikes()                         { NOT_IMPLEMENTED('listSpikes', 'IMPL-08'); },
      async getSpike(id)                         { NOT_IMPLEMENTED('getSpike', 'IMPL-08'); },
      async getSpikeManifest(id)                 { NOT_IMPLEMENTED('getSpikeManifest', 'IMPL-08'); },
      async updateSpikeManifest(id, patch)       { NOT_IMPLEMENTED('updateSpikeManifest', 'IMPL-08'); },
      async getSpikeConventions(id)              { NOT_IMPLEMENTED('getSpikeConventions', 'IMPL-08'); },
      async updateSpikeConventions(id, body)     { NOT_IMPLEMENTED('updateSpikeConventions', 'IMPL-08'); },
      async recordSpikeResult(id, result)        { NOT_IMPLEMENTED('recordSpikeResult', 'IMPL-08'); },
      async addSpikeRequirement(id, req)         { NOT_IMPLEMENTED('addSpikeRequirement', 'IMPL-08'); },
      async recordSpikeWrapUp(id, body)          { NOT_IMPLEMENTED('recordSpikeWrapUp', 'IMPL-08'); },
      async markSpikeProcessed(id)               { NOT_IMPLEMENTED('markSpikeProcessed', 'IMPL-08'); },
      async addSketch(spec)                      { NOT_IMPLEMENTED('addSketch', 'IMPL-08'); },
      async listSketches()                       { NOT_IMPLEMENTED('listSketches', 'IMPL-08'); },
      async getSketchManifest(id)                { NOT_IMPLEMENTED('getSketchManifest', 'IMPL-08'); },
      async updateSketchManifest(id, patch)      { NOT_IMPLEMENTED('updateSketchManifest', 'IMPL-08'); },
      async recordSketchWinner(id, winner)       { NOT_IMPLEMENTED('recordSketchWinner', 'IMPL-08'); },
      async recordSketchWrapUp(id, body)         { NOT_IMPLEMENTED('recordSketchWrapUp', 'IMPL-08'); },
      async markSketchProcessed(id)              { NOT_IMPLEMENTED('markSketchProcessed', 'IMPL-08'); },
      async getSketchTheme(id)                   { NOT_IMPLEMENTED('getSketchTheme', 'IMPL-08'); },
      async putSketchTheme(id, body)             { NOT_IMPLEMENTED('putSketchTheme', 'IMPL-08'); },
      async putSketchAsset(id, asset)            { NOT_IMPLEMENTED('putSketchAsset', 'IMPL-08'); },
      async putCodebaseDoc(name, body)           { NOT_IMPLEMENTED('putCodebaseDoc', 'IMPL-08'); },
      async getCodebaseDoc(name)                 { NOT_IMPLEMENTED('getCodebaseDoc', 'IMPL-08'); },
      async listCodebaseDocs()                   { NOT_IMPLEMENTED('listCodebaseDocs', 'IMPL-08'); },
      async addCodebaseDoc(spec)                 { NOT_IMPLEMENTED('addCodebaseDoc', 'IMPL-08'); },
      async putIntelDoc(category, key, body)     { NOT_IMPLEMENTED('putIntelDoc', 'IMPL-08'); },
      async getIntelDoc(category, key)           { NOT_IMPLEMENTED('getIntelDoc', 'IMPL-08'); },
      async getIntelStatus()                     { NOT_IMPLEMENTED('getIntelStatus', 'IMPL-08'); },
      async getIntelDiff()                       { NOT_IMPLEMENTED('getIntelDiff', 'IMPL-08'); },
      async snapshotIntel()                      { NOT_IMPLEMENTED('snapshotIntel', 'IMPL-08'); },
      async validateIntel()                      { NOT_IMPLEMENTED('validateIntel', 'IMPL-08'); },
      async queryIntel(query)                    { NOT_IMPLEMENTED('queryIntel', 'IMPL-08'); },
      async patchIntelMeta(patch)                { NOT_IMPLEMENTED('patchIntelMeta', 'IMPL-08'); },
      async recordIntelSnapshot(snapshot)        { NOT_IMPLEMENTED('recordIntelSnapshot', 'IMPL-08'); },
      async recordLearnings(body)                { NOT_IMPLEMENTED('recordLearnings', 'IMPL-08'); },
      async markGraduated(id)                    { NOT_IMPLEMENTED('markGraduated', 'IMPL-08'); },
      async listLearningSections()               { NOT_IMPLEMENTED('listLearningSections', 'IMPL-08'); },

      // IMPL-09 (8 methods)
      async listDebugSessions()                  { NOT_IMPLEMENTED('listDebugSessions', 'IMPL-09'); },
      async getDebugSession(id)                  { NOT_IMPLEMENTED('getDebugSession', 'IMPL-09'); },
      async addDebugSession(spec)                { NOT_IMPLEMENTED('addDebugSession', 'IMPL-09'); },
      async updateDebugSession(id, section, body, mode) { NOT_IMPLEMENTED('updateDebugSession', 'IMPL-09'); },
      async archiveDebugSession(id)              { NOT_IMPLEMENTED('archiveDebugSession', 'IMPL-09'); },
      async getDebugKnowledgeBase()              { NOT_IMPLEMENTED('getDebugKnowledgeBase', 'IMPL-09'); },
      async appendDebugKnowledgeBase(body)       { NOT_IMPLEMENTED('appendDebugKnowledgeBase', 'IMPL-09'); },
      async appendDebugSpecialistReview(id, body) { NOT_IMPLEMENTED('appendDebugSpecialistReview', 'IMPL-09'); },

      // IMPL-10 (12 methods)
      async addForensicReport(spec)              { NOT_IMPLEMENTED('addForensicReport', 'IMPL-10'); },
      async listSessionReports()                 { NOT_IMPLEMENTED('listSessionReports', 'IMPL-10'); },
      async putSessionReport(id, body)           { NOT_IMPLEMENTED('putSessionReport', 'IMPL-10'); },
      async writeInboxTriageReport(report)       { NOT_IMPLEMENTED('writeInboxTriageReport', 'IMPL-10'); },
      async putReport(id, body)                  { NOT_IMPLEMENTED('putReport', 'IMPL-10'); },
      async getPhaseManifest(phase)              { NOT_IMPLEMENTED('getPhaseManifest', 'IMPL-10'); },
      async findDependentPhases(phase)           { NOT_IMPLEMENTED('findDependentPhases', 'IMPL-10'); },
      async findIntraPhasePlanDependencies(phase) { NOT_IMPLEMENTED('findIntraPhasePlanDependencies', 'IMPL-10'); },
      async getNextCallCount()                   { NOT_IMPLEMENTED('getNextCallCount', 'IMPL-10'); },
      async incrementNextCallCount()             { NOT_IMPLEMENTED('incrementNextCallCount', 'IMPL-10'); },
      async recordTempArtifact(id, body)         { NOT_IMPLEMENTED('recordTempArtifact', 'IMPL-10'); },
      async getTempArtifact(id)                  { NOT_IMPLEMENTED('getTempArtifact', 'IMPL-10'); },

      // IMPL-11 (10 methods; writeIntel folds into putIntelDoc and is omitted per REQUIREMENTS.md)
      async writeDocClassification(doc)          { NOT_IMPLEMENTED('writeDocClassification', 'IMPL-11'); },
      async listDocClassifications()             { NOT_IMPLEMENTED('listDocClassifications', 'IMPL-11'); },
      async writeIngestConflicts(conflicts)      { NOT_IMPLEMENTED('writeIngestConflicts', 'IMPL-11'); },
      async getIngestConflicts()                 { NOT_IMPLEMENTED('getIngestConflicts', 'IMPL-11'); },
      async bootstrapFromGsd2(source)            { NOT_IMPLEMENTED('bootstrapFromGsd2', 'IMPL-11'); },
      async selectPhaseTemplate(spec)            { NOT_IMPLEMENTED('selectPhaseTemplate', 'IMPL-11'); },
      async fillTemplate(template, vars)         { NOT_IMPLEMENTED('fillTemplate', 'IMPL-11'); },
      async commitPlanningState(message)         { NOT_IMPLEMENTED('commitPlanningState', 'IMPL-11'); },
      async commitToSubrepo(spec)                { NOT_IMPLEMENTED('commitToSubrepo', 'IMPL-11'); },
      async checkCommitReady()                   { NOT_IMPLEMENTED('checkCommitReady', 'IMPL-11'); },
    };
    ```
  </action>
  <verify>
    <automated>test -f src/adapter/longTail.mjs &amp;&amp; node --check src/adapter/longTail.mjs &amp;&amp; M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/longTail.mjs); test "$M" -eq 80</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses
    - Contains exactly 80 async method declarations (18+32+8+12+10)
    - Each method's NOT_IMPLEMENTED call passes the correct IMPL-NN tag
    - Default export is a plain object
  </acceptance_criteria>
  <done>longTail cluster file in place with 80 stubs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 9: Create src/adapter/initBundlers.mjs (Phase 13 / IMPL-12) + final wiring verification</name>
  <read_first>
    - .planning/REQUIREMENTS.md IMPL-12 lines 545-551 (13 init bundler methods)
    - tests/unit/adapter-shell.test.mjs (Wave 0 driver)
    - src/adapter.mjs (Task 1)
  </read_first>
  <files>
    - src/adapter/initBundlers.mjs
  </files>
  <action>
    Create src/adapter/initBundlers.mjs with the 13 init bundlers:

    ```js
    // src/adapter/initBundlers.mjs
    // Workflow init bundlers. Phase 13 / IMPL-12.

    const NOT_IMPLEMENTED = (name) => {
      throw new Error('BeadsAdapter.' + name + ': not implemented (Phase 13 / IMPL-12)');
    };

    export default {
      async getExecutePhaseInit(phase)           { NOT_IMPLEMENTED('getExecutePhaseInit'); },
      async getPlanPhaseInit(phase)              { NOT_IMPLEMENTED('getPlanPhaseInit'); },
      async getNewMilestoneInit()                { NOT_IMPLEMENTED('getNewMilestoneInit'); },
      async getQuickInit()                       { NOT_IMPLEMENTED('getQuickInit'); },
      async getResumeInit()                      { NOT_IMPLEMENTED('getResumeInit'); },
      async getVerifyWorkInit(phase)             { NOT_IMPLEMENTED('getVerifyWorkInit'); },
      async getPhaseOpInit(phase, op)            { NOT_IMPLEMENTED('getPhaseOpInit'); },
      async getMilestoneOpInit(milestone, op)    { NOT_IMPLEMENTED('getMilestoneOpInit'); },
      async getMapCodebaseInit()                 { NOT_IMPLEMENTED('getMapCodebaseInit'); },
      async getNewProjectInit()                  { NOT_IMPLEMENTED('getNewProjectInit'); },
      async getProgressInit()                    { NOT_IMPLEMENTED('getProgressInit'); },
      async getManagerInit()                     { NOT_IMPLEMENTED('getManagerInit'); },
      async getProjectExistence()                { NOT_IMPLEMENTED('getProjectExistence'); },
    };
    ```

    Final wiring step — now that all 8 cluster files exist, verify the
    shell loads and the Wave 0 adapter-shell.test.mjs goes green:

    ```bash
    node --check src/adapter.mjs
    node --check src/adapter/primitives.mjs
    node --check src/adapter/phaseLifecycle.mjs
    node --check src/adapter/roadmapMilestone.mjs
    node --check src/adapter/state.mjs
    node --check src/adapter/verifyReviews.mjs
    node --check src/adapter/discussTodos.mjs
    node --check src/adapter/longTail.mjs
    node --check src/adapter/initBundlers.mjs

    # Run the Wave 0 test:
    node --test tests/unit/adapter-shell.test.mjs
    ```

    All 6 tests in adapter-shell.test.mjs MUST pass:
      1. constructor accepts string projectRoot
      2. constructor rejects empty/non-string
      3. capabilities readable without instantiation
      4. capabilities is frozen
      5. stub methods throw canonical message format
      6. stub methods include the method name in the error

    If test 5 fails on any sample method, the corresponding cluster file
    has a stub format drift (RESEARCH.md §10 Risk #9). Fix the stub
    template — never weaken the test.
  </action>
  <verify>
    <automated>test -f src/adapter/initBundlers.mjs &amp;&amp; node --check src/adapter/initBundlers.mjs &amp;&amp; M=$(grep -cE "async [a-zA-Z]+\(" src/adapter/initBundlers.mjs); test "$M" -eq 13 &amp;&amp; node --test tests/unit/adapter-shell.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - src/adapter/initBundlers.mjs exists and parses
    - Contains exactly 13 async method declarations
    - All 9 src/adapter/*.mjs files (1 shell + 8 clusters) parse with node --check
    - `node --test tests/unit/adapter-shell.test.mjs` reports ALL 6 tests pass
    - The full count of stub methods across cluster files: 16 + 32 + 22 + 21 + 50 + 48 + 80 + 13 = 282 (allow ±5 for cross-cluster overlap)
  </acceptance_criteria>
  <done>initBundlers in place; full BeadsAdapter shell wires; Wave 0 adapter-shell.test.mjs green</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| consumer code → BeadsAdapter constructor | Untrusted projectRoot string is stored; could be path-traversal vector when methods later use it. Phase 6 only stores it; Phase 7+ method bodies handle path safety. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-6.06-01 | Tampering | Stub error format drift across 9 files (RESEARCH.md §10 Risk #9) | mitigate | Each cluster file uses an inline NOT_IMPLEMENTED helper with the EXACT template `'BeadsAdapter.' + name + ': not implemented (Phase ' + phase + ' / ' + impl + ')'`. Wave 0 test regex `/^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/` validates 8 sampled methods (one per cluster). Drift in any cluster surfaces immediately. |
| T-6.06-02 | Information Disclosure | _ensureBd error message includes projectRoot path, leaking filesystem layout | accept | The path is exactly what the consumer passed in; not a new exposure. Future enhancement (v1.1): redact home directory. |
| T-6.06-03 | Tampering | capabilities object is mutated by consumer code at runtime | mitigate | `Object.freeze` per D-03; Wave 0 test asserts `Object.isFrozen(BeadsAdapter.capabilities)`. |
| T-6.06-04 | Denial of Service | Object.assign at module load fails because cluster file has duplicate method names | mitigate | Method-name uniqueness across clusters is enforced by SYNTHESIS.md §4 cluster boundaries. Cross-cluster duplicates (e.g., recordStateEvent in primitives.mjs + state.mjs) are explicitly removed in the cluster method lists; a duplicate would silently let the later cluster win without throwing — but the canonical-message test would still pass. Phase 7 conformance can later detect overrides via `getOwnPropertyNames(BeadsAdapter.prototype)` introspection. |

No HIGH threats. security_enforcement gate satisfied at LOW per ASVS L1.
</threat_model>

<verification>
- All 9 src/adapter/*.mjs files parse with node --check
- `node --test tests/unit/adapter-shell.test.mjs` is green (6/6 tests pass)
- Importing src/adapter.mjs in a node script: `await import('./src/adapter.mjs')` resolves; the export object has BeadsAdapter as both default and named export
- `BeadsAdapter.capabilities` is the frozen object with 7 booleans
- Calling any of the ~282 stub methods throws an Error matching the canonical pattern
</verification>

<success_criteria>
- 9 source files exist (1 shell + 8 cluster bags)
- ~282 stub methods total, all throwing the canonical error message
- Wave 0 adapter-shell.test.mjs green
- BeadsAdapter constructible without bd (lazy validation)
- capabilities readable without instantiation (D-03)
</success_criteria>

<output>
After completion, create `.planning/phases/06-cleanup-adapter-library-scaffolding/06-06-SUMMARY.md` documenting: (1) per-cluster stub counts; (2) any cross-cluster method-name overlaps detected during Object.assign load; (3) the adapter-shell.test.mjs result.
</output>
