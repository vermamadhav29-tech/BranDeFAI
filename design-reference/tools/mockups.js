// Swaps the template's screenshots for the BrandefAI SVG mockups in src/components/draftr/mockups.tsx.
const fs = require("fs");
const path = require("path");
const D = path.resolve(__dirname, "../../frontend/src/components/draftr/home") + "/";

const MAP = [
  ["Hero.tsx", "403dd18e23.png", "CalendarMock"],
  ["Hero.tsx", "d2ae29ec3a.png", "PhoneMock"],
  ["Steps.tsx", "6282a4e505.png", "GenerateMock"],
  ["AppSection.tsx", "bf62b8d1e0.png", "QueueMock"],
  ["AppSection.tsx", "58023fc6ce.png", "ReelCard"],
  ["Cta.tsx", "605d4d46e1.png", "CalendarMock"],
];

const used = {};
for (const [file, hash, comp] of MAP) {
  const p = D + file;
  let s = fs.readFileSync(p, "utf8");
  const re = new RegExp(`<img [^>]*src="/draftr/img/${hash.replace(".", "\\.")}"[^>]*/>`, "g");
  let n = 0;
  s = s.replace(re, () => (n++, `<${comp} />`));
  if (!n && !s.includes(`<${comp} />`)) console.log("not found:", file, hash);
  (used[file] ||= new Set()).add(comp);
  fs.writeFileSync(p, s);
}
for (const [file, comps] of Object.entries(used)) {
  const p = D + file;
  let s = fs.readFileSync(p, "utf8");
  const present = [...comps].filter((c) => s.includes(`<${c} />`));
  s = s.replace(/import \{[^}]*\} from "\.\.\/mockups";\n/, "");
  if (present.length) s = s.replace('import type { CSSProperties } from "react";', `import type { CSSProperties } from "react";\nimport { ${present.join(", ")} } from "../mockups";`);
  fs.writeFileSync(p, s);
  console.log(file, "->", present.join(", "));
}
