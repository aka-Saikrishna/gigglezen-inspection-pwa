const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// CORS headers for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Root route - serve app.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Trinetra Inspection API'
  });
});

// PDF Generation API
app.post('/api/generate-pdf', async (req, res) => {
  console.log('📄 PDF generation request received');
  
  try {
    const canonicalReportData = req.body;
    
    // Validate canonical JSON structure
    if (!canonicalReportData || !canonicalReportData.rooms) {
      return res.status(400).json({ 
        error: 'Invalid report data',
        message: 'Report data is missing required fields'
      });
    }

    // Create pdfs directory only for local environment
    let pdfsDir = null;
    if (!process.env.VERCEL) {
      pdfsDir = path.join(__dirname, 'pdfs');
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
        console.log('📁 Created pdfs directory');
      }
    } else {
      // Use temp directory for Vercel
      pdfsDir = '/tmp';
    }

    // Save canonical JSON to file for Playwright (use temp location on Vercel)
    const jsonPath = process.env.VERCEL 
      ? '/tmp/report-data.json'
      : path.join(__dirname, 'report-data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(canonicalReportData, null, 2));
    console.log('💾 Saved canonical JSON to report-data.json');

    // Launch Playwright browser
    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    // Inject canonical JSON into page
    await page.addInitScript(data => {
      window.__REPORT_DATA__ = data;
    }, canonicalReportData);

    // Load report page
    const reportPath = `file://${path.join(__dirname, 'report-generator.html')}`;
    console.log('📖 Loading report template...');
    
    try {
      await page.goto(reportPath, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
    } catch (gotoError) {
      console.warn('⚠️ Navigation warning (non-critical):', gotoError.message);
    }

    // Wait for charts to render
    await page.waitForTimeout(2000);

    // Generate PDF filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const clientNameSafe = (canonicalReportData.clientName || 'report')
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();
    const filename = `inspection-${clientNameSafe}-${timestamp}.pdf`;
    const pdfPath = path.join(pdfsDir, filename);

    // Generate PDF
    console.log('📄 Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: true
    });

    await browser.close();
    console.log('✅ PDF generated successfully:', filename);

    // Clean up JSON file
    try {
      if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
        console.log('🗑️ Cleaned up temporary JSON file');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }

    // Save to disk for local environment, send directly for Vercel
    if (process.env.VERCEL) {
      // For Vercel: send PDF directly as buffer
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      console.log('📤 PDF sent to client (Vercel)');
    } else {
      // For local: save to disk then send
      fs.writeFileSync(pdfPath, pdfBuffer);
      res.download(pdfPath, filename, (err) => {
        if (err) {
          console.error('❌ Download error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download PDF' });
          }
        } else {
          console.log('📤 PDF sent to client (Local)');
        }
      });
    }

  } catch (error) {
    console.error('❌ PDF Generation Error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate PDF',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// List all generated PDFs
app.get('/api/pdfs', (req, res) => {
  const pdfsDir = path.join(__dirname, 'pdfs');
  
  if (!fs.existsSync(pdfsDir)) {
    return res.json({ pdfs: [] });
  }

  const files = fs.readdirSync(pdfsDir)
    .filter(file => file.endsWith('.pdf'))
    .map(file => ({
      name: file,
      path: `/pdfs/${file}`,
      size: fs.statSync(path.join(pdfsDir, file)).size,
      created: fs.statSync(path.join(pdfsDir, file)).mtime
    }))
    .sort((a, b) => b.created - a.created);

  res.json({ pdfs: files });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message
  });
});

// Export for Vercel
module.exports = app;

// Start server locally if not running on Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log('\n===========================================');
    console.log('🚀 Trinetra Inspection Server Started');
    console.log('===========================================');
    console.log(`📱 PWA App:     http://localhost:${PORT}`);
    console.log(`🔌 API Health:  http://localhost:${PORT}/api/health`);
    console.log(`📄 PDF API:     http://localhost:${PORT}/api/generate-pdf`);
    console.log(`📁 PDFs List:   http://localhost:${PORT}/api/pdfs`);
    console.log('===========================================\n');
  });
}