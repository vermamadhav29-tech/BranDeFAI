// BrandefAI product mockups used in place of the template's screenshots.
// Pure SVG (no gradient/ids) so every responsive copy of the markup renders identically.
import type { CSSProperties } from "react";

const F = '"Inter", "Inter Placeholder", sans-serif';
const FD = '"Inter Display", "Inter Display Placeholder", sans-serif';
const INK = "#101011";
const GRAY = "#606266";
const LINE = "#e6e8ee";
const BG = "#f0f2f6";
const P1 = "#5235ef";
const P2 = "#8771ff";

const TYPES = [
  { label: "Caption", c: "#5235ef", bg: "#ebe8fd" },
  { label: "Reel", c: "#2f6bff", bg: "#e4ecff" },
  { label: "Image", c: "#f0703a", bg: "#ffeadf" },
  { label: "Ad copy", c: "#1ba672", bg: "#dff5ec" },
];

const svgStyle: CSSProperties = { display: "block", width: "100%", height: "100%", borderRadius: "inherit" };

function Mark({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 32})`}>
      <rect width="32" height="32" rx="9" fill={P1} />
      <path d="M16 6.5l2.2 6.3 6.3 2.2-6.3 2.2L16 23.5l-2.2-6.3L7.5 15l6.3-2.2L16 6.5z" fill="#fff" />
      <circle cx="24" cy="8" r="1.8" fill="#fff" opacity=".85" />
    </g>
  );
}

/* ---------- Content calendar window (hero, final call-to-action) ---------- */
export function CalendarMock() {
  const cw = 140;
  const rh = 118;
  const cells: React.ReactNode[] = [];
  for (let d = 1; d <= 30; d++) {
    const idx = d + 1; // month starts on a Wednesday
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    const x = 150 + col * (cw + 10);
    const y = 282 + row * (rh + 10);
    const today = d === 12;
    const t1 = TYPES[(d * 5) % 4];
    const t2 = TYPES[(d * 5 + 2) % 4];
    const two = d % 3 === 0 || d % 7 === 2;
    cells.push(
      <g key={d}>
        <rect x={x} y={y} width={cw} height={rh} rx={16} fill="#fff" stroke={today ? P1 : LINE} strokeWidth={today ? 3 : 1.5} />
        <text x={x + 14} y={y + 30} fontFamily={F} fontSize="17" fontWeight="500" fill={today ? P1 : GRAY}>
          {d}
        </text>
        {[t1, ...(two ? [t2] : [])].map((t, i) => (
          <g key={i}>
            <rect x={x + 10} y={y + 44 + i * 36} width={cw - 20} height={30} rx={8} fill={t.bg} />
            <rect x={x + 10} y={y + 44 + i * 36} width={5} height={30} rx={2.5} fill={t.c} />
            <text x={x + 24} y={y + 64 + i * 36} fontFamily={F} fontSize="15" fontWeight="600" fill={t.c}>
              {t.label}
            </text>
          </g>
        ))}
      </g>,
    );
  }
  const railIcons = [
    <g key="cal"><rect x="12" y="14" width="24" height="22" rx="5" fill="none" stroke="#fff" strokeWidth="2.4" /><path d="M12 22h24" stroke="#fff" strokeWidth="2.4" /></g>,
    <path key="sp" d="M24 11l3 8.5 8.5 3-8.5 3L24 34l-3-8.5-8.5-3 8.5-3L24 11z" fill="none" stroke={GRAY} strokeWidth="2.4" strokeLinejoin="round" />,
    <g key="im"><rect x="12" y="14" width="24" height="20" rx="5" fill="none" stroke={GRAY} strokeWidth="2.4" /><circle cx="19" cy="21" r="2.4" fill={GRAY} /><path d="M14 31l7-6 5 4 4-3 4 4" fill="none" stroke={GRAY} strokeWidth="2.4" strokeLinejoin="round" /></g>,
    <g key="vi"><rect x="12" y="14" width="24" height="20" rx="5" fill="none" stroke={GRAY} strokeWidth="2.4" /><path d="M21 20l8 4-8 4z" fill={GRAY} /></g>,
    <g key="ch"><path d="M16 34V24M24 34V15M32 34V21" stroke={GRAY} strokeWidth="3.4" strokeLinecap="round" /></g>,
  ];
  return (
    <svg viewBox="0 0 1600 995" preserveAspectRatio="xMidYMin slice" style={svgStyle} role="img" aria-label="BrandefAI content calendar">
      <rect width="1600" height="995" rx="64" fill={BG} />
      {/* top bar */}
      <rect width="1600" height="96" fill="#fff" />
      <rect y="95" width="1600" height="1.5" fill={LINE} />
      <Mark x={36} y={24} s={48} />
      <text x="100" y="60" fontFamily={FD} fontSize="30" fontWeight="600" fill={INK} letterSpacing="-1.2">
        Brandef<tspan fill={P1} fontWeight="800">AI</tspan>
      </text>
      <text x="800" y="58" textAnchor="middle" fontFamily={F} fontSize="22" fill={GRAY}>
        Anokhi Label  /  <tspan fill={INK} fontWeight="600">October</tspan>
      </text>
      <rect x="1180" y="26" width="196" height="44" rx="22" fill="#e6f6ee" />
      <circle cx="1208" cy="48" r="7" fill="#1ba672" />
      <text x="1226" y="55" fontFamily={F} fontSize="19" fontWeight="600" fill="#12744e">Auto-post on</text>
      <rect x="1400" y="26" width="160" height="44" rx="22" fill={P1} />
      <text x="1480" y="55" textAnchor="middle" fontFamily={F} fontSize="19" fontWeight="600" fill="#fff">Export plan</text>
      {/* rail */}
      <rect y="96" width="120" height="899" fill="#fff" />
      <rect x="119" y="96" width="1.5" height="899" fill={LINE} />
      {railIcons.map((g, i) => (
        <g key={i} transform={`translate(36 ${140 + i * 88})`}>
          <rect width="48" height="48" rx="14" fill={i === 0 ? INK : "#fff"} stroke={i === 0 ? INK : LINE} strokeWidth="1.5" />
          {g}
        </g>
      ))}
      {/* main */}
      <text x="150" y="176" fontFamily={FD} fontSize="34" fontWeight="600" fill={INK} letterSpacing="-1.2">30-day content calendar</text>
      <text x="150" y="208" fontFamily={F} fontSize="19" fill={GRAY}>30 posts planned · next post today 7:30 PM</text>
      {TYPES.map((t, i) => (
        <g key={t.label} transform={`translate(${790 + i * 100} 192)`}>
          <circle cx="7" cy="7" r="7" fill={t.c} />
          <text x="22" y="13" fontFamily={F} fontSize="17" fill={GRAY}>{t.label}</text>
        </g>
      ))}
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w, i) => (
        <text key={w} x={150 + i * (cw + 10) + cw / 2} y="266" textAnchor="middle" fontFamily={F} fontSize="17" fill={GRAY}>
          {w}
        </text>
      ))}
      {cells}
      {/* right column */}
      <rect x="1230" y="130" width="334" height="300" rx="28" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <text x="1258" y="180" fontFamily={FD} fontSize="25" fontWeight="600" fill={INK} letterSpacing="-0.8">Brand profile</text>
      {[["Warm", 72], ["Festive", 90], ["Premium", 100]].reduce<{ x: number; els: React.ReactNode[] }>(
        (acc, [t, w]) => {
          acc.els.push(
            <g key={t as string}>
              <rect x={acc.x} y="204" width={w as number} height="38" rx="19" fill="#ebe8fd" />
              <text x={acc.x + (w as number) / 2} y="229" textAnchor="middle" fontFamily={F} fontSize="16" fontWeight="600" fill={P1}>{t}</text>
            </g>,
          );
          acc.x += (w as number) + 10;
          return acc;
        },
        { x: 1258, els: [] },
      ).els}
      <rect x="1258" y="276" width="278" height="12" rx="6" fill={BG} />
      <rect x="1258" y="304" width="236" height="12" rx="6" fill={BG} />
      <rect x="1258" y="332" width="190" height="12" rx="6" fill={BG} />
      <text x="1258" y="396" fontFamily={F} fontSize="16" fill={GRAY}>Learned from your last 20 posts</text>
      <rect x="1230" y="456" width="334" height="190" rx="28" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <text x="1258" y="506" fontFamily={FD} fontSize="25" fontWeight="600" fill={INK} letterSpacing="-0.8">Credits</text>
      <text x="1258" y="576" fontFamily={FD} fontSize="48" fontWeight="600" fill={INK} letterSpacing="-2">92<tspan fontSize="24" fill={GRAY} fontWeight="500"> / 100</tspan></text>
      <rect x="1258" y="600" width="278" height="14" rx="7" fill={BG} />
      <rect x="1258" y="600" width={278 * 0.92} height="14" rx="7" fill={P1} />
      <rect x="1230" y="672" width="334" height="258" rx="28" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <text x="1258" y="722" fontFamily={FD} fontSize="25" fontWeight="600" fill={INK} letterSpacing="-0.8">Up next</text>
      {[
        ["Diwali offer reel", "Today · 7:30 PM", TYPES[1].c],
        ["Festive saree caption", "Tomorrow · 11:00 AM", TYPES[0].c],
        ["Studio shot: kurta set", "Thu · 6:00 PM", TYPES[2].c],
      ].map(([a, b, c], i) => (
        <g key={a} transform={`translate(1258 ${752 + i * 56})`}>
          <circle cx="8" cy="16" r="8" fill={c} />
          <text x="28" y="14" fontFamily={F} fontSize="18" fontWeight="600" fill={INK}>{a}</text>
          <text x="28" y="36" fontFamily={F} fontSize="15" fill={GRAY}>{b}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Phone: scheduled Instagram post (hero) ---------- */
export function PhoneMock() {
  return (
    <svg viewBox="0 0 800 1103" preserveAspectRatio="xMidYMin slice" style={svgStyle} role="img" aria-label="Scheduled Instagram post">
      <rect width="800" height="1103" rx="64" fill="#fff" />
      <Mark x={44} y={44} s={56} />
      <text x="118" y="88" fontFamily={FD} fontSize="40" fontWeight="600" fill={INK} letterSpacing="-1.6">
        Brandef<tspan fill={P1} fontWeight="800">AI</tspan>
      </text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x="706" y={58 + i * 14} width="44" height="5" rx="2.5" fill={INK} />
      ))}
      {/* post */}
      <rect x="40" y="140" width="720" height="640" rx="52" fill="#fdecd0" />
      <circle cx="540" cy="330" r="150" fill="#f6a46a" />
      <path d="M40 640 C 190 470, 330 700, 480 560 S 700 520, 760 600 L 760 728 a52 52 0 0 1 -52 52 L 92 780 a52 52 0 0 1 -52 -52 Z" fill={P2} opacity=".92" />
      <path d="M40 700 C 200 600, 340 760, 500 690 S 700 650, 760 700 L 760 728 a52 52 0 0 1 -52 52 L 92 780 a52 52 0 0 1 -52 -52 Z" fill={P1} opacity=".9" />
      <rect x="72" y="172" width="236" height="52" rx="26" fill="#fff" />
      <circle cx="102" cy="198" r="12" fill="#1ba672" />
      <text x="124" y="206" fontFamily={F} fontSize="22" fontWeight="600" fill={INK}>Scheduled</text>
      <rect x="72" y="560" width="420" height="104" rx="30" fill="#fff" />
      <text x="98" y="606" fontFamily={F} fontSize="26" fontWeight="600" fill={INK}>Festive edit is live ✨</text>
      <text x="98" y="640" fontFamily={F} fontSize="21" fill={GRAY}>Draped in tradition. Styled for today.</text>
      {/* meta */}
      <circle cx="68" cy="838" r="26" fill={P1} />
      <text x="68" y="846" textAnchor="middle" fontFamily={F} fontSize="22" fontWeight="700" fill="#fff">A</text>
      <text x="110" y="832" fontFamily={F} fontSize="24" fontWeight="600" fill={INK}>anokhi.label</text>
      <text x="110" y="862" fontFamily={F} fontSize="20" fill={GRAY}>Tue · 7:30 PM · Instagram Feed</text>
      {/* toolbar */}
      <rect x="150" y="940" width="500" height="104" rx="34" fill={INK} />
      <rect x="196" y="1032" width="408" height="26" rx="13" fill="#e2e4e8" />
      <rect x="150" y="940" width="500" height="104" rx="34" fill={INK} />
      {["Caption", "Image", "Posted"].map((t, i) => (
        <g key={t} transform={`translate(${190 + i * 150} 992)`}>
          <circle cx="0" cy="0" r="9" fill="#1ba672" />
          <path d="M-4 0l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="20" y="8" fontFamily={F} fontSize="23" fontWeight="600" fill="#fff">{t}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Generated content pack window (how it works) ---------- */
export function GenerateMock() {
  const cards = [
    ["Draped in tradition. Styled for today. ✨", "Our festive edit just landed."],
    ["Your Diwali wardrobe, sorted.", "Handwoven. Hand-picked. Yours."],
    ["Zari, silk and a little sparkle.", "Meet the collection of the season."],
  ];
  const tiles = [
    ["#fdecd0", "#f6a46a", "Studio"],
    ["#e4ecff", "#8771ff", "Lifestyle"],
    ["#ffe3ea", "#ff8fa8", "Flat lay"],
    ["#dff5ec", "#1ba672", "Detail"],
  ];
  return (
    <svg viewBox="0 0 1071 920" preserveAspectRatio="xMidYMin slice" style={svgStyle} role="img" aria-label="Generated content pack">
      <rect width="1071" height="920" rx="50" fill="#fff" />
      <Mark x={36} y={26} s={44} />
      <text x="96" y="58" fontFamily={FD} fontSize="30" fontWeight="600" fill={INK} letterSpacing="-1.2">Your content pack</text>
      <rect x="800" y="26" width="236" height="44" rx="22" fill="#e6f6ee" />
      <circle cx="828" cy="48" r="7" fill="#1ba672" />
      <text x="846" y="55" fontFamily={F} fontSize="19" fontWeight="600" fill="#12744e">Ready in 42s</text>
      <rect y="96" width="1071" height="1.5" fill={LINE} />
      {/* brand profile */}
      <text x="36" y="148" fontFamily={FD} fontSize="24" fontWeight="600" fill={INK} letterSpacing="-0.8">Brand profile</text>
      {[["Brand", "Anokhi Label"], ["Audience", "Women 22–40, India"], ["Tone", "Warm · Festive"], ["Product", "Silk kurta set"]].map(([a, b], i) => (
        <g key={a} transform={`translate(36 ${176 + i * 108})`}>
          <text y="0" fontFamily={F} fontSize="16" fill={GRAY}>{a}</text>
          <rect y="14" width="268" height="58" rx="16" fill={BG} />
          <text x="18" y="50" fontFamily={F} fontSize="19" fontWeight="600" fill={INK}>{b}</text>
        </g>
      ))}
      {/* captions */}
      <text x="346" y="148" fontFamily={FD} fontSize="24" fontWeight="600" fill={INK} letterSpacing="-0.8">3 captions</text>
      {cards.map(([a, b], i) => (
        <g key={a} transform={`translate(346 ${170 + i * 122})`}>
          <rect width="400" height="106" rx="22" fill="#fff" stroke={i === 0 ? P1 : LINE} strokeWidth={i === 0 ? 3 : 1.5} />
          <text x="22" y="42" fontFamily={F} fontSize="19" fontWeight="600" fill={INK}>{a}</text>
          <text x="22" y="70" fontFamily={F} fontSize="17" fill={GRAY}>{b}</text>
          <rect x="22" y="82" width="64" height="12" rx="6" fill={i === 0 ? "#ebe8fd" : BG} />
        </g>
      ))}
      <rect x="346" y="540" width="400" height="150" rx="22" fill={BG} />
      <text x="368" y="580" fontFamily={F} fontSize="16" fontWeight="600" fill={P1}>REEL HOOK</text>
      <text x="368" y="616" fontFamily={F} fontSize="19" fontWeight="600" fill={INK}>“Wait for the zari reveal…”</text>
      <text x="368" y="646" fontFamily={F} fontSize="17" fill={GRAY}>Shot list · 5 clips · 12s</text>
      <rect x="346" y="710" width="400" height="150" rx="22" fill={BG} />
      <text x="368" y="750" fontFamily={F} fontSize="16" fontWeight="600" fill="#1ba672">AD COPY</text>
      <text x="368" y="786" fontFamily={F} fontSize="19" fontWeight="600" fill={INK}>Festive pieces from ₹1,999.</text>
      <text x="368" y="816" fontFamily={F} fontSize="17" fill={GRAY}>Free shipping across India.</text>
      {/* images */}
      <text x="776" y="148" fontFamily={FD} fontSize="24" fontWeight="600" fill={INK} letterSpacing="-0.8">4 images</text>
      {tiles.map(([bg, fg, l], i) => {
        const x = 776 + (i % 2) * 140;
        const y = 170 + Math.floor(i / 2) * 176;
        return (
          <g key={l} transform={`translate(${x} ${y})`}>
            <rect width="128" height="160" rx="20" fill={bg} />
            <circle cx="64" cy="64" r="34" fill={fg} opacity=".9" />
            <path d="M0 120 C 30 96, 60 140, 128 108 L128 140 a20 20 0 0 1 -20 20 L20 160 a20 20 0 0 1 -20 -20Z" fill={fg} opacity=".55" />
            <text x="12" y="150" fontFamily={F} fontSize="14" fontWeight="600" fill={INK}>{l}</text>
          </g>
        );
      })}
      <rect x="776" y="540" width="268" height="320" rx="22" fill={INK} />
      <text x="800" y="584" fontFamily={F} fontSize="16" fontWeight="600" fill="#a7a7a7">SCHEDULE</text>
      <text x="800" y="628" fontFamily={FD} fontSize="28" fontWeight="600" fill="#fff" letterSpacing="-1">30 days</text>
      <text x="800" y="660" fontFamily={F} fontSize="18" fill="#a7a7a7">planned automatically</text>
      <rect x="800" y="700" width="220" height="56" rx="28" fill={P1} />
      <text x="910" y="735" textAnchor="middle" fontFamily={F} fontSize="19" fontWeight="600" fill="#fff">Add to calendar</text>
      <rect x="800" y="772" width="220" height="56" rx="28" fill="none" stroke="#3a3a3c" strokeWidth="2" />
      <text x="910" y="807" textAnchor="middle" fontFamily={F} fontSize="19" fontWeight="600" fill="#fff">Regenerate</text>
    </svg>
  );
}

/* ---------- Dark phone: this week's queue (audience section) ---------- */
export function QueueMock() {
  const rows = [
    ["Festive saree reel", "Tue · 7:30 PM", "#f6a46a"],
    ["Kurta set — studio", "Wed · 11:00 AM", "#8771ff"],
    ["Jewellery flat lay", "Fri · 6:00 PM", "#ff8fa8"],
    ["Weekend offer ad", "Sat · 9:00 AM", "#1ba672"],
  ];
  return (
    <svg viewBox="0 0 601 914" preserveAspectRatio="xMidYMin slice" style={svgStyle} role="img" aria-label="Weekly post queue">
      <rect x="95" y="64" width="411" height="900" rx="64" fill={INK} />
      <Mark x={128} y={104} s={36} />
      <text x="176" y="132" fontFamily={FD} fontSize="26" fontWeight="600" fill="#fff" letterSpacing="-1">
        Brandef<tspan fill={P2} fontWeight="800">AI</tspan>
      </text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x="440" y={112 + i * 9} width="28" height="3.5" rx="1.75" fill="#fff" />
      ))}
      <text x="300" y="214" textAnchor="middle" fontFamily={FD} fontSize="32" fontWeight="500" fill="#fff" letterSpacing="-1">Your queue</text>
      <text x="300" y="254" textAnchor="middle" fontFamily={FD} fontSize="32" fontWeight="500" fill="#fff" letterSpacing="-1">this week</text>
      {rows.map(([a, b, c], i) => (
        <g key={a} transform={`translate(118 ${296 + i * 124})`}>
          <rect width="365" height="106" rx="28" fill="#2b2b2c" />
          <rect x="14" y="13" width="80" height="80" rx="20" fill={c} />
          <circle cx="54" cy="46" r="16" fill="#fff" opacity=".85" />
          <text x="112" y="46" fontFamily={F} fontSize="21" fontWeight="600" fill="#fff">{a}</text>
          <text x="112" y="76" fontFamily={F} fontSize="19" fontWeight="600" fill="#dff08a">{b}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Small floating card: reel ready ---------- */
export function ReelCard() {
  return (
    <svg viewBox="0 0 363 290" style={svgStyle} role="img" aria-label="Reel ready">
      <g transform="rotate(-10 181 145)">
        <rect x="30" y="34" width="303" height="222" rx="28" fill="#fff" />
        <text x="56" y="82" fontFamily={F} fontSize="22" fontWeight="700" fill={INK}>Reel ready</text>
        <circle cx="296" cy="72" r="14" fill="#e6f6ee" />
        <path d="M289 72l5 5 9-10" fill="none" stroke="#1ba672" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="56" y="100" width="108" height="130" rx="16" fill="#fdecd0" />
        <path d="M96 140l36 20-36 20z" fill={P1} />
        <text x="184" y="132" fontFamily={F} fontSize="17" fill={GRAY}>9:16 · 12s</text>
        <text x="184" y="160" fontFamily={F} fontSize="17" fill={GRAY}>5 clips</text>
        <rect x="184" y="188" width="122" height="12" rx="6" fill={BG} />
        <rect x="184" y="188" width="104" height="12" rx="6" fill={P1} />
        <text x="184" y="222" fontFamily={F} fontSize="15" fontWeight="600" fill={P1}>Added to calendar</text>
      </g>
    </svg>
  );
}
