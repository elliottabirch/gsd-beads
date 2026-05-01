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
