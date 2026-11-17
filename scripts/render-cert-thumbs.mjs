import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) {
  throw new Error('Could not find Chrome/Chromium binary.');
}

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const PDFJS_DIR = path.resolve(process.cwd(), 'node_modules/pdfjs-dist');
const THUMBS_DIR = path.join(PUBLIC_DIR, 'certificates', 'thumbs');

const PDF_CERTS = [
  { pdf: 'AWS Gen AI.pdf', thumb: 'aws-gen-ai.webp' },
  { pdf: 'AWS Training Certificate.pdf', thumb: 'aws-training-certificate.webp' },
];

fs.mkdirSync(THUMBS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/render.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
      <html><body>
        <canvas id="c"></canvas>
        <script type="module">
          import * as pdfjsLib from '/pdfjs/build/pdf.mjs';
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';
          window.renderPdfThumb = async (pdfUrl) => {
            const pdf = await pdfjsLib.getDocument({
              url: pdfUrl,
              cMapUrl: '/pdfjs/cmaps/',
              cMapPacked: true,
              standardFontDataUrl: '/pdfjs/standard_fonts/',
            }).promise;
            const page = await pdf.getPage(1);
            const vp0 = page.getViewport({ scale: 1 });
            const scale = Math.max(2.0, Math.min(3.2, 2200 / Math.max(1, vp0.width)));
            const vp = page.getViewport({ scale });
            const canvas = document.getElementById('c');
            canvas.width = Math.round(vp.width);
            canvas.height = Math.round(vp.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            return canvas.toDataURL('image/png');
          };
          window.__PDFJS_READY__ = true;
        </script>
      </body></html>`);
    return;
  }

  let filePath = null;
  if (urlPath.startsWith('/pdfjs/')) {
    filePath = path.join(PDFJS_DIR, urlPath.slice('/pdfjs/'.length));
  } else {
    filePath = path.join(PUBLIC_DIR, urlPath.replace(/^\/+/, ''));
  }

  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--disable-gpu-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/render.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => Boolean(window.__PDFJS_READY__));

  for (const item of PDF_CERTS) {
    const srcPath = path.join(PUBLIC_DIR, item.pdf);
    if (!fs.existsSync(srcPath)) {
      console.warn(`Skipping missing PDF: ${srcPath}`);
      continue;
    }
    const dataUrl = await page.evaluate(
      (u) => window.renderPdfThumb(u),
      `${baseUrl}/${encodeURIComponent(item.pdf)}`
    );
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const outPath = path.join(THUMBS_DIR, item.thumb);
    // Trim blank PDF margins around certificate content, add clean hairline padding, boost contrast, resize at high quality
    await sharp(Buffer.from(base64, 'base64'))
      .trim({ background: '#ffffff', threshold: 10 })
      .extend({ top: 18, bottom: 18, left: 18, right: 18, background: '#f8fafc' })
      .linear(1.08, -14)
      .sharpen({ sigma: 0.7 })
      .resize({ width: 1400, kernel: sharp.kernel.lanczos3, withoutEnlargement: true })
      .webp({ quality: 92 })
      .toFile(outPath);
    console.log(`Rendered high-res trimmed PDF thumb: ${outPath}`);
  }
} finally {
  await browser.close();
  server.close();
}
