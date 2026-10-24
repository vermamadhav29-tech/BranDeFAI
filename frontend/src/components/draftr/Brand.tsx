// BrandefAI wordmark: "Brandef" in the display weight, "AI" in extra-bold accent.
export default function Brand({
  tone = "dark",
  size = 24,
  markOnly = false,
}: {
  tone?: "dark" | "light";
  size?: number;
  markOnly?: boolean;
}) {
  const ink = tone === "dark" ? "#101011" : "#ffffff";
  const box = Math.round(size * 1.2);
  return (
    <span
      aria-label="BrandefAI"
      style={{
        display: "flex",
        height: "100%",
        width: "max-content",
        alignItems: "center",
        gap: Math.round(size * 0.36),
        fontFamily: '"Inter Display", "Inter Display Placeholder", sans-serif',
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.04em",
        color: ink,
        whiteSpace: "nowrap",
      }}
    >
      {/* CSS gradient (not an SVG gradient id) so it renders in every responsive copy of the header */}
      <span
        aria-hidden
        style={{
          width: box,
          height: box,
          flexShrink: 0,
          borderRadius: Math.round(box * 0.28),
          background: "linear-gradient(135deg, #5235ef 0%, #8771ff 100%)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width={box * 0.78} height={box * 0.78} viewBox="0 0 32 32">
          <path d="M16 6.5l2.2 6.3 6.3 2.2-6.3 2.2L16 23.5l-2.2-6.3L7.5 15l6.3-2.2L16 6.5z" fill="#fff" />
          <circle cx="24" cy="8" r="1.8" fill="#fff" opacity=".85" />
        </svg>
      </span>
      {markOnly ? null : (
        <span>
          <span style={{ fontWeight: 600 }}>Brandef</span>
          <span style={{ fontWeight: 800, color: tone === "dark" ? "#5235ef" : "#8771ff" }}>AI</span>
        </span>
      )}
    </span>
  );
}
