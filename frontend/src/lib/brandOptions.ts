// Shared option lists for brand onboarding and settings.

export const INDUSTRIES = [
  { value: "Fashion & Apparel",        emoji: "👗" },
  { value: "Jewellery",                emoji: "💎" },
  { value: "Beauty & Skincare",        emoji: "💄" },
  { value: "Home Decor",               emoji: "🏡" },
  { value: "Food & Beverage",          emoji: "🍜" },
  { value: "Restaurant & Cafe",        emoji: "☕" },
  { value: "Salon & Spa",              emoji: "💅" },
  { value: "D2C Products",             emoji: "📦" },
  { value: "Health & Wellness",        emoji: "🌿" },
  { value: "Electronics & Tech",       emoji: "💻" },
  { value: "Baby & Kids",              emoji: "🍼" },
  { value: "Fitness & Sports",         emoji: "🏋️" },
  { value: "Luxury Goods",             emoji: "✨" },
  { value: "Handicrafts & Artisan",    emoji: "🪡" },
  { value: "Wedding & Celebrations",   emoji: "💍" },
  { value: "Interior Design",          emoji: "🛋️" },
  { value: "Education",                emoji: "📚" },
  { value: "Real Estate",              emoji: "🏢" },
  { value: "Photography",              emoji: "📸" },
  { value: "Digital Services",         emoji: "🌐" },
  { value: "Retail Store",             emoji: "🏪" },
  { value: "E-commerce Brand",         emoji: "🛒" },
  { value: "Personal Brand / Creator", emoji: "🎯" },
  { value: "Other",                    emoji: "🔮" },
] as const;

export const PLATFORMS = [
  { value: "Instagram Shop",    emoji: "📱" },
  { value: "Own Website",       emoji: "🌐" },
  { value: "Offline / Retail",  emoji: "🏢" },
  { value: "Amazon",            emoji: "📦" },
  { value: "Flipkart",          emoji: "🛍️" },
  { value: "Meesho",            emoji: "🏪" },
  { value: "Myntra",            emoji: "👗" },
  { value: "Shopify Store",     emoji: "🟢" },
  { value: "Facebook Shop",     emoji: "📘" },
  { value: "WhatsApp Business", emoji: "💬" },
  { value: "Etsy",              emoji: "🎨" },
  { value: "Other",             emoji: "🔮" },
] as const;

export 
type Tone =
  | "Professional" | "Playful" | "Inspirational" | "Bold"
  | "Minimal" | "Luxury" | "Witty";

export const MAX_TONES = 3;

export const TONES: { value: Tone; tagline: string; detail: string; bestFor: string; example: string }[] = [
  { value: "Professional",  tagline: "Clear, credible, authoritative", detail: "Plain, confident language with facts and proof points. No slang, no hype.", bestFor: "Services, B2B, finance, health", example: "Trusted by thousands of customers across India." },
  { value: "Playful",       tagline: "Fun, light, energetic",           detail: "Casual and upbeat, with exclamation marks, quick jokes and a friendly voice.", bestFor: "Kids, snacks, lifestyle, D2C", example: "Plot twist: your wardrobe just got an upgrade." },
  { value: "Inspirational", tagline: "Motivating and uplifting",        detail: "Warm, encouraging copy that talks about people, goals and what is possible.", bestFor: "Fitness, education, coaching", example: "You were born for this. Start today." },
  { value: "Bold",          tagline: "Direct, confident, no fluff",     detail: "Short punchy lines, strong claims and clear calls to action.", bestFor: "Sports, tech, challenger brands", example: "No fluff. Just results." },
  { value: "Minimal",       tagline: "Clean and understated",           detail: "Few words, calm rhythm and plenty of space. Lets the product speak.", bestFor: "Design, skincare, home, fashion", example: "Less is more." },
  { value: "Luxury",        tagline: "Elegant, refined, premium",       detail: "Unhurried, polished language that stresses craft, rarity and detail.", bestFor: "Jewellery, couture, hospitality", example: "Crafted for the discerning few." },
  { value: "Witty",         tagline: "Clever, dry, a little cheeky",    detail: "Wordplay and smart observations that make people smile and share.", bestFor: "Food, cafes, culture, creators", example: "We take our coffee seriously. Ourselves, not so much." },
];

export function parseTones(value: string | null | undefined): Tone[] {
  const valid = TONES.map((t) => t.value as string);
  return (value ?? "").split(",").map((t) => t.trim()).filter((t) => valid.includes(t)) as Tone[];
}
