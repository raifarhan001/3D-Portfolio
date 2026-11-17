import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function main() {
  const rootDir = process.cwd();
  const pdfPath = path.join(rootDir, 'public', 'Rai_Farhan_CV.pdf');
  const outPath = path.join(rootDir, 'src', 'data', 'cvExtract.json');

  const pdfjsPath = path.join(rootDir, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  const pdfjs = await import(pathToFileURL(pdfjsPath).href);

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines = [];
    let currentLine = [];
    let lastY = null;

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.length > 0) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
        currentLine = [];
      }
      currentLine.push(item.str.trim());
      lastY = y;
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
    }
    pages.push({ page: i, text: lines.join('\n') });
  }

  const fullText = pages.map((p) => p.text).join('\n\n');
  const payload = {
    source: '/Rai_Farhan_CV.pdf',
    extractedAt: new Date().toISOString(),
    pageCount: doc.numPages,
    fullText,
    pages,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Extracted ${doc.numPages} page(s), ${fullText.length} chars -> ${outPath}`);
}

main().catch((err) => {
  console.error('Failed to extract CV:', err);
  process.exit(1);
});
