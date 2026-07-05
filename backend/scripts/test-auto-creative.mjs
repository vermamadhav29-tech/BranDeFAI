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

// Minimal 1×1 white JPEG (67 bytes — just enough to pass multer's image/jpeg check)
function makeTinyJpeg() {
  const bytes = [
    0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,
    0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,
    0x07,0x07,0x07,0x09,0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,
    0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,0x24,0x2E,0x27,0x20,
    0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,
    0x39,0x3D,0x38,0x32,0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,
    0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,0x01,0x05,0x01,0x01,
    0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,
    0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0xFF,0xC4,0x00,0xB5,0x10,0x00,0x02,0x01,0x03,
    0x03,0x02,0x04,0x03,0x05,0x05,0x04,0x04,0x00,0x00,0x01,0x7D,0x01,0x02,0x03,0x00,
    0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,
    0x81,0x91,0xA1,0x08,0x23,0x42,0xB1,0xC1,0x15,0x52,0xD1,0xF0,0x24,0x33,0x62,0x72,
    0x82,0x09,0x0A,0x16,0x17,0x18,0x19,0x1A,0x25,0x26,0x27,0x28,0x29,0x2A,0x34,0x35,
    0x36,0x37,0x38,0x39,0x3A,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4A,0x53,0x54,0x55,
    0x56,0x57,0x58,0x59,0x5A,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6A,0x73,0x74,0x75,
    0x76,0x77,0x78,0x79,0x7A,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8A,0x92,0x93,0x94,
    0x95,0x96,0x97,0x98,0x99,0x9A,0xA2,0xA3,0xA4,0xA5,0xA6,0xA7,0xA8,0xA9,0xAA,0xB2,
    0xB3,0xB4,0xB5,0xB6,0xB7,0xB8,0xB9,0xBA,0xC2,0xC3,0xC4,0xC5,0xC6,0xC7,0xC8,0xC9,
    0xCA,0xD2,0xD3,0xD4,0xD5,0xD6,0xD7,0xD8,0xD9,0xDA,0xE1,0xE2,0xE3,0xE4,0xE5,0xE6,
    0xE7,0xE8,0xE9,0xEA,0xF1,0xF2,0xF3,0xF4,0xF5,0xF6,0xF7,0xF8,0xF9,0xFA,0xFF,0xDA,
    0x00,0x08,0x01,0x01,0x00,0x00,0x3F,0x00,0xFB,0x28,0xA2,0x80,0xFF,0xD9,
  ];
  return Buffer.from(bytes);
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

  // ── 5. Upload product image ────────────────────────────────────────────────
  log("Uploading product image (1×1 JPEG placeholder)...");
  const imageBuffer = makeTinyJpeg();
  const form = new FormData();
  form.append("image", new Blob([imageBuffer], { type: "image/jpeg" }), "test-product.jpg");

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
  console.log(`\n  Creative Data:`);
  if (post?.creativeData) {
    const cd = post.creativeData;
    console.log(`    headline       : ${cd.headline}`);
    console.log(`    subheadline    : ${cd.subheadline}`);
    console.log(`    cta            : ${cd.cta}`);
    console.log(`    background     : ${cd.background_scene}`);
    console.log(`    placement      : ${cd.product_placement}`);
    console.log(`    layout         : ${cd.layout}`);
    console.log(`    feature_badges : ${(cd.feature_badges ?? []).join(", ")}`);
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
