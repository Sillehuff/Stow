import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icons/icon-512.svg");

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(svg, { density: 300 }).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");

// Maskable: icon at ~80% on a full-bleed brand background so circular masks don't clip it.
const inner = await sharp(svg, { density: 300 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#1A1A2E" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");

console.log("Icons generated.");
