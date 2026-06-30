import "dotenv/config";
import { generateCaptionSet, pickBestCaption } from "../services/contentService";

// Synthetic Brand DNA block in the exact shape getBrandContext() produces,
// reused from the Ameeco Brand DNA test so this script needs no DB row.
const BRAND_DNA_BLOCK = `BRAND DNA:
Business: Ameeco | Sells: handmade gelato and cookies
Personality: playful, authentic, welcoming
Voice: Ameeco speaks like your enthusiastic friend sharing a delightful treat.
Speaks like: Indulge in the joy of handmade goodness! | Experience every bite like your first!
Never says: Corporate-approved desserts here only. | Mass-produced for all.  Visual mood: Bright pastel colors with cheerful, candid photography
Target customer: Riya Sharma, 28 — Urban professional with a zest for unique experiences
Emotional hooks: joy, nostalgia, comfort
Content pillars: Behind-the-scenes creation moments, Customer stories and experiences, Flavor of the week highlights, Fun food pairing suggestions
Tone DOs: Use humorous and playful language | Be personable and conversational | Incorporate cultural references in a charming way
Tone DON'Ts: Avoid formal business jargon | Refrain from bland or generic descriptors | Don't ignore customer interaction and engagement
Hinglish style: Casually blend Hindi phrases with English, like 'Ek aur scoop toh banta hai!'
Sample caption: Life's too short for boring desserts! 🍨 Dive into the magic of our handmade gelato—it's happiness in every scoop! #AmeecoJoy

TODAY'S BRIEF: New monsoon-special mango gelato flavor just launched`;

async function main() {
  const result = await generateCaptionSet(
    BRAND_DNA_BLOCK,
    "New monsoon-special mango gelato flavor just launched",
    "promotional"
  );

  console.log("=== FULL GENERATION RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  const { selected, alternates } = pickBestCaption(result.captions);

  console.log("\n=== SELECTED (highest hook strength) ===");
  console.log(JSON.stringify(selected, null, 2));

  console.log("\n=== ALTERNATES (stored, not shown) ===");
  console.log(JSON.stringify(alternates, null, 2));

  console.log(`\n=== SEO KEYWORDS (${result.seo_keywords.length}) ===`);
  console.log(result.seo_keywords.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
