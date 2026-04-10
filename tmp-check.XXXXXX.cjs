const { chromium } = require('playwright');
const fs = require('fs');
function parseEnvFile(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}
(async () => {
  const env = parseEnvFile('.env.audit.local');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://app.zokorp.com/login', { waitUntil: 'networkidle' });
    await page.fill('#email', env.JOURNEY_EMAIL);
    await page.fill('#password', env.JOURNEY_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/\/account$/, { timeout: 30000 });
    await page.goto('https://app.zokorp.com/software/zokorp-validator', { waitUntil: 'networkidle' });
    const body = await page.textContent('body');
    const match = body.match(/Selected credits:\s*(\d+)/);
    console.log(JSON.stringify({ selectedCredits: match ? Number(match[1]) : null, hasRunButton: /Run ZoKorpValidator/.test(body) }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
