// Rebuilds ../pilot-setup-guide.pdf from guide.html.
//
//   npm install --no-save playwright     (once, from any folder; do not add it to the platform's dependencies)
//   node docs/pilot-setup-guide/build.mjs
//
// Needs Chromium: set CHROMIUM_PATH to an installed browser, or run `npx playwright install chromium`.
// Two passes: the first finds the page of each heading, the second prints with those page numbers in the contents.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, "..", "pilot-setup-guide.pdf");
const scratch = mkdtempSync(path.join(tmpdir(), "guide-"));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });

async function render(file, target) {
  const page = await browser.newPage();
  await page.goto("file://" + file);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: target, preferCSSPageSize: true, printBackground: true });
  await page.close();
}

const pass1 = path.join(scratch, "pass1.pdf");
await render(path.join(dir, "guide.html"), pass1);
const count = Number(execFileSync("pdfinfo", [pass1]).toString().match(/Pages:\s+(\d+)/)[1]); // poppler-utils
const pages = Array.from({ length: count }, (_, i) =>
  execFileSync("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), "-layout", pass1, "-"]).toString());

const html = readFileSync(path.join(dir, "guide.html"), "utf8").replace(
  /<span class="p" data-find="([^"]+)"><\/span>/g,
  (_, text) => {
    const from = text.startsWith("1 ·") ? 1 : 2; // the contents page itself lists the titles
    const index = pages.findIndex((p, i) => i >= from && p.includes(text));
    return `<span class="p">${index >= 0 ? "p. " + (index + 1) : ""}</span>`;
  });
const tmp = path.join(dir, ".render.html");
writeFileSync(tmp, html);
await render(tmp, out);
unlinkSync(tmp);
await browser.close();
console.log(`wrote ${out} (${count} pages)`);
