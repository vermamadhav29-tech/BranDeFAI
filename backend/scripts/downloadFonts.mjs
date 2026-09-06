// One-time: download OFL-licensed static TTF fonts into backend/assets/fonts.
// Uses google-webfonts-helper, which resolves each variant to a static TTF on fonts.gstatic.com.
// Run: node scripts/downloadFonts.mjs
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT  = join(here, "..", "assets", "fonts");
mkdirSync(OUT, { recursive: true });

const API = "https://gwfh.mranftl.com/api/fonts";

// family id → { outputBaseName, variants: { gwfhVariantId: fileSuffix } }
const FAMILIES = {
  "playfair-display":   { base: "PlayfairDisplay",   variants: { regular: "Regular", "700": "Bold", italic: "Italic", "700italic": "BoldItalic" } },
  "cormorant-garamond": { base: "CormorantGaramond", variants: { regular: "Regular", "700": "Bold", italic: "Italic", "600": "SemiBold" } },
  "dm-serif-display":   { base: "DMSerifDisplay",    variants: { regular: "Regular", italic: "Italic" } },
  "lora":               { base: "Lora",              variants: { regular: "Regular", "700": "Bold", italic: "Italic" } },
  "inter":              { base: "Inter",             variants: { regular: "Regular", "600": "SemiBold", "700": "Bold" } },
  "montserrat":         { base: "Montserrat",        variants: { regular: "Regular", "600": "SemiBold", "700": "Bold" } },
  "poppins":            { base: "Poppins",           variants: { regular: "Regular", "600": "SemiBold", "700": "Bold" } },
  "nunito":             { base: "Nunito",            variants: { regular: "Regular", "700": "Bold" } },
};

let ok = 0, fail = 0;

for (const [id, { base, variants }] of Object.entries(FAMILIES)) {
  let meta;
  try {
    const res = await fetch(`${API}/${id}?subsets=latin,latin-ext`);
    if (!res.ok) { console.log(`FAIL   ${id}: API ${res.status}`); fail += Object.keys(variants).length; continue; }
    meta = await res.json();
  } catch (e) {
    console.log(`FAIL   ${id}: ${e.message}`); fail += Object.keys(variants).length; continue;
  }

  for (const [variantId, suffix] of Object.entries(variants)) {
    const name = `${base}-${suffix}.ttf`;
    const dest = join(OUT, name);
    if (existsSync(dest)) { console.log(`skip   ${name}`); ok++; continue; }

    const v = meta.variants?.find((x) => x.id === variantId);
    if (!v?.ttf) { console.log(`FAIL   ${name}: variant '${variantId}' not offered`); fail++; continue; }

    try {
      const r = await fetch(v.ttf);
      if (!r.ok) { console.log(`FAIL   ${name}: ${r.status}`); fail++; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 10_000) { console.log(`FAIL   ${name}: too small`); fail++; continue; }
      writeFileSync(dest, buf);
      console.log(`ok     ${name}  ${(buf.length / 1024).toFixed(0)} KB`);
      ok++;
    } catch (e) { console.log(`FAIL   ${name}: ${e.message}`); fail++; }
  }
}

console.log(`\n${ok} ok, ${fail} failed`);
