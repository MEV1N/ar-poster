/**
 * Automated Image Target Compiler Tool
 * Reads registered posters from config/app-config.js and compiles them into
 * optimized multi-target MindAR binary file (targets.mind).
 *
 * Usage:
 *   node tools/compile-targets.mjs
 *   or: npm run compile-targets
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function compileAllTargets() {
  console.log('\n========================================');
  console.log(' WebAR Target Compiler');
  console.log('========================================\n');

  // Find Edge or Chrome executable
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  const browserPath = candidates.find(p => fs.existsSync(p));
  if (!browserPath) {
    console.error('Error: Could not find Microsoft Edge or Google Chrome executable.');
    process.exit(1);
  }

  console.log(`Using browser: ${browserPath}`);
  const port = 9333;
  const tempDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'ar-compiler-' + Date.now());

  const browserArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/tools/compiler.html?auto=all'
  ];

  console.log('Launching compiler in browser...');
  const proc = spawn(browserPath, browserArgs);

  // Wait for CDP endpoint
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise(r => setTimeout(r, 600));
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      const page = list.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {
      // waiting
    }
  }

  if (!wsUrl) {
    console.error('Error: Could not connect to browser CDP.');
    proc.kill();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(resolve => ws.onopen = resolve);

  let id = 1;
  function send(method, params = {}) {
    ws.send(JSON.stringify({ id: id++, method, params }));
  }

  send('Runtime.enable');

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      const args = data.params.args.map(a => a.value || a.description).join(' ');
      if (args.includes('[Compiler]')) {
        console.log(args);
      }
    }
  };

  console.log('Extracting feature descriptors and generating .mind files...');
  let completed = false;

  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));
    id++;
    const checkId = id;
    send('Runtime.evaluate', { expression: 'window.__batchDone' });
    const done = await new Promise(resolve => {
      const handler = (m) => {
        const d = JSON.parse(m.data);
        if (d.id === checkId) {
          ws.removeEventListener('message', handler);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener('message', handler);
      setTimeout(() => resolve(false), 800);
    });

    if (done) {
      completed = true;
      console.log('\n✓ Targets compiled and saved successfully to /targets/ and /public/targets/!\n');
      break;
    }
  }

  ws.close();
  proc.kill();

  if (!completed) {
    console.error('Compilation timed out.');
    process.exit(1);
  }
}

compileAllTargets().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
