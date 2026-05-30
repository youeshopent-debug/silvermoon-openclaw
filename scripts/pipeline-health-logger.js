'use strict';
const { recordCheckpoint } = require('../lib/health-audit');

function recordStart(pipelineName) {
  recordCheckpoint({ pipelineName, status: 'running', pid: process.pid });
}

function recordEnd(pipelineName, elapsed, err) {
  const entry = {
    pipelineName,
    status: err ? 'failed' : 'success',
    pid: process.pid,
    elapsed,
  };
  if (err) entry.error = err.message || String(err);
  recordCheckpoint(entry);
}

function wrap(pipelineFn, pipelineName) {
  return async (...args) => {
    const start = Date.now();
    recordStart(pipelineName);
    try {
      const result = await pipelineFn(...args);
      recordEnd(pipelineName, Date.now() - start);
      return result;
    } catch (err) {
      recordEnd(pipelineName, Date.now() - start, err);
      throw err;
    }
  };
}

module.exports = { wrap, recordStart, recordEnd };
