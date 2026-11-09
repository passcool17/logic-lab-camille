import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const shots = path.resolve(root, '..', 'logic-lab-camille-shots');
fs.mkdirSync(shots, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const file = path.join(root, urlPath.replace(/^\//, ''));
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Chrome/Chromium introuvable');
}

async function main() {
  const { server, base } = await startServer();
  const browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
  });

  let failed = 0;
  const check = async (name, fn) => {
    try {
      await fn();
      console.log(`ok  - ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL - ${name}`);
      console.error(err);
    }
  };

  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

  await check('accueil visible', async () => {
    const title = await page.locator('h1').innerText();
    if (!/raisonnement/i.test(title)) throw new Error(title);
  });

  await check('onglet validité + modus ponens', async () => {
    await page.getByRole('tab', { name: 'Validité' }).click();
    await page.getByRole('button', { name: 'Modus ponens' }).click();
    await page.waitForSelector('#validite-result:not([hidden])');
    const text = await page.locator('#validite-result').innerText();
    if (!/valide/i.test(text) || !/Modus ponens/i.test(text)) throw new Error(text);
    await page.screenshot({ path: path.join(shots, '1-validite.png'), fullPage: true });
  });

  await check('contre-exemple affirmation du conséquent', async () => {
    await page.getByRole('button', { name: /Aff\. du conséquent/i }).click();
    await page.waitForSelector('#validite-result:not([hidden])');
    const text = await page.locator('#validite-result').innerText();
    if (!/non valide/i.test(text) || !/contre-exemple/i.test(text)) throw new Error(text);
  });

  await check('table de vérité tautologie', async () => {
    await page.getByRole('tab', { name: 'Table de vérité' }).click();
    await page.getByRole('button', { name: 'P ∨ ¬P' }).click();
    await page.waitForSelector('#table-result:not([hidden])');
    const text = await page.locator('#table-result').innerText();
    if (!/Tautologie/i.test(text)) throw new Error(text);
    const rows = await page.locator('table.truth tbody tr').count();
    if (rows !== 2) throw new Error(`rows=${rows}`);
    await page.screenshot({ path: path.join(shots, '2-table.png'), fullPage: true });
  });

  await check('analyser une affirmation', async () => {
    await page.getByRole('tab', { name: 'Analyser' }).click();
    await page.locator('#claim-examples button').first().click();
    await page.waitForSelector('#analyser-result:not([hidden])');
    const text = await page.locator('#analyser-result').innerText();
    if (!/Falsifiabilité/i.test(text) || !/Prémisses implicites/i.test(text)) throw new Error(text);
    await page.screenshot({ path: path.join(shots, '3-analyser.png'), fullPage: true });
  });

  await browser.close();
  server.close();
  if (failed) {
    console.error(`\n${failed} UI test(s) failed`);
    process.exit(1);
  }
  console.log('\nUI e2e passed (3 screenshots)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
