#!/usr/bin/env node
/**
 * Boots the FORTRESS server, waits for it to become healthy, runs the security
 * test suite against it, then shuts the server down and propagates the exit
 * code. Used by `npm test` and CI so the suite is fully self-contained.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`${BASE}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server did not become healthy within ${timeoutMs}ms`));
      }
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

async function main() {
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: process.env.NODE_ENV || 'test' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  let exitCode = 1;
  try {
    await waitForHealth();
    exitCode = await new Promise((resolve) => {
      const tests = spawn(process.execPath, ['tests/security.test.js'], {
        cwd: ROOT,
        env: { ...process.env, TEST_URL: BASE },
        stdio: 'inherit',
      });
      tests.on('close', resolve);
    });
  } catch (err) {
    console.error('✖', err.message);
    exitCode = 1;
  } finally {
    server.kill();
  }
  process.exit(exitCode);
}

main();
