// Shared route-loading skeleton for the app (matches the card layout used across pages).
export default function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="bd-flow" aria-busy="true" aria-label="Loading">
      <div style={{ padding: "8px 0 4px", display: "grid", gap: 10 }}>
        <div className="bd-skel" style={{ width: 280, maxWidth: "70%", height: 34, borderRadius: 12 }} />
        <div className="bd-skel" style={{ width: 420, maxWidth: "90%", height: 16 }} />
      </div>
      <div className="bd-grid-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bd-card" style={{ display: "grid", gap: 14, minHeight: 150 }}>
            <div className="bd-skel" style={{ width: 40, height: 40, borderRadius: 14 }} />
            <div className="bd-skel" style={{ width: "55%", height: 16 }} />
            <div className="bd-skel" style={{ width: "80%", height: 12 }} />
          </div>
        ))}
      </div>
      <div className="bd-card" style={{ display: "grid", gap: 12 }}>
        <div className="bd-skel" style={{ width: 200, height: 20 }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bd-skel" style={{ height: 48, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  );
}
