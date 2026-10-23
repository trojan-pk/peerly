/** Rebuild the Open Page brand assets with: node scripts/build-brand.mjs */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { BRAND_VIOLET, BRAND_INK, OPEN_PAGE_PATHS, PEERLY_WORDMARK_PATHS } from "../src/lib/brand.ts";

const directory = new URL("../public/brand/", import.meta.url);
const appDirectory = new URL("../src/app/", import.meta.url);
await mkdir(directory, { recursive: true });
const paths = (items, fill) => `<g fill="${fill}" fill-rule="evenodd">${items.map(d => `<path d="${d}"/>`).join("")}</g>`;
const svg = (viewBox, content, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${content}</svg>`;
const mark = fill => paths(OPEN_PAGE_PATHS, fill);
const wordmark = fill => paths(PEERLY_WORDMARK_PATHS, fill);
const lockup = (symbolFill, textFill) => svg("0 0 140 40", `${mark(symbolFill)}<g transform="translate(45 6) scale(.14)">${wordmark(textFill)}</g>`, "Peerly — Open Page logo");

for (const [name, content] of [
  ["peerly-symbol.svg", svg("0 0 40 40", mark(BRAND_VIOLET), "Peerly Open Page symbol")],
  ["peerly-logo.svg", lockup(BRAND_VIOLET, BRAND_INK)],
  ["peerly-logo-white.svg", lockup("#ffffff", "#ffffff")],
  ["peerly-wordmark.svg", svg("0 0 672 220", wordmark(BRAND_INK), "Peerly wordmark")],
]) await writeFile(new URL(name, directory), content);

await sharp(Buffer.from(lockup(BRAND_VIOLET, BRAND_INK))).resize({ width:1680 }).png().toFile(new URL("peerly-logo.png", directory).pathname);
await sharp(Buffer.from(lockup("#ffffff", "#ffffff"))).resize({ width:1680 }).png().toFile(new URL("peerly-logo-white.png", directory).pathname);
await sharp(Buffer.from(svg("0 0 40 40", mark(BRAND_VIOLET), "Peerly symbol"))).resize(512,512).png().toFile(new URL("peerly-symbol.png", directory).pathname);

const icon = svg("0 0 64 64", `<rect width="64" height="64" rx="14" fill="${BRAND_VIOLET}"/><g transform="translate(8 7) scale(1.2)">${mark("#ffffff")}</g>`, "Peerly");
await writeFile(new URL("icon.svg", appDirectory), icon);
await sharp(Buffer.from(icon)).resize(180,180).flatten({ background:BRAND_VIOLET }).png().toFile(new URL("apple-icon.png", appDirectory).pathname);
// PNG-compressed ICO frames are supported by modern browsers and Windows.
const frames = await Promise.all([16,32,48].map(size => sharp(Buffer.from(icon)).resize(size,size).png().toBuffer()));
const header = Buffer.alloc(6 + frames.length * 16); header.writeUInt16LE(1,2); header.writeUInt16LE(frames.length,4);
let offset = header.length;
frames.forEach((frame,index) => { const entry=6+index*16; const size=[16,32,48][index]; header[entry]=size; header[entry+1]=size; header.writeUInt16LE(1,entry+4); header.writeUInt16LE(32,entry+6); header.writeUInt32LE(frame.length,entry+8); header.writeUInt32LE(offset,entry+12); offset+=frame.length; });
await writeFile(new URL("favicon.ico", appDirectory), Buffer.concat([header,...frames]));

const og = svg("0 0 1200 630", `
<rect width="1200" height="630" fill="#101425"/>
<rect x="0" y="0" width="1200" height="7" fill="${BRAND_VIOLET}"/>
<g transform="translate(70 59) scale(1.8)">${mark("#b9adff")}<g transform="translate(45 6) scale(.14)">${wordmark("#f5f3ff")}</g></g>
<text x="1126" y="98" text-anchor="end" fill="#b9c4df" font-family="DejaVu Sans,sans-serif" font-size="16" letter-spacing="2">UNIVERSITY PEER LEARNING</text>
<g font-family="DejaVu Sans,sans-serif" font-size="72" font-weight="600" letter-spacing="-2.5">
<text x="70" y="269" fill="#f5f3ff">Study help.</text>
<text x="70" y="355" fill="#f5f3ff">From peers who</text>
<text x="70" y="441" fill="#b9adff">get your topic.</text>
</g>
<g transform="translate(909 249) scale(4.7)">${mark("#6654f0")}</g>
<path d="M70 524H1130" stroke="#3a415c"/>
<text x="70" y="574" fill="#ccd4eb" font-family="DejaVu Sans,sans-serif" font-size="22">Find peers. Share resources. Learn together.</text>
<text x="1130" y="574" text-anchor="end" fill="#b9adff" font-family="DejaVu Sans,sans-serif" font-size="16">peerly</text>`, "Peerly — Study help from peers who get your topic");
await writeFile(new URL("peerly-og.svg", directory), og);
await sharp(Buffer.from(og)).resize(1200,630).png().toFile(new URL("opengraph-image.png", appDirectory).pathname);
await writeFile(new URL("opengraph-image.alt.txt", appDirectory), "Peerly Open Page logo. Study help from peers who get your topic. Find peers, share resources and learn together.\n");
await sharp(Buffer.from(og)).resize(1200,630).png().toFile(new URL("twitter-image.png", appDirectory).pathname);
await writeFile(new URL("twitter-image.alt.txt", appDirectory), "Peerly — study help from university peers, with the Open Page logo.\n");
console.log("Built SVG/PNG logos, SVG/ICO favicon, Apple icon and 1200×630 social images.");
