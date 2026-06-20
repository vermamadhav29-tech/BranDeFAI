/**
 * Tests the production generateImage function end-to-end.
 * Run with: npx ts-node scripts/test-prod-image.ts
 */
import "dotenv/config";
import { generateImage } from "../src/services/ai/imageGenService";

(async () => {
  console.log("=== Production generateImage test ===");
  try {
    const url = await generateImage(
      "Modern minimalist coffee mug product shot on white background",
      "clean professional",
      "1:1"
    );
    console.log("✓ SUCCESS:", url);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("✗ FAILED:", err.message);
    process.exit(1);
  }
})();
