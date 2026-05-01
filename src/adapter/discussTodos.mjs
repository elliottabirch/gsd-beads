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
