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
