const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.cjs'));

console.log(`\x1b[36mRunning ${testFiles.length} test suites in /tests...\x1b[0m\n`);

let passed = 0;
let failed = 0;

for (const file of testFiles) {
  const fullPath = path.join(testsDir, file);
  try {
    process.stdout.write(`\x1b[33m▶ [RUN]\x1b[0m ${file}... `);
    const output = execSync(`"${process.execPath}" "${fullPath}"`, { encoding: 'utf8' });
    console.log(`\x1b[32m✔ PASS\x1b[0m`);
    if (output.trim()) {
      console.log(output.trim().split('\n').map(l => `   ${l}`).join('\n'));
    }
    passed++;
  } catch (err) {
    console.log(`\x1b[31m✖ FAIL\x1b[0m`);
    console.error(err.stdout || err.message);
    failed++;
  }
}

console.log(`\n\x1b[1mSummary: ${passed} passed, ${failed} failed out of ${testFiles.length} suites.\x1b[0m`);
if (failed > 0) process.exit(1);
