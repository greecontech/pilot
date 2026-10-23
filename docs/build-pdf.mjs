// Builds a PDF from a documentation folder that contains guide.html.
//
//   node docs/build-pdf.mjs docs/pilot-setup-guide        ->  docs/pilot-setup-guide.pdf
//   node docs/build-pdf.mjs docs/station-build-tutorial   ->  docs/station-build-tutorial.pdf
//
// Setup (once, from any folder; do not add it to the platform's dependencies):
//   npm install --no-save playwright
// Needs Chromium (set CHROMIUM_PATH, or run `npx playwright install chromium`) and poppler-utils (pdfinfo, pdftotext).
//
// Two passes: the first finds the page of each heading, the second prints with those page numbers in the contents.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const folder = path.resolve(process.argv[2] ?? "docs/pilot-setup-guide");
const out = folder + ".pdf";
const scratch = mkdtempSync(path.join(tmpdir(), "pdf-"));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });

async function render(file, target) {
  const page = await browser.newPage();
  await page.goto("file://" + file);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: target, preferCSSPageSize: true, printBackground: true });
  await page.close();
}

const pass1 = path.join(scratch, "pass1.pdf");
await render(path.join(folder, "guide.html"), pass1);
const count = Number(execFileSync("pdfinfo", [pass1]).toString().match(/Pages:\s+(\d+)/)[1]);
const pages = Array.from({ length: count }, (_, i) =>
  execFileSync("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), "-layout", pass1, "-"]).toString());

const html = readFileSync(path.join(folder, "guide.html"), "utf8").replace(
  /<span class="p" data-find="([^"]+)"><\/span>/g,
  (_, text) => {
    const from = /^1 ·/.test(text) ? 1 : 2; // the contents page lists every title too, so look past it
    const index = pages.findIndex((p, i) => i >= from && p.includes(text));
    return `<span class="p">${index >= 0 ? "p. " + (index + 1) : ""}</span>`;
  });
const tmp = path.join(folder, ".render.html");
writeFileSync(tmp, html);
await render(tmp, out);
unlinkSync(tmp);
await browser.close();
console.log(`wrote ${out} (${count} pages)`);
