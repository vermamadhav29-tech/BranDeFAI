// Eyeball the industry-branched Stage 1/2 prompts for accidental cross-industry
// leakage (e.g. "metal" language in a food prompt). No OpenAI call.
// Run: npx ts-node --transpile-only scripts/checkPrompts.ts [industry]
import { sceneMoodsFor } from "../src/studio-test/designSystem";
import { inspectorSystemFor, directorSystem, type Industry } from "../src/studio-test/productVision";

const JEWELLERY_WORDS = /metal|gemstone|stone\b|karat|gold|silver|platinum/i;
const FOOD_WORDS       = /ingredient|glaze|frosting|garnish|plating|dish/i;
const LIFESTYLE_WORDS  = /aluminium|leather|canvas|rubber|milled/i;

const industries: Industry[] = ["jewellery", "food_desserts", "lifestyle"];
const only = process.argv[2] as Industry | undefined;

for (const ind of only ? [only] : industries) {
  console.log(`\n${"=".repeat(70)}\n${ind}  (scene moods: ${sceneMoodsFor(ind).join(", ")})\n${"=".repeat(70)}`);
  const insp = inspectorSystemFor(ind);
  const dir  = directorSystem(ind, "IN");

  const flags: string[] = [];
  if (ind !== "jewellery"     && JEWELLERY_WORDS.test(insp)) flags.push("jewellery vocab leaked into Stage 1");
  if (ind !== "food_desserts" && FOOD_WORDS.test(insp))       flags.push("food vocab leaked into Stage 1");
  if (ind !== "lifestyle"     && LIFESTYLE_WORDS.test(insp))  flags.push("lifestyle vocab leaked into Stage 1");

  console.log(insp);
  console.log("\n--- Stage 2 (director) ---\n");
  console.log(dir);
  console.log(flags.length ? `\n!! FLAGS: ${flags.join("; ")}` : "\nno cross-industry vocab detected");
}
