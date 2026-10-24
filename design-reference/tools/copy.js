// Rewrites the template copy in the generated components to BrandefAI's real product content.
// Run once after generation:  node design-reference/tools/copy.js
const fs = require("fs");
const path = require("path");
const D = path.resolve(__dirname, "../../frontend/src/components/draftr") + "/";

const warnings = [];
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const jsx = (t) => (/['"{}<>&\\]/.test(t) ? `{${JSON.stringify(t)}}` : t);

function matchClose(s, start) {
  let d = 0;
  const re = /<(\/?)div\b/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(s))) {
    if (m[1] === "/") {
      d--;
      if (d === 0) return s.indexOf(">", m.index) + 1;
    } else d++;
  }
  throw new Error("unbalanced div");
}

// replace every occurrence of a text node; `news` may be an array to cycle through per occurrence
function text(file, s, old, news) {
  const list = Array.isArray(news) ? news : [news];
  let n = 0;
  const re = new RegExp(`(>${esc(old)}<)|(\\{${esc(JSON.stringify(old))}\\})`, "g");
  s = s.replace(re, (m, a) => {
    const t = list[n++ % list.length];
    return a ? `>${jsx(t)}<` : `{${JSON.stringify(t)}}`;
  });
  if (!n) warnings.push(`${file}: text not found: ${old.slice(0, 50)}`);
  return s;
}

// rebuild a word-split heading (one <span> per word) from new text
function heading(file, s, oldText, newText) {
  let n = 0;
  s = s.replace(/<(h[12])\b([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
    const txt = inner.replace(/\{" "\}/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (txt !== oldText) return m;
    const open = inner.match(/<span [^>]*>/);
    if (!open) return m;
    n++;
    const words = newText.split(" ").map((w) => open[0] + jsx(w) + "</span>");
    return `<${tag}${attrs}>${words.join('{" "}')}</${tag}>`;
  });
  if (!n) warnings.push(`${file}: heading not found: ${oldText}`);
  return s;
}

function removeByClass(file, s, cls) {
  let n = 0,
    i;
  while ((i = s.indexOf(`<div className="${cls}"`)) >= 0) {
    s = s.slice(0, i) + s.slice(matchClose(s, i));
    n++;
  }
  if (!n) warnings.push(`${file}: element not found: ${cls}`);
  return s;
}

function edit(file, fn) {
  const p = D + file;
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  if (after !== before) fs.writeFileSync(p, after);
}

/* ------------------------------------------------------------------ HOME */
edit("home/Hero.tsx", (s) => {
  s = text("Hero", s, "Revolutionize your design workflow", "AI marketing for Indian brands");
  s = heading("Hero", s, "Bring ideas to life in just a few clicks.", "Content made and posted by AI.");
  s = text("Hero", s, "Design, prototype, and collaborate in real-time - all in one powerful platform. Elevate your ", "Set up your brand once. BrandefAI writes your captions, creates images and reels, then ");
  s = text("Hero", s, "creative process ", "publishes to Instagram ");
  s = text("Hero", s, "with ", "on a ");
  s = text("Hero", s, "seamless teamwork", "30-day calendar");
  s = text("Hero", s, " and limitless possibilities.", " that fills itself.");
  s = text("Hero", s, "Get Started • it’s free", "Start free trial");
  return s;
});

edit("home/Clients.tsx", (s) => {
  const names = ["Anokhi Label", "Studio Meera", "Kapoor Textiles", "Rang Bazaar", "Zari Collective", "Craft & Co."];
  const li = names
    .map(
      (n) =>
        `<li style={{ height: "36px", display: "flex", alignItems: "center" } as CSSProperties}><span style={{ fontFamily: '"Inter Display", "Inter Display Placeholder", sans-serif', fontWeight: 600, fontSize: 24, letterSpacing: "-0.04em", color: "#606266", whiteSpace: "nowrap" } as CSSProperties}>${jsx(n)}</span></li>`,
    )
    .join("");
  let n = 0;
  const out = s.replace(/<li [^>]*>[\s\S]*?<\/li>/g, () => (n++ === 0 ? li : ""));
  if (!n) warnings.push("Clients: no <li> found");
  return out;
});

edit("home/Features.tsx", (s) => {
  s = heading("Features", s, "The ultimate toolkit for designers & teams", "Everything your brand needs to post daily");
  s = text("Features", s, "Everything you need to create, prototype, and collaborate - all in a single, easy-to-use platform.", "From strategy to scheduling, one platform replaces your agency, your photographer and your content calendar.");
  s = text("Features", s, "Intuitive drag & drop editor", "AI Product Photography");
  s = text("Features", s, "Create stunning designs effortlessly with a user-friendly interface.", "Upload one product photo and get studio-quality images with pro lighting and clean backgrounds.");
  s = text("Features", s, "Advanced prototyping", "30-day content calendar");
  s = text("Features", s, "Turn ideas into interactive prototypes without writing a single line of code.", "Every caption, reel and image lands on a calendar automatically. Export it as PDF or CSV.");
  s = text("Features", s, "Real-time collaboration", "AI Copywriter");
  s = text("Features", s, "Work seamlessly with your team, get instant feedback.", "Three captions, two reel hooks and ad copy in your brand voice, every single time.");
  return s;
});

edit("home/Steps.tsx", (s) => {
  s = heading("Steps", s, "Simplify your workflow", "From brand to posted in minutes");
  s = text("Steps", s, "Start your project", "Set up your brand");
  s = text("Steps", s, "Create a new design or import files with just a click. Set up your workspace effortlessly.", "Tell BrandefAI your brand name, audience and tone once. It takes two minutes.");
  s = text("Steps", s, "Design with ease", "Upload your product");
  s = text("Steps", s, "Use our intuitive drag-and-drop editor, smart tools stunning designs.", "Drop in a product photo. The AI reads your brand context and plans content for it.");
  s = text("Steps", s, "Export & Share", "Generate, schedule and post");
  s = text("Steps", s, "Easily integrate with your favorite tools to launch your project effortlessly.", "Get captions, reels, ad copy and images in under a minute, then post to Instagram on schedule.");
  s = text("Steps", s, "Available on Windows & Mac", "Works on any device");
  // Windows / Mac download icons do not apply to a web app
  for (;;) {
    const i = s.indexOf('data-framer-name="Button Round SM"');
    if (i < 0) break;
    const a = s.lastIndexOf("<a ", i);
    const c = s.lastIndexOf("<div ", a);
    s = s.slice(0, c) + s.slice(matchClose(s, c));
  }
  return s;
});

edit("home/Integrations.tsx", (s) => {
  s = heading("Integrations", s, "One platform, unlimited integrations", "Best-in-class AI, posting straight to Instagram");
  s = text("Integrations", s, "View all integrations", "See how it works");
  s = text("Integrations", s, "“Our platform empowers teams to collaborate, innovate, and bring ideas to life—seamlessly and effortlessly.”", "“BrandefAI thinks before it creates. It plans your strategy first, then makes the content to match.”");
  s = text("Integrations", s, "Daniel Vaughn, Founder & CEO", "The BrandefAI team");
  // avatar photo -> brand badge (no stock person attached to a product statement)
  s = s.replace(
    /<div style=\{\{[^}]*\} as CSSProperties\} data-framer-background-image-wrapper="true"><img [^>]*alt="Daniel Vaughn"[^>]*\/><\/div>/g,
    `<span style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: "linear-gradient(135deg, #5235ef, #8771ff)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 11, letterSpacing: "-0.02em" } as CSSProperties}>AI</span>`,
  );
  return s;
});

edit("home/FeaturesTwo.tsx", (s) => {
  s = heading("FeaturesTwo", s, "Power up your workflow with next-gen features", "Built for fashion, jewellery and D2C brands");
  s = text("FeaturesTwo", s, "Cloud-based accessibility", "Cinematic Video Studio");
  s = text("FeaturesTwo", s, "Access your projects anytime, anywhere—no downloads or installations needed.", "Upload a product image, write a prompt, and get a cinematic brand video in under 60 seconds.");
  s = text("FeaturesTwo", s, "Fast & secure performance", "Pay only for results");
  s = text("FeaturesTwo", s, "Experience lightning-fast speed with enterprise-level security and version control.", "Credits are deducted only when the AI delivers. A failed generation never costs you a credit.");
  s = text("FeaturesTwo", s, "Effortless design experience ", "AI Brand Strategist ");
  s = text("FeaturesTwo", s, "Intuitive interface and smart tools to speed up your creative process.", "Analyzes your brand, audience and market to plan hooks and directions before creating.");
  s = text("FeaturesTwo", s, "Hassle-free prototyping", "Auto-post to Instagram");
  s = text("FeaturesTwo", s, "Transform static designs into interactive prototypes in just a few clicks.", "Schedule your calendar and publish straight to Instagram through the official Graph API.");
  s = text("FeaturesTwo", s, "One-click export & handoff", "Export PDF and CSV");
  s = text("FeaturesTwo", s, "Generate code, export assets, and collaborate with developers effortlessly.", "Take your full content plan anywhere with a one-click export.");
  return s;
});

edit("home/Testimonial.tsx", (s) => {
  s = heading("Testimonial", s, "Loved by designers & teams", "Loved by Indian brands");
  s = text("Testimonial", s, "“This tool has completely transformed how our team collaborates. The real-time editing and seamless integrations make our process so much smoother!”", "“We used to spend ₹25,000 a month on a content agency. BrandefAI replaced all of it for ₹1,799. The image quality genuinely shocked me the first time I saw it.”");
  s = text("Testimonial", s, "Emily Ray, UX Designer", "Priya Sharma, Anokhi Label, Delhi");
  s = s.split('alt="Emily Ray"').join('alt="Priya Sharma"').split('alt="Sofia Delgado"').join('alt="Meera Joshi"').split('alt="Ryan Chen"').join('alt="Arjun Kapoor"');
  s = removeByClass("Testimonial", s, "framer-588lxq");
  s = removeByClass("Testimonial", s, "framer-1h8x0gq");
  return s;
});

edit("home/Pricing.tsx", (s) => {
  s = heading("Pricing", s, "Flexible pricing plans", "Simple, flexible pricing");
  s = text("Pricing", s, "Choose a plan that grows with you. Start for free and upgrade anytime for more features and support", "Start with a free 3-day trial. Upgrade anytime. Credits are only used when the AI delivers.");
  // yearly billing is not offered
  while (s.includes('<div className="framer-1pom8bg"')) s = removeByClass("Pricing", s, "framer-1pom8bg");
  s = text("Pricing", s, "Starter plan", "Free Trial");
  s = text("Pricing", s, "Pro plan", "Growth");
  s = text("Pricing", s, "Business plan", "Pro");
  s = text("Pricing", s, "For individuals & new creators", "Try everything free for 3 days");
  s = text("Pricing", s, "For freelancers & small teams", "For growing fashion and D2C brands");
  s = text("Pricing", s, "For growing teams & agencies", "For established brands at scale");
  s = text("Pricing", s, "/month", ["/3 days", "/month", "/month"]);
  s = text("Pricing", s, "Get Started", ["Start free trial", "Start free trial", "Get started", "Get started", "Go Pro", "Go Pro"]);
  // price digits: one <span> per character
  const PRICES = ["₹0", "₹1,799", "₹3,499"];
  let k = 0;
  s = s.replace(/(<span style=\{\{[^}]*\} as CSSProperties\}>)\$<\/span>(?:<span style=\{\{[^}]*\} as CSSProperties\}>\d<\/span>)+/g, (m, open) => {
    const p = PRICES[k++ % 3];
    return [...p].map((c) => open + jsx(c) + "</span>").join("");
  });
  if (!k) warnings.push("Pricing: price digits not found");
  const feats = [
    ["1 active project", "5 credits included"],
    ["Basic collaboration tools", "5 AI image generations"],
    ["Limited prototyping options", "1 video generation"],
    ["500MB cloud storage", "Caption and ad copy generation"],
    ["Community support", "Priority support"],
    ["Unlimited projects", "100 credits every month"],
    ["Real-time collaboration", "100 AI image generations"],
    ["Advanced prototyping tools", "25 video reels"],
    ["Cloud storage & version history", "Full 30-day content calendar"],
    ["Email & chat support", "Advanced video timeline editor"],
    ["Everything in Pro +", "Everything in Growth"],
    ["Team management & permissions", "250 credits every month"],
    ["Enhanced security controls", "60 video reels"],
    ["Priority integrations & API access", "Advanced video timeline editor"],
    ["Advanced cloud storage", "Dedicated account manager"],
    ["24/7 priority support", "API access (coming soon)"],
  ];
  for (const [o, n] of feats) s = text("Pricing", s, o, n);
  // "Seamless third-party integrations": Free Trial (struck) then Growth, per variant
  s = text("Pricing", s, "Seamless third-party integrations", ["Content calendar export", "Brand strategy AI and exports"]);
  return s;
});

edit("home/AppSection.tsx", (s) => {
  s = heading("AppSection", s, "The perfect design solution for every workflow", "Content for every kind of brand");
  s = text("AppSection", s, "Discover how our design platform fits your needs, whether you're a freelancer, startup, or enterprise.", "BrandefAI is built for fashion labels, jewellery brands and D2C product brands across India.");
  s = text("AppSection", s, "UI/UX designers", "Fashion labels");
  s = text("AppSection", s, "App & Web developers", "Jewellery brands");
  s = text("AppSection", s, "Product teams", "D2C product brands");
  s = text("AppSection", s, "Marketing teams", "Home and textile brands");
  s = text("AppSection", s, "Enterprises Organizations", "Beauty and wellness");
  s = text("AppSection", s, "Agencies & Enterprises", "Founders doing it solo");
  return s;
});

edit("home/Cta.tsx", (s) => {
  s = heading("Cta", s, "Take your creative workflow to the next level", "Put your brand on autopilot");
  s = text("Cta", s, "Supercharge your workflow with powerful design tools and effortless collaboration—perfect for freelancers and teams.", "Plan, create and post a full month of content in minutes. Start with a free 3-day trial.");
  s = text("Cta", s, "Get Started", "Start free trial");
  // Windows / Mac download buttons do not apply to a web app
  let n = 0;
  for (;;) {
    const i = s.indexOf('data-framer-name="Button Round"');
    if (i < 0) break;
    const a = s.lastIndexOf("<a ", i);
    const c = s.lastIndexOf("<div ", a);
    s = s.slice(0, c) + s.slice(matchClose(s, c));
    n++;
  }
  if (!n) warnings.push("Cta: round buttons not found");
  return s;
});

/* ------------------------------------------------------------------ BLOG */
edit("blog/BlogHero.tsx", (s) => {
  s = heading("BlogHero", s, "SaaS insights & tips", "Brand insights and tips");
  s = text("BlogHero", s, "Practical ideas and trends to help your software brand grow and stand out.", "Practical ideas on Instagram, content and AI to help your brand grow and stand out.");
  return s;
});
const POSTS = [
  "How to plan a month of Instagram content in an hour",
  "Product photography without a studio: what AI can do",
  "Writing captions in your brand voice, every time",
  "Reels that sell: hooks, shot lists and timing",
  "From idea to launch: your first 30 days on Instagram",
  "Festival campaigns: how Indian brands win the season",
];
edit("blog/BlogList.tsx", (s) => {
  const old = [
    "Best practices for showcasing features",
    "Visual storytelling for complex products",
    "How microinteractions boost user experience",
    "Why performance and accessibility matter",
    "From idea to launch: SaaS UI/UX guide",
    "Simplifying user journeys for more signups",
  ];
  old.forEach((o, i) => (s = text("BlogList", s, o, POSTS[i])));
  s = text("BlogList", s, "Oct 13, 2025", "Oct 2026");
  return s;
});
// the two posts revealed by "Load More"
edit("blogExtra.ts", (s) =>
  s
    .replace(/7 Must-Have sections for SaaS websites/g, "7 content pillars every D2C brand needs")
    .replace(/Building trust through smart design/g, "Building trust through consistent branding")
    .replace(/Oct 13, 2025/g, "Oct 2026"),
);

/* --------------------------------------------------------------- CONTACT */
edit("contact/ContactSection.tsx", (s) => {
  s = text("Contact", s, "Have questions, need help, or want to discover more about Draftr? We're here to support you every step of the way.", "Have questions, need help, or want to see how BrandefAI can run your content? We're here to support you every step of the way.");
  s = text("Contact", s, "Need help? Our team’s here 24/7 to assist you.", "Need help with your account or a generation? Our team will get back to you.");
  s = text("Contact", s, "Interested in Draftr for your team? Let’s talk pricing and solutions.", "Interested in BrandefAI for your brand or agency? Let’s talk plans and onboarding.");
  return s;
});
edit("contact/FaqSection.tsx", (s) => {
  s = text("Faq", s, "Find quick answers to common questions about Draftr.", "Find quick answers to common questions about BrandefAI.");
  s = text("Faq", s, "What is Draftr?", "Do I need design or marketing skills?");
  s = text("Faq", s, "Do I need to install anything to use Draftr?", "How is BrandefAI different from Canva or ChatGPT?");
  s = text("Faq", s, "Can I collaborate with others in real time?", "What kind of brands is BrandefAI built for?");
  s = text("Faq", s, "Is there a free version of Draftr?", "How does video generation work?");
  s = text("Faq", s, "What kind of export options does Draftr support?", "Can I cancel anytime?");
  return s;
});

console.log(warnings.length ? "WARNINGS:\n" + warnings.join("\n") : "all replacements applied");

// slug-map: blog slugs were renamed to match the BrandefAI posts (see content/posts.ts)
