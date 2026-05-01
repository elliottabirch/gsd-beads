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
