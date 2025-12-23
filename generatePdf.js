const { chromium } = require('playwright');
const path = require('path');
 
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 🔧 Inject report data for Playwright PDF generation (non-breaking)
  const fs = require('fs');
  const reportDataPath = path.join(__dirname, 'report-data.json');
  if (fs.existsSync(reportDataPath)) {
    const reportData = JSON.parse(fs.readFileSync(reportDataPath, 'utf8'));
    await page.addInitScript(data => {
      window.__REPORT_DATA__ = data;
    }, reportData);
  }

 
  await page.goto(`file://${path.join(__dirname, 'report.html')}`, {
    waitUntil: 'networkidle'
  });
 
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
 
  await page.pdf({
    path: `inspection-report-${timestamp}.pdf`,
    format: 'A4',
    printBackground: true
  });
 
  await browser.close();
  console.log('PDF generated');
})();
 
 