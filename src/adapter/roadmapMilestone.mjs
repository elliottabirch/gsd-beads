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
