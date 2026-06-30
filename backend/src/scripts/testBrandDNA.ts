import "dotenv/config";
import { generateBrandDNA } from "../services/brandDNA.service";

async function main() {
  const dna = await generateBrandDNA({
    brandName: "Ameeco",
    whatTheySell: "handmade gelato and cookies",
    brandVibe: "fun and friendly",
  });

  console.log(JSON.stringify(dna, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
