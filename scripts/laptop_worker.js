const { runLaptopWorker } = require('../lib/laptop-control');

runLaptopWorker().catch((e) => {
  process.stderr.write(`[laptop-worker] fatal: ${String(e?.message || e || '')}\n`);
  process.exit(1);
});

