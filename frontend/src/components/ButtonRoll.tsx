"use client";

import { useEffect } from "react";

// App buttons get the same hover as the homepage buttons: the label rolls over to a copy
// of itself. The copy lives in an aria-hidden overlay appended to the button; React's own
// children are never moved or wrapped, so re-renders stay safe.
const SEL = ".bd-app .bd-btn, .bd-auth .bd-btn, .bd-onb .bd-btn";
const OVERLAY = "bd-roll-o";
const VERSION = "5"; // bump when the overlay markup changes so existing buttons rebuild

function sync(btn: HTMLElement) {
  let overlay = btn.querySelector<HTMLElement>(":scope > ." + OVERLAY);
  const own = Array.from(btn.childNodes).filter((n) => n !== overlay);
  // icon-only buttons (no text) keep their glyph; mark them so CSS can size them as a plain circle
  const hasText = own.some((n) => (n.textContent ?? "").trim() !== "");
  btn.classList.toggle("is-icon", !hasText && own.some((n) => n.nodeType === 1));
  if (!own.length) {
    overlay?.remove();
    return;
  }
  const sig = own.map((n) => (n.nodeType === 3 ? n.nodeValue : (n as Element).outerHTML)).join("") + VERSION;
  if (overlay && btn.dataset.rollSig === sig) return;
  if (!overlay) {
    overlay = document.createElement("span");
    overlay.className = OVERLAY;
    overlay.setAttribute("aria-hidden", "true");
    btn.appendChild(overlay);
  }
  overlay.replaceChildren(...own.map((n) => n.cloneNode(true)));
  // wrap each text run so the whole label can rise as one piece
  const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  texts.forEach((t) => {
    const span = document.createElement("span");
    span.className = "bd-ch";
    span.textContent = t.nodeValue;
    t.replaceWith(span);
  });
  btn.dataset.rollSig = sig;
}

export default function ButtonRoll() {
  useEffect(() => {
    let raf = 0;
    const scan = () => {
      raf = 0;
      document.querySelectorAll<HTMLElement>(SEL).forEach(sync);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(scan);
    };
    const mo = new MutationObserver((muts) => {
      // ignore our own overlay updates
      if (muts.every((m) => (m.target as Element).closest?.("." + OVERLAY) || (m.target as Element).classList?.contains(OVERLAY))) return;
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
