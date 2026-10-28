#!/usr/bin/env node
/**
 * Lightweight quality gate: byte-compiles every JavaScript file in the project
 * (excluding node_modules and build output) with `node --check` to catch syntax
 * errors before they reach runtime or CI's test stage.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vercel']);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      yield path.join(dir, entry.name);
    }
  }
}

let checked = 0;
let failed = 0;
for (const file of walk(ROOT)) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    checked++;
  } catch (cjsErr) {
    // Retry as an ES module (e.g. browser/Vite files using import/export).
    try {
      execFileSync(process.execPath, ['--check', '--input-type=module'], {
        input: fs.readFileSync(file),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      checked++;
    } catch (esmErr) {
      failed++;
      console.error(`✖ ${path.relative(ROOT, file)}`);
      console.error(String(esmErr.stderr || cjsErr.stderr || esmErr.message).trim());
    }
  }
}

console.log(`\nSyntax check: ${checked} file(s) OK, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
