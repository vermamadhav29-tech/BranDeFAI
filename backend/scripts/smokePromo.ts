// Smoke test: renders two promo posts with synthetic assets (no network).
// Run: npx ts-node --transpile-only scripts/smokePromo.ts <outDir>
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { buildPromoPost } from "../src/studio-test/studioTestPromo";
import { pickBackground, fetchBackground } from "../src/studio-test/backgroundLibrary";
import { tryAutoKeyFlatBackground, opacityRatio } from "../src/studio-test/studioTestAssets";

const OUT = process.argv[2] ?? __dirname;

async function fakeCutout(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3d9a4"/><stop offset="1" stop-color="#b07a2b"/></linearGradient></defs>
    <rect x="190" y="20" width="40" height="420" rx="20" fill="url(#g)"/>
    <ellipse cx="210" cy="600" rx="150" ry="230" fill="url(#g)"/>
    <ellipse cx="210" cy="620" rx="80" ry="120" fill="#8b1a2b"/>
    <ellipse cx="180" cy="560" rx="22" ry="40" fill="rgba(255,255,255,0.55)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function fakeLogo(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <circle cx="150" cy="150" r="120" fill="none" stroke="#222" stroke-width="14"/>
    <path d="M70 200 L150 70 L230 200 Z" fill="none" stroke="#222" stroke-width="14"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Simulates a real-world "lockup" logo: flat white background (uniform corners,
// so it should auto-key), a black mark, and text-like bars (baked-in brand name) —
// this should suppress the separate name/tagline draw once auto-keyed.
async function fakeLockupLogo(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200">
    <rect width="420" height="200" fill="#ffffff"/>
    <rect x="160" y="30" width="100" height="60" fill="#111111"/>
    <rect x="90" y="120" width="240" height="14" fill="#333333"/>
    <rect x="130" y="145" width="160" height="10" fill="#666666"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer(); // JPEG: no alpha at all, forces the opaque path
}

// Simulates the AMEECO failure case: a NEAR-SQUARE rounded-corner colour-card
// logo with baked-in text. Aspect ratio alone (~1.3) would NOT flag this as a
// lockup, and the rounded transparent corners can push transparentRatio over
// the old 0.12 threshold, making the pixel heuristic think it's "already fine".
// A logoHint from GPT (hasBakedInText, backgroundStyle) is the only reliable fix.
async function fakeRoundedCardLogo(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="220">
    <rect x="0" y="0" width="280" height="220" rx="28" fill="#E27E9A"/>
    <text x="140" y="120" font-family="sans-serif" font-size="34" font-style="italic"
          fill="#3a1420" text-anchor="middle">ameeco</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer(); // PNG: rounded corners are genuinely transparent
}

// Simulates a tightly-framed studio product photo: the whole frame is the
// cream backdrop plus the product, with nothing extra around it for BiRefNet
// to key out — the "opacity ratio near 100%" case from the AMEECO test.
async function fakeTightStudioPhoto(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
    <rect width="900" height="900" fill="#F0E6D8"/>
    <circle cx="450" cy="470" r="220" fill="#8a5a2b"/>
    <circle cx="380" cy="410" r="30" fill="#3d2410"/>
    <circle cx="520" cy="520" r="25" fill="#3d2410"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

async function fakeBackground(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <defs><radialGradient id="r" cx="0.7" cy="0.45" r="0.8">
      <stop offset="0" stop-color="#1f3a8a"/><stop offset="0.6" stop-color="#0b1a44"/><stop offset="1" stop-color="#04091c"/></radialGradient></defs>
    <rect width="1080" height="1080" fill="url(#r)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function fakeProductPhoto(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
    <rect width="1000" height="1000" fill="#d8cfc4"/><circle cx="500" cy="500" r="300" fill="#b07a2b"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

(async () => {
  const log = (m: string) => console.log(m);
  const [cutout, logo, bg, photo] = await Promise.all([fakeCutout(), fakeLogo(), fakeBackground(), fakeProductPhoto()]);

  const base = {
    productBuffer: photo, cutoutBuffer: cutout, logoBuffer: logo,
    brandName: "Valay", brandTagline: "Har rishta, ek naya ehsaas.",
    headline: "Do Dil.", accentLine: "Ek Vaada.",
    subheadline: "Two hearts. One promise. Forever yours.",
    cta: "Shop Now",
    trustBullets: ["Real Diamonds Certified", "18KT Gold Hallmarked", "Luxury Gifting Ready"],
    trustIcons: ["gem", "circle-dot", "gift"],
    primaryColor: "#00331a", accentColor: "#7aa2ff",
    log,
  } as const;

  const a = await buildPromoPost({ ...base, backgroundBuffer: bg, backgroundTone: "dark",
    layoutId: "text_left_product_right", fontPairingId: "luxury_serif" });
  fs.writeFileSync(path.join(OUT, "smoke_library_left.jpg"), a);

  const b = await buildPromoPost({ ...base, backgroundTone: "dark",
    layoutId: "text_top_product_bottom", fontPairingId: "editorial_bold",
    headline: "Made For Yes.", accentLine: "", trustIcons: ["diamond", "award", "gift"] });
  fs.writeFileSync(path.join(OUT, "smoke_fallback_top.jpg"), b);

  // Real library backdrop, if the manifest has one
  const item = pickBackground("jewellery", process.env.SMOKE_MOOD ?? "royal");
  if (item) {
    const real = await fetchBackground(item);
    const c = await buildPromoPost({ ...base, backgroundBuffer: real, backgroundTone: item.tone,
      layoutId: "text_right_product_left", fontPairingId: "refined_serif" });
    fs.writeFileSync(path.join(OUT, `smoke_real_${item.id}.jpg`), c);
    console.log("real backdrop:", item.id, item.tone);
  }

  // Opaque "lockup" logo — should auto-key its flat white background off,
  // and suppress the separate brand-name text since the mark carries a name already.
  const lockup = await fakeLockupLogo();
  const d = await buildPromoPost({ ...base, logoBuffer: lockup, backgroundBuffer: bg, backgroundTone: "dark",
    layoutId: "text_left_product_right", fontPairingId: "modern_geometric" });
  fs.writeFileSync(path.join(OUT, "smoke_lockup_logo.jpg"), d);

  // ── Regression checks for the AMEECO failure ────────────────────────────────

  // 1. Rounded-card logo WITHOUT a hint (old pixel-only path) — documents the
  //    failure mode: aspect ~1.27 and rounded-corner transparency can both fool
  //    the pixel heuristic into leaving the pink card + baked-in text untouched.
  const roundedCard = await fakeRoundedCardLogo();
  const e1 = await buildPromoPost({ ...base, logoBuffer: roundedCard, backgroundBuffer: bg, backgroundTone: "dark",
    layoutId: "centered_hero", fontPairingId: "friendly_rounded" });
  fs.writeFileSync(path.join(OUT, "smoke_roundedcard_NO_HINT.jpg"), e1);

  // 2. Same logo, WITH the GPT hint a real run would get — background should be
  //    keyed transparent and the separate name/tagline should be suppressed.
  const e2 = await buildPromoPost({ ...base, logoBuffer: roundedCard,
    logoHint: { hasBakedInText: true, backgroundStyle: "flat_color" },
    backgroundBuffer: bg, backgroundTone: "dark",
    layoutId: "centered_hero", fontPairingId: "friendly_rounded" });
  fs.writeFileSync(path.join(OUT, "smoke_roundedcard_WITH_HINT.jpg"), e2);

  // 3. Tight studio product photo (whole frame is backdrop + product, nothing
  //    for BiRefNet to remove) — verify tryAutoKeyFlatBackground alone isolates
  //    the product. This is the controller's fallback path, tested directly
  //    since this script has no BiRefNet/network access.
  const tightPhoto = await fakeTightStudioPhoto();
  const beforeOpacity = await opacityRatio(await sharp(tightPhoto).ensureAlpha().png().toBuffer());
  const keyed = await tryAutoKeyFlatBackground(await sharp(tightPhoto).ensureAlpha().png().toBuffer());
  console.log(`tight-studio-photo: opacity before=${(beforeOpacity * 100).toFixed(1)}% keyed=${keyed ? "yes" : "no (rejected)"}`);
  if (keyed) {
    const afterOpacity = await opacityRatio(keyed);
    console.log(`  opacity after key=${(afterOpacity * 100).toFixed(1)}% (should be well under 100%)`);
    fs.writeFileSync(path.join(OUT, "smoke_corner_keyed_product.png"), keyed);
  }

  console.log("written to", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
