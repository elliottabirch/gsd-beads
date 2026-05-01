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
