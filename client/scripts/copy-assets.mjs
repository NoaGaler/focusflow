// Copies the WebAssembly files of MediaPipe from node_modules
// into public/, so the site serves them itself (nothing is downloaded from a CDN).
import { cpSync, mkdirSync, readdirSync } from "node:fs";

const copies = [
  ["node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", () => true],
];

for (const [from, to, keep] of copies) {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from).filter(keep)) cpSync(`${from}/${f}`, `${to}/${f}`);
  console.log(`copied ${from} -> ${to}`);
}
