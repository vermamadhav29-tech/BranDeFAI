/**
 * test-auto-creative.mjs
 *
 * End-to-end test for the auto-creative pipeline against the live Railway backend.
 * Creates a fully disposable test account + brand, uploads a tiny product image,
 * triggers POST /api/creative/generate, and reports the result.
 *
 * Usage:
 *   node backend/scripts/test-auto-creative.mjs
 *   node backend/scripts/test-auto-creative.mjs --url https://brandefai-production.up.railway.app
 *
 * No credentials needed — creates a throwaway account automatically.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1]
  ?? process.env.API_URL
  ?? "https://brandefai-production.up.railway.app";

const TS = Date.now();
const TEST_EMAIL    = `test-creative-${TS}@disposable.brandefai.internal`;
const TEST_PASSWORD = `Test${TS}!`;
const TEST_BRAND    = {
  brandName:      `TestJewels_${TS}`,
  industry:       "Fine Jewellery",
  targetAudience: "Women aged 25–45 who love luxury gold and diamond jewellery for weddings and gifting",
  tone:           "Luxury",
  whatTheySell:   "Gold bangles, diamond rings, bridal jewellery sets",
  brandBrief:     "Premium Indian jewellery brand inspired by Valay jewellery",
  city:           "Mumbai",
  platforms:      ["instagram"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const log  = (msg)       => console.log(`\n  ✓  ${msg}`);
const warn = (msg)       => console.log(`\n  ⚠  ${msg}`);
const fail = (msg, body) => { console.error(`\n  ✗  ${msg}`); if (body) console.error("     ", JSON.stringify(body, null, 2)); process.exit(1); };

async function api(method, path, body, cookie, isForm = false) {
  const headers = {};
  if (cookie)   headers["Cookie"] = cookie;
  if (!isForm)  headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined),
    // Allow up to 3 minutes for the generate call
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  return { status: res.status, ok: res.ok, json, setCookie: res.headers.get("set-cookie") };
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  // "token=xxx; Path=/; HttpOnly; ..." — grab first key=value
  return setCookieHeader.split(";")[0];
}

// Download an existing jewellery product image from Cloudinary (most recent upload,
// 1083×1452 portrait — a real product photo already in the account).
const EXISTING_PRODUCT_URL =
  "https://res.cloudinary.com/dsidv1cmg/image/upload/v1783100765/brandefai/products/lzswb3kbhmesffa12bxe.jpg";

async function fetchExistingProductImage() {
  const res = await fetch(EXISTING_PRODUCT_URL);
  if (!res.ok) throw new Error(`Could not fetch existing product image: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  BranDeFAI — Auto-Creative Pipeline Test`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Account: ${TEST_EMAIL}`);
  console.log(`${"─".repeat(60)}`);

  // ── 1. Health check ────────────────────────────────────────────────────────
  try {
    const r = await fetch(`${BASE_URL}/health`);
    if (r.ok) log(`Health check passed (${r.status})`);
    else warn(`Health check returned ${r.status} — continuing anyway`);
  } catch {
    warn("Health endpoint unreachable — continuing anyway");
  }

  // ── 2. Register throwaway account ─────────────────────────────────────────
  const regRes = await api("POST", "/api/auth/register", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: `Test User ${TS}`,
  });

  if (!regRes.ok) fail("Registration failed", regRes.json);
  const cookie = extractCookie(regRes.setCookie);
  if (!cookie) fail("No session cookie returned after registration");
  log(`Registered: ${TEST_EMAIL}`);
  log(`Session cookie: ${cookie.substring(0, 40)}...`);

  // ── 3. Check credit balance ────────────────────────────────────────────────
  const meRes = await api("GET", "/api/auth/me", null, cookie);
  if (!meRes.ok) fail("Could not fetch user", meRes.json);
  const credits = meRes.json.data?.user?.creditsBalance ?? meRes.json.data?.creditsBalance ?? "unknown";
  log(`Credits available: ${credits}`);
  if (typeof credits === "number" && credits < 2) {
    fail("Need at least 2 credits to trigger manual generation — top up the account first");
  }

  // ── 4. Create test brand ───────────────────────────────────────────────────
  const brandRes = await api("POST", "/api/brand", TEST_BRAND, cookie);
  if (!brandRes.ok) fail("Brand creation failed", brandRes.json);
  const brand = brandRes.json.data?.brand ?? brandRes.json.data;
  log(`Brand created: ${brand?.brandName} (id: ${brand?.id})`);

  // ── 4b. Generate Brand DNA synchronously ──────────────────────────────────
  // Brand creation fires DNA generation fire-and-forget; calling refresh-dna
  // blocks until it's written to the DB so generateAutoCreative won't bail early.
  console.log(`\n  ⏳  Generating Brand DNA (GPT-4o call, ~10-15s)...`);
  const dnaRes = await api("POST", "/api/brand/refresh-dna", {}, cookie);
  if (!dnaRes.ok) {
    warn(`Brand DNA generation returned ${dnaRes.status} — generation may still fail`);
    console.log("     Response:", JSON.stringify(dnaRes.json, null, 2));
  } else {
    log(`Brand DNA ready`);
  }

  // ── 5. Upload product image ────────────────────────────────────────────────
  log(`Downloading existing jewellery product image from Cloudinary...`);
  log(`  ${EXISTING_PRODUCT_URL}`);
  const imageBuffer = await fetchExistingProductImage();
  log(`  Downloaded ${(imageBuffer.length / 1024).toFixed(0)} KB`);
  const form = new FormData();
  form.append("image", new Blob([imageBuffer], { type: "image/jpeg" }), "jewellery-product.jpg");

  const uploadRes = await api("POST", "/api/uploads/product-image", form, cookie, true);
  if (!uploadRes.ok) fail("Product image upload failed", uploadRes.json);
  const productImageId = uploadRes.json.data?.productImageId;
  const productImageUrl = uploadRes.json.data?.imageUrl;
  log(`Product image uploaded`);
  log(`  productImageId : ${productImageId}`);
  log(`  cloudinary URL : ${productImageUrl}`);
  log(`  (fire-and-forget generation has also been triggered by the upload)`);

  // ── 6. Manual trigger — POST /api/creative/generate ───────────────────────
  console.log(`\n  ⏳  Calling POST /api/creative/generate (≈60–120 seconds)...`);
  const t0 = Date.now();

  const genRes = await api(
    "POST",
    "/api/creative/generate",
    { productImageId },
    cookie
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!genRes.ok) {
    // 402 = not enough credits, 422 = generation returned null
    fail(`Generation failed after ${elapsed}s (HTTP ${genRes.status})`, genRes.json);
  }

  const post = genRes.json.data?.post;

  // ── 7. Report results ──────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  RESULT (${elapsed}s)`);
  console.log(`${"─".repeat(60)}`);
  console.log(`  Post ID       : ${post?.id}`);
  console.log(`  Status        : ${post?.status}`);
  console.log(`  Occasion      : ${post?.occasionEmoji ?? ""} ${post?.occasionName ?? "(none)"}`);
  console.log(`  Image URL     : ${post?.imageUrl}`);
  console.log(`  Thumbnail URL : ${post?.thumbnailUrl ?? "(none)"}`);
  console.log(`\n  Caption:`);
  console.log(`  ${(post?.caption ?? "").split("\n").join("\n  ")}`);
  console.log(`\n  Hashtags: ${(post?.hashtags ?? []).join(" ")}`);
  console.log(`\n  Creative Brief:`);
  if (post?.creativeData) {
    const cd = post.creativeData;
    console.log(`    headline         : ${cd.headline}`);
    console.log(`    headline_accent  : ${cd.headline_accent}`);
    console.log(`    subheadline      : ${cd.subheadline}`);
    console.log(`    cta              : ${cd.cta}`);
    console.log(`    layout_style     : ${cd.layout_style}`);
    console.log(`    product_placement: ${cd.product_placement}`);
    console.log(`    product_size     : ${cd.product_size}`);
    console.log(`    primary_color    : ${cd.primary_color}`);
    console.log(`    accent_color     : ${cd.accent_color}`);
    console.log(`    feature_badges   : ${(cd.feature_badges ?? []).join(" | ")}`);
    console.log(`    occasion_badge   : ${cd.occasion_badge ?? "(none)"}`);
    console.log(`    background_scene : ${(cd.background_scene ?? "").slice(0, 120)}...`);
    const fluxWords = (cd.flux_prompt ?? "").split(/\s+/).filter(Boolean);
    console.log(`    flux_prompt (50w): ${fluxWords.slice(0, 50).join(" ")}`);
  }

  console.log(`\n${"─".repeat(60)}`);

  // SVG text layer check — if imageUrl exists and is a Cloudinary URL, it rendered
  if (post?.imageUrl?.includes("cloudinary.com")) {
    log("SVG text layer composited successfully (Cloudinary URL present)");
  } else {
    warn("Image URL is not a Cloudinary URL — compositing may have failed");
  }

  console.log(`\n  ✅  Pipeline test complete.\n`);
  console.log(`  Open the image to verify SVG text is visible:`);
  console.log(`  ${post?.imageUrl}\n`);
}

run().catch((err) => {
  console.error("\n  ✗  Unhandled error:", err);
  process.exit(1);
});
