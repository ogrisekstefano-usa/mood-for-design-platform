const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  
  const files = [
    'desktop.html',
    'mobile.html',
    'dashboard.html',
    'catalog-row.html',
    'certification.html',
    'index.html'
  ];
  
  const baseDir = '/app/frontend/public/wireframes/review-workspace';
  
  for (const file of files) {
    const filePath = path.join(baseDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        continue;
    }
    
    const page = await browser.newPage();
    
    // Set viewport
    if (file === 'mobile.html') {
      await page.setViewport({ width: 390, height: 844 });
    } else {
      await page.setViewport({ width: 1920, height: 1080 });
    }
    
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });
    
    const screenshotPath = path.join(baseDir, file.replace('.html', '.png'));
    await page.screenshot({ path: screenshotPath, fullPage: file !== 'desktop.html' && file !== 'mobile.html' });
    
    console.log(`Saved screenshot: ${screenshotPath}`);
  }
  
  await browser.close();
})();