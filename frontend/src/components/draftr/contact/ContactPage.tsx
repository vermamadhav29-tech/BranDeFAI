import type { CSSProperties } from "react";
import Nav from "../home/Nav";
import Footer from "../home/Footer";
import DraftrEffects from "../DraftrEffects";
import ContactSection from "./ContactSection";
import FaqSection from "./FaqSection";

export default function ContactPage() {
  return (
    <>
<div id="main" data-framer-ssr-released-at="2026-03-23T17:40:18.516Z" data-framer-page-optimized-at="2026-03-30T06:59:37.838Z" data-framer-generated-page=""><div className="framer-r9OQp framer-p9accg" data-layout-template="true" style={{"minHeight":"100vh","width":"auto"} as CSSProperties}><Nav /><div data-framer-root="" className="framer-5Ya6C framer-lk9BK framer-UD0o4 framer-0twiF framer-xQC9B framer-g6BQX framer-gADTo framer-AfZXA framer-1cdvb9o" style={{"minHeight":"100vh","width":"auto","display":"contents"} as CSSProperties}><div className="framer-1a2wuee-container"><div></div></div><ContactSection /><FaqSection /></div><div id="overlay"></div><div className="framer-5bacvd"></div><Footer /></div><div id="template-overlay"></div></div>
      <DraftrEffects />
    </>
  );
}
