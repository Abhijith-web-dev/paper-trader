import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run npm run build first.');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  
  let filePath = path.join(distDir, reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Server error: ' + err.message);
  }
});

const PORT = 4174;
const sessionTempDir = path.join(os.tmpdir(), `chrome-e2e-${Date.now()}`);
fs.mkdirSync(sessionTempDir, { recursive: true });

function runHeadlessChrome(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${sessionTempDir}`,
      '--dump-dom',
      url
    ];

    const child = spawn(chromePath, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) {}
      resolve({ stdout, timedOut: true });
    }, timeoutMs);

    child.on('close', code => {
      clearTimeout(timer);
      resolve({ stdout, code, timedOut: false });
    });

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`\n======================================================`);
  console.log(`🧪 STARTING AUTOMATED HEADLESS E2E TESTING ON LOCAL`);
  console.log(`   Target Server: http://127.0.0.1:${PORT}`);
  console.log(`======================================================`);

  const routes = ['/', '/journal', '/screener', '/transactions'];
  let failures = 0;

  for (const route of routes) {
    const url = `http://127.0.0.1:${PORT}${route}`;
    process.stdout.write(`  Testing ${route.padEnd(16)} ... `);

    try {
      const res = await runHeadlessChrome(url, 10000);
      const dom = res.stdout || '';

      const hasCrashNotice = dom.includes('Exchange Dispatch Notice');
      const hasTotalInrCrash = dom.includes('totalInrCharges is not defined');
      const hasUseMemoCrash = dom.includes('useMemo is not defined');
      const hasNotDefinedCrash = dom.includes('is not defined');
      const hasMinifiedCrash = dom.includes('Minified React error');

      if (hasCrashNotice || hasTotalInrCrash || hasUseMemoCrash || hasNotDefinedCrash || hasMinifiedCrash) {
        console.log(`❌ FAILED (Crash Detected)`);
        if (hasCrashNotice) console.error(`     💥 "Exchange Dispatch Notice" caught in rendered DOM.`);
        if (hasTotalInrCrash) console.error(`     💥 "totalInrCharges is not defined" found.`);
        if (hasUseMemoCrash) console.error(`     💥 "useMemo is not defined" found.`);
        if (hasNotDefinedCrash) console.error(`     💥 ReferenceError: "is not defined" found.`);
        if (hasMinifiedCrash) console.error(`     💥 React runtime exception found.`);
        failures++;
      } else if (dom.length < 500) {
        console.log(`⚠️ FAILED (Empty DOM: ${dom.length} bytes)`);
        failures++;
      } else {
        console.log(`✅ PASSED (Rendered DOM: ${dom.length} bytes, 0 errors)`);
      }
    } catch (err) {
      console.log(`❌ FAILED (${err.message})`);
      failures++;
    }
  }

  server.close(() => {
    try {
      fs.rmSync(sessionTempDir, { recursive: true, force: true, maxRetries: 3 });
    } catch (e) {}

    console.log(`======================================================`);
    if (failures > 0) {
      console.error(`❌ AUTOMATION TEST RESULT: ${failures} route(s) failed with exceptions.`);
      process.exit(1);
    } else {
      console.log(`🎉 ALL LOCAL AUTOMATION TESTS PASSED: SITE IS RUNNING HEALTHY AND ERROR-FREE!`);
      process.exit(0);
    }
  });
});
