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
