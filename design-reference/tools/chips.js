// Re-labels the floating "cursor tag" SVGs (originally collaborator names) with BrandefAI labels.
// Keeps each pill's size, colour and arrow; swaps the white outlined text path for real <text>.
const fs = require("fs");
const path = require("path");
const IMG = path.resolve(__dirname, "../../frontend/public/draftr/img") + "/";

// file: [label, centerX, centerY, fontSize]
const CHIPS = {
  c4f8ff286d: ["Auto-post", 66.1, 44.3, 17],
  "4175bce261": ["Brand voice", 77.5, 36.4, 17],
  "0938ff6b15": ["Posted", 35.9, 41.5, 15],
  "4abe1914e4": ["AI", 41.3, 34.0, 15],
  "364398e331": ["Reel ready", 34.5, 17.5, 10],
  "9e975a2d8f": ["Auto-post", 39.2, 18.5, 10],
};

for (const [file, [label, cx, cy, fs_]] of Object.entries(CHIPS)) {
  const p = IMG + file + ".svg";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("<text")) continue; // already re-labelled
  const n = s.replace(/<path fill="#fff" d="[^"]*"\s*\/>/, () => {
    return `<text x="${cx}" y="${(cy + fs_ * 0.35).toFixed(1)}" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="600" font-size="${fs_}" letter-spacing="-0.02em" fill="#fff">${label}</text>`;
  });
  if (n === s) {
    console.log("no white text path in", file);
    continue;
  }
  fs.writeFileSync(p, n);
  console.log("relabelled", file, "->", label);
}
