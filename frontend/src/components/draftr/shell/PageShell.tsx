import type { CSSProperties, ReactNode } from "react";
import Nav from "../home/Nav";
import Footer from "../home/Footer";
import DraftrEffects from "../DraftrEffects";

/**
 * Shared marketing-page frame (nav, gradient hero, footer) built from the same
 * template classes as the Blog page, for pages that have no saved source of their own.
 */
export default function PageShell({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div id="main">
        <div className="framer-r9OQp framer-p9accg" data-layout-template="true" style={{ minHeight: "100vh", width: "auto" } as CSSProperties}>
          <Nav />
          <div data-framer-root="" className="framer-FHvIW framer-lk9BK framer-UD0o4 framer-rjlcl8" style={{ minHeight: "100vh", width: "auto", display: "contents" } as CSSProperties}>
            <section className="framer-3uutlt" data-framer-name="Hero Section">
              <div className="framer-1kl0lvx" data-framer-name="Container">
                <div className="framer-vl70td" data-framer-name="Hero Content">
                  {eyebrow ? (
                    <p style={{ margin: 0, fontFamily: '"Inter", sans-serif', fontSize: 15, fontWeight: 600, color: "#5235ef", letterSpacing: "0.02em" }}>{eyebrow}</p>
                  ) : null}
                  <div className="framer-bpc5jr" data-framer-name="Title" style={{ transform: "none" } as CSSProperties} data-framer-component-type="RichTextContainer">
                    <h1
                      className="framer-text framer-styles-preset-oau3bg"
                      data-styles-preset="M9gPMXsOZ"
                      style={{ "--framer-text-alignment": "center", "--framer-font-size": "clamp(34px, 5vw, 56px)" } as CSSProperties}
                    >
                      {title}
                    </h1>
                  </div>
                  {subtitle ? (
                    <div className="framer-13bpcu7" style={{ transform: "none" } as CSSProperties} data-framer-component-type="RichTextContainer">
                      <p className="framer-text framer-styles-preset-16wyjr7" data-styles-preset="lxrsgGPBZ" style={{ "--framer-text-alignment": "center" } as CSSProperties}>
                        {subtitle}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
            {children}
          </div>
          <Footer />
        </div>
      </div>
      <DraftrEffects />
    </>
  );
}

/** Reading column used by articles and legal pages. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <section style={{ width: "100%", padding: "20px 24px 120px", display: "flex", justifyContent: "center" }}>
      <div className="bd-prose" style={{ width: "100%", maxWidth: 760 }}>
        {children}
      </div>
    </section>
  );
}
