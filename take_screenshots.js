const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const files = [
    { name: 'desktop.html', width: 1920, height: 1080 },
    { name: 'mobile.html', width: 390, height: 844 },
    { name: 'entity-inspector.html', width: 1920, height: 1080 },
    { name: 'ai-validation.html', width: 1920, height: 1080 },
    { name: 'post-certification.html', width: 1920, height: 1080 },
    { name: 'knowledge-strip.html', width: 1920, height: 1080 }
  ];

  const baseDir = '/app/frontend/public/wireframes/review-workspace-v2';

  for (const file of files) {
    await page.setViewportSize({ width: file.width, height: file.height });
    const filePath = `file://${path.join(baseDir, file.name)}`;
    await page.goto(filePath, { waitUntil: 'networkidle' });
    const screenshotPath = path.join(baseDir, file.name.replace('.html', '.png'));
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot: ${screenshotPath}`);
  }

  await browser.close();
})();