export type Block = { h: string } | { p: string } | { ul: string[] };
export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  body: Block[];
}

export const POSTS: Post[] = [
  {
    slug: "plan-a-month-of-instagram-content",
    title: "How to plan a month of Instagram content in an hour",
    date: "October 2026",
    excerpt: "A simple framework for deciding what to post, when to post it, and how to stop starting from a blank page every morning.",
    body: [
      { p: "Most brands don't struggle to post. They struggle to decide what to post, every single day. The fix is to make those decisions once, for the whole month, and then let the calendar carry you." },
      { h: "Start with three content pillars" },
      { p: "Pick three themes your audience genuinely cares about, for example product stories, behind-the-scenes, and customer moments. Every post should belong to one of them. It keeps your feed coherent and gives you a short list to pick from." },
      { h: "Set a rhythm, not a quota" },
      { p: "Decide how often you can sustain: three posts a week beats ten in week one and none in week three. Mix formats across the week: a reel, a carousel or image, and a caption-led post." },
      { h: "Plan around real dates" },
      { p: "Festivals, sale windows and product launches are your anchors. Put them on the calendar first, then fill the gaps with evergreen posts." },
      { h: "Let the system do the first draft" },
      { p: "BrandefAI builds a 30-day calendar from your brand profile: captions, reel ideas, ad copy and images, each placed on a day. You review, edit what you like, and approve. Planning a month becomes a review job instead of a writing job." },
    ],
  },
  {
    slug: "product-photography-without-a-studio",
    title: "Product photography without a studio: what AI can do",
    date: "October 2026",
    excerpt: "From one phone photo to clean, consistent product shots, and where you still need a real camera.",
    body: [
      { p: "Studio shoots are expensive, slow, and hard to repeat. For many small brands that means a handful of hero images and a feed that looks the same for months." },
      { h: "What AI does well" },
      { ul: ["Clean backgrounds and consistent lighting from a single product photo", "Lifestyle scenes that place the product in context", "Multiple crops and formats for feed, stories and ads"] },
      { h: "Where you still need care" },
      { p: "Fine details such as embroidery, zari work and jewellery settings need checking. Always review the output against the real product, and keep your original photos as the source of truth." },
      { h: "A workflow that works" },
      { p: "Shoot the product on a plain surface in daylight, upload it, and generate a few variations. Pick the strongest, then use the same style across the month so your grid feels intentional." },
      { p: "BrandefAI generates images from your product photo and brand profile, and only uses a credit when an image is successfully delivered." },
    ],
  },
  {
    slug: "captions-in-your-brand-voice",
    title: "Writing captions in your brand voice, every time",
    date: "October 2026",
    excerpt: "Why generic captions fall flat, and how a short voice guide keeps every post sounding like you.",
    body: [
      { p: "A caption is the only place your brand gets to talk. If it sounds like everyone else, people scroll past." },
      { h: "Write a voice guide in five lines" },
      { ul: ["Three adjectives that describe how you sound (warm, witty, premium)", "Words you love and words you never use", "How formal you are with your audience", "Whether you use emojis, and how many", "One caption you wish you'd written"] },
      { h: "Give every caption a job" },
      { p: "Each post should either inform, entertain, or invite action. Decide which before you write, and end with a clear next step when it's an action post." },
      { h: "Keep it consistent at scale" },
      { p: "Consistency is hard when many people write, or when you write at midnight. BrandefAI learns your tone from your brand profile and gives you three caption options per post so you can choose the one that sounds most like you." },
    ],
  },
  {
    slug: "reels-that-sell",
    title: "Reels that sell: hooks, shot lists and timing",
    date: "October 2026",
    excerpt: "The first three seconds decide everything. A practical structure for short product videos.",
    body: [
      { p: "Reels reward attention. If viewers stay past the first few seconds, the rest of your video gets a chance." },
      { h: "Open with the payoff or the problem" },
      { p: "Start on the most interesting frame: the finished look, the surprising texture, the before and after. Context can come later." },
      { h: "Plan the shots before you film" },
      { ul: ["Opening hook (1-2 seconds)", "Three to five product close-ups", "One shot of the product in use", "A closing frame with a clear call to action"] },
      { h: "Keep it short" },
      { p: "Ten to fifteen seconds is plenty for a product reel. Cut anything that doesn't earn its place." },
      { p: "BrandefAI suggests reel hooks with a shot list for each post, and its video studio can turn a product image into a cinematic clip you can arrange on a timeline." },
    ],
  },
  {
    slug: "your-first-30-days-on-instagram",
    title: "From idea to launch: your first 30 days on Instagram",
    date: "October 2026",
    excerpt: "A week-by-week plan for new brands: set up, find your voice, build the habit, then start learning from results.",
    body: [
      { h: "Week 1: set up properly" },
      { p: "Create a business profile, write a bio that says who you help and how, add a clear profile image, and link to your store." },
      { h: "Week 2: find your voice" },
      { p: "Post a mix of formats and note what feels natural. Write down the tone you keep returning to; that's your voice." },
      { h: "Week 3: build the habit" },
      { p: "Schedule your posts in advance so consistency doesn't depend on your energy that day." },
      { h: "Week 4: read the signals" },
      { p: "Look at which posts were saved and shared, not just liked. Double down on those themes next month." },
      { p: "With BrandefAI you can set up your brand once, get a full 30-day plan, and publish to Instagram on schedule, so the first month is about learning, not scrambling." },
    ],
  },
  {
    slug: "festival-campaigns-for-indian-brands",
    title: "Festival campaigns: how Indian brands win the season",
    date: "October 2026",
    excerpt: "Diwali, Eid, Navratri, wedding season: plan early, tell a story, and make the offer obvious.",
    body: [
      { p: "Festive seasons are the biggest moments in the Indian retail calendar. Attention is high, and so is competition." },
      { h: "Start four to six weeks early" },
      { p: "Audiences begin browsing well before the festival. A teaser phase builds anticipation, then launch, then a final-days reminder." },
      { h: "Tell a story, not just a sale" },
      { p: "Tie your collection to the feeling of the festival: family, light, new beginnings. Offers land better when they sit inside a story." },
      { h: "Make the offer obvious" },
      { p: "Put the offer, the deadline and the delivery promise in the first line of the caption and on the creative itself." },
      { h: "Prepare your content in advance" },
      { p: "Create the full festive series ahead of time and schedule it. BrandefAI can plan an occasion-aware campaign and place each post on the calendar for you." },
    ],
  },
  {
    slug: "7-content-pillars-for-d2c-brands",
    title: "7 content pillars every D2C brand needs",
    date: "October 2026",
    excerpt: "A balanced mix of themes that keeps your feed useful, human and sellable.",
    body: [
      { ul: ["Product spotlights: what it is and why it's good", "How-to and styling: how people use it", "Behind the scenes: the people and process", "Customer stories: social proof in their words", "Education: tips related to your category", "Offers and launches: the clear reasons to buy now", "Brand values: what you stand for"] },
      { p: "You don't need all seven every week. Rotate them so no single theme dominates, and make sure at least one in three posts isn't a direct pitch." },
      { h: "How to use the list" },
      { p: "Write each pillar on a card, then plan the month by assigning pillars to days. Fill each day with the format that suits the topic." },
      { p: "BrandefAI uses your brand profile to spread posts across themes automatically, so your calendar stays balanced without you tracking it by hand." },
    ],
  },
  {
    slug: "building-trust-with-consistent-branding",
    title: "Building trust through consistent branding",
    date: "October 2026",
    excerpt: "People trust brands they recognise. Small, repeated choices do most of the work.",
    body: [
      { p: "Trust is built from repetition. When your colours, tone and style show up the same way every time, your audience stops questioning and starts remembering." },
      { h: "Choose a small set of rules" },
      { ul: ["Two or three brand colours and one or two fonts", "A consistent photo style (lighting, background, framing)", "A recognisable caption structure", "A reliable posting rhythm"] },
      { h: "Be consistent before you are creative" },
      { p: "Creativity works best inside a frame. Once the basics are fixed, you can experiment within them without confusing people." },
      { h: "Make consistency effortless" },
      { p: "BrandefAI stores your brand profile once and applies it to every caption, image and video it generates, so your feed looks and sounds like one brand." },
    ],
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);
