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

  await check('intro repliée : Vérifier est au-dessus de la pliure', async () => {
    const introBody = page.locator('#intro-body');
    if (await introBody.isVisible()) throw new Error('intro should be collapsed');
    const btn = page.locator('#btn-validite');
    const box = await btn.boundingBox();
    if (!box) throw new Error('no Vérifier button');
    if (box.y + box.height > 915) throw new Error(`Vérifier is below the fold y=${box.y}`);
  });

  await check('slogan français, logo propositionnel', async () => {
    const text = await page.locator('#app').innerText();
    if (/conspiracy theorist/i.test(text)) throw new Error('English slogan still present');
    const logo = await page.locator('.logo').innerText();
    if (logo.includes('∀')) throw new Error(`logo=${logo}`);
    if (!text.includes('Partir des prémisses')) throw new Error('missing French tagline');
  });

  await check('onglet validité + modus ponens', async () => {
    await page.getByRole('tab', { name: 'Validité' }).click();
    await page.getByRole('button', { name: 'Modus ponens' }).click();
    await page.waitForSelector('#validite-result:not([hidden])');
    const text = await page.locator('#validite-result').innerText();
    if (!/valide/i.test(text) || !/Modus ponens/i.test(text)) throw new Error(text);
    if (!/donc/.test(text)) throw new Error(`missing donc: ${text}`);
    if (!/Si P alors Q/.test(text)) throw new Error(`missing gloss: ${text}`);
    await page.screenshot({ path: path.join(shots, 'v2-validite.png'), fullPage: true });
  });

  await check('contre-exemple affirmation du conséquent, pas à pas', async () => {
    await page.getByRole('button', { name: /Aff\. du conséquent/i }).click();
    await page.waitForSelector('#validite-result:not([hidden])');
    const text = await page.locator('#validite-result').innerText();
    if (!/non valide/i.test(text) || !/contre-exemple/i.test(text)) throw new Error(text);
    if (!/Prémisse 1/.test(text) || !/Conclusion/.test(text)) throw new Error(text);
    await page.locator('#validite-result').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, 'v2-contre-exemple.png'), fullPage: true });
  });

  await check('phrase → formule', async () => {
    await page.locator('#phrase-validite').fill('S’il pleut, alors la rue est mouillée.');
    await page.locator('#btn-phrase-validite').click();
    await page.waitForSelector('#phrase-validite-result:not([hidden])');
    const text = await page.locator('#phrase-validite-result').innerText();
    if (!/P → Q/.test(text) && !/\(P → Q\)/.test(text)) throw new Error(text);
    if (!/pleut/i.test(text) || !/mouill/i.test(text)) throw new Error(text);
    await page.locator('#phrase-validite-result').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, 'v2-phrase.png'), fullPage: true });
  });

  await check('table de vérité tautologie', async () => {
    await page.getByRole('tab', { name: 'Table de vérité' }).click();
    await page.getByRole('button', { name: 'P ∨ ¬P' }).click();
    await page.waitForSelector('#table-result:not([hidden])');
    const text = await page.locator('#table-result').innerText();
    if (!/Tautologie/i.test(text)) throw new Error(text);
    const rows = await page.locator('table.truth tbody tr').count();
    if (rows !== 2) throw new Error(`rows=${rows}`);
    await page.screenshot({ path: path.join(shots, 'v2-table.png'), fullPage: true });
  });

  await check('remplir la table soi-même', async () => {
    await page.locator('#formula').fill('P ∨ ¬P');
    await page.locator('#btn-table-fill').click();
    await page.waitForSelector('#fill-table');
    const cells = page.locator('#fill-table .fill-btn');
    const n = await cells.count();
    if (n < 2) throw new Error(`fill cells=${n}`);
    for (let i = 0; i < n; i += 1) {
      const btn = cells.nth(i);
      const want = await btn.getAttribute('data-correct');
      await btn.click(); // ? → V
      if (want === '0') await btn.click(); // V → F
    }
    await page.locator('#btn-check-fill').click();
    const fb = await page.locator('#fill-feedback').innerText();
    if (!/Bravo|tout est juste/i.test(fb)) throw new Error(fb);
    await page.locator('#table-result').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, 'v2-table-remplir.png'), fullPage: true });
  });

  await check('analyser une affirmation', async () => {
    await page.getByRole('tab', { name: 'Analyser' }).click();
    await page.locator('#claim-examples button').nth(1).click();
    await page.waitForSelector('#analyser-result:not([hidden])');
    const text = await page.locator('#analyser-result').innerText();
    if (!/Falsifiabilité/i.test(text) || !/Prémisses implicites/i.test(text)) throw new Error(text);
    if (!/Prouvé/i.test(text) || !/Cause|corrélation/i.test(text)) throw new Error(`missing hints: ${text}`);
    if (/conspiracy theorist/i.test(text)) throw new Error('English leftover');
    await page.locator('textarea[data-qid="premises"]').fill('On suppose que le vaccin est forcément en cause.');
    await page.waitForTimeout(50);
    const saved = await page.evaluate(() => localStorage.getItem('logic-lab-analyser-v2'));
    if (!/vaccin/i.test(saved || '')) throw new Error(`not saved: ${saved}`);
    await page.screenshot({ path: path.join(shots, 'v2-analyser.png'), fullPage: true });
  });

  await check('réponses Analyser isolées par affirmation', async () => {
    await page.locator('#claim-examples button').first().click();
    await page.waitForSelector('#analyser-result:not([hidden])');
    const val = await page.locator('textarea[data-qid="premises"]').inputValue();
    if (/vaccin/i.test(val)) throw new Error(`leaked answers: ${val}`);
  });

  await check('glossaire et ponts vers les jeux', async () => {
    const g = await page.locator('#glossaire').innerText();
    if (!/Modus ponens/.test(g) || !/Tautologie/.test(g)) throw new Error(g);
    const hrefs = await page.locator('.bridge-list a').evaluateAll((as) => as.map((a) => a.href));
    if (!hrefs.some((h) => h.includes('logic-theorist-camille'))) throw new Error(String(hrefs));
    if (!hrefs.some((h) => h.includes('atelier-preuves'))) throw new Error(String(hrefs));
    await page.locator('#glossaire').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, 'v2-glossaire.png'), fullPage: true });
  });

  await browser.close();
  server.close();
  if (failed) {
    console.error(`\n${failed} UI test(s) failed`);
    process.exit(1);
  }
  console.log('\nUI e2e passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
