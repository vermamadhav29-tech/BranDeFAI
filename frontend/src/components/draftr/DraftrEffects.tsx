"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FAQ_ANSWERS } from "./faq";
import { EXTRA_POSTS } from "./blogExtra";
import { PHONE_MENU_LINKS, PHONE_MENU_OVERLAY } from "./phoneMenu";
import { TESTIMONIALS } from "./testimonials";

// Re-creates the runtime behaviour of the original Framer site:
// appear/scroll-reveal animations, word + digit staggers, logo ticker, hover variants.

const APPEAR: Record<string, { delay: [number, number, number]; duration: [number, number, number] }> = {
  // id: [desktop, tablet, phone]
  naz84: { delay: [0.2, 0.2, 0.1], duration: [0.8, 0.8, 0.6] },
  "1vnmjh7": { delay: [1, 1, 0.4], duration: [1, 1, 0.6] },
  fcvjf6: { delay: [1.2, 1.2, 0.4], duration: [1, 1, 0.6] },
  "1f7m5m3": { delay: [1.2, 1.2, 0.5], duration: [1, 1, 0.6] },
  "10bnp6l": { delay: [1.6, 1.6, 0.7], duration: [1, 1, 0.6] },
};

const SPRING = "cubic-bezier(0.34, 1.35, 0.64, 1)"; // bounce 0.2 spring approximation
const EASE_OUT = "cubic-bezier(0.44, 0, 0.56, 1)";

function bp(): 0 | 1 | 2 {
  const w = window.innerWidth;
  return w >= 1200 ? 0 : w >= 810 ? 1 : 2;
}

function reveal(el: HTMLElement, delay: number, duration: number, easing = SPRING) {
  const fromTransform = el.style.transform;
  const fromFilter = el.style.filter;
  const anim = el.animate(
    [
      { opacity: Number(el.style.opacity) || 0.001, transform: fromTransform || "none", filter: fromFilter || "none" },
      { opacity: 1, transform: "none", filter: "none" },
    ],
    { duration: duration * 1000, delay: delay * 1000, easing, fill: "both" },
  );
  anim.onfinish = () => {
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.filter = "none";
    anim.cancel();
  };
}

export default function DraftrEffects() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const root = document.getElementById("main");
    if (!root) return;

    // 1. Appear animations (hero) -----------------------------------------
    const appearEls = root.querySelectorAll<HTMLElement>("[data-framer-appear-id]");
    appearEls.forEach((el) => {
      const id = el.getAttribute("data-framer-appear-id") || "";
      const card = /^yx97tn-(\d+)$/.exec(id);
      if (card) {
        // blog cards: staggered spring, 0.1s apart
        reveal(el, 0.2 + 0.1 * (Number(card[1]) % 6), 0.6);
        return;
      }
      const cfg = APPEAR[id];
      if (!cfg) return;
      const i = bp();
      reveal(el, cfg.delay[i], cfg.duration[i]);
    });

    // tag Framer "text-roll" buttons (two stacked labels + arrow swap)
    root.querySelectorAll<HTMLElement>("a, button").forEach((a) => {
      const rt = Array.from(a.children).filter((c) => c.getAttribute("data-framer-component-type") === "RichTextContainer") as HTMLElement[];
      if (rt.length >= 2 && rt[0].textContent === rt[1].textContent && rt[1].style.opacity === "0") a.setAttribute("data-framer-btn", "");
    });

    // 2. Scroll reveals ------------------------------------------------------
    const isHidden = (el: HTMLElement) => {
      const o = el.style.opacity;
      return o === "0" || o === "0.001";
    };
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[style]")).filter(
      (el) => isHidden(el) && !el.hasAttribute("data-framer-appear-id") && el.tagName !== "LI" && !el.closest("li") && !el.closest("[data-framer-btn]"),
    );
    const roots = targets.filter((el) => !el.parentElement?.closest("[style*='opacity: 0']"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          // staggered children (word / digit spans) share a parent
          const sibs = el.parentElement
            ? Array.from(el.parentElement.children).filter((c) => (c as HTMLElement).style?.display === "inline-block")
            : [];
          const idx = Math.max(0, sibs.indexOf(el));
          const isFlip = el.style.transform.includes("rotateY(90deg)");
          const isWord = el.style.display === "inline-block";
          const delay = isWord ? idx * (isFlip ? 0.03 : 0.05) : 0;
          reveal(el, delay, isWord ? 0.6 : 0.8);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -2% 0px" },
    );
    roots.forEach((el) => {
      // hero words are above the fold and start after the tagline
      io.observe(el);
    });
    cleanups.push(() => io.disconnect());

    // 3. Logo ticker ---------------------------------------------------------
    root.querySelectorAll<HTMLElement>("section > ul").forEach((ul) => {
      const wrap = ul.parentElement as HTMLElement;
      if (!wrap.style.maskImage && !(wrap.style as CSSStyleDeclaration & { webkitMaskImage?: string }).webkitMaskImage) return;
      const items = Array.from(ul.children) as HTMLElement[];
      if (!items.length) return;
      const gap = 50;
      const setW = items.reduce((s, li) => s + li.getBoundingClientRect().width + gap, 0);
      // duplicate until the track is wide enough for a seamless loop
      const copies = Math.ceil((wrap.clientWidth * 2) / setW) + 1;
      for (let c = 0; c < copies; c++) items.forEach((li) => ul.appendChild(li.cloneNode(true)));
      wrap.style.opacity = "1";
      const speed = 40; // px / second
      let raf = 0;
      let last = performance.now();
      let x = 0;
      const tick = (now: number) => {
        x -= ((now - last) / 1000) * speed;
        last = now;
        if (-x >= setW) x += setW;
        ul.style.transform = `translateX(${x}px)`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      cleanups.push(() => cancelAnimationFrame(raf));
    });

    // 4. Hover variants --------------------------------------------------------
    const hoverables = root.querySelectorAll<HTMLElement>("[data-framer-btn]");
    hoverables.forEach((el) => {
      const rts = Array.from(el.children).filter((c) => c.getAttribute("data-framer-component-type") === "RichTextContainer") as HTMLElement[];
      const t1 = rts[0] ?? null;
      const t2 = rts[1] ?? null;
      const arrowIn = el.querySelector<HTMLElement>(".framer-1fqvifk");
      const arrowOut = el.querySelector<HTMLElement>(".framer-11ocdt1");
      const trans = `opacity .35s ${EASE_OUT}, transform .35s ${EASE_OUT}`;
      [t1, t2, arrowIn].forEach((n) => n && (n.style.transition = trans));
      // incoming arrow slides in from the left (the .hover class moves it left:-13px -> 8px); outgoing one exits right
      if (arrowOut) arrowOut.style.transition = trans + `, left .35s ${EASE_OUT}`;
      // each label keeps its own horizontal offset (the 2nd one is positioned at left:50%)
      const tx1 = t1 && t1.style.transform.includes("translateX(-50%)") ? "translateX(-50%) " : "";
      const tx2 = t2 && t2.style.transform.includes("translateX(-50%)") ? "translateX(-50%) " : "";
      // The template's .hover class swaps which label is positioned, so the labels jump mid-fade.
      // Pin both labels to their resting layout and let only opacity/transform animate.
      [t1, t2].forEach((n) => {
        if (!n) return;
        const cs = getComputedStyle(n);
        (["position", "left", "top", "bottom", "z-index"] as const).forEach((prop) => n.style.setProperty(prop, cs.getPropertyValue(prop), "important"));
      });
      if (t1 && t2) {
        // align the absolutely-positioned label vertically with the in-flow one
        t2.style.setProperty("bottom", "auto", "important");
        t2.style.setProperty("top", t1.offsetTop + "px", "important");
      }
      const on = () => {
        el.classList.add("hover");
        if (t1) { t1.style.opacity = "0"; t1.style.transform = tx1 + "perspective(500px) rotateX(60deg)"; }
        if (t2) { t2.style.opacity = "1"; t2.style.transform = tx2 + "perspective(500px)"; }
        if (arrowIn) { arrowIn.style.opacity = "0"; arrowIn.style.transform = "translateX(24px)"; }
        if (arrowOut) arrowOut.style.opacity = "1";
      };
      const off = () => {
        el.classList.remove("hover");
        if (t1) { t1.style.opacity = "1"; t1.style.transform = tx1 + "perspective(500px)"; }
        if (t2) { t2.style.opacity = "0"; t2.style.transform = tx2 + "perspective(500px) rotateX(-60deg)"; }
        if (arrowIn) { arrowIn.style.opacity = "1"; arrowIn.style.transform = "none"; }
        if (arrowOut) arrowOut.style.opacity = "0";
      };
      el.addEventListener("mouseenter", on);
      el.addEventListener("mouseleave", off);
      cleanups.push(() => {
        el.removeEventListener("mouseenter", on);
        el.removeEventListener("mouseleave", off);
      });
    });


    // 5. Integration connector paths (code component in the original) ---------
    const PATHS: Record<string, [string, string]> = {
      "1ofnu4y": ["0 0 501 200", "M1 0c0 150 250 75 250 200"],
      se1vy1: ["0 0 500 200", "M250 200c0-125-150-50-150-200"],
      "8kqejq": ["0 0 500 200", "M250 200c0-125-50-50-50-200"],
      vuordy: ["0 0 500 200", "M250 200c0-125 50-50 50-200"],
      hgyyj3: ["0 0 500 200", "M250 200c0-125 150-50 150-200"],
      "4j6m4t": ["0 0 501 200", "M250 200c0-125 250-50 250-200"],
    };
    const NS = "http://www.w3.org/2000/svg";
    Object.entries(PATHS).forEach(([id, [vb, d]]) => {
      root.querySelectorAll<HTMLElement>(".framer-" + id + "-container").forEach((box) => {
        if (box.querySelector("svg")) return;
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", vb);
        svg.setAttribute("style", "width:100%;height:100%;display:block");
        const mk = (extra: Record<string, string>) => {
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", d);
          p.setAttribute("stroke-width", "1.5");
          p.setAttribute("stroke-linejoin", "round");
          p.setAttribute("stroke-linecap", "round");
          p.setAttribute("fill", "transparent");
          Object.entries(extra).forEach(([k, v]) => p.setAttribute(k, v));
          svg.appendChild(p);
          return p;
        };
        mk({ stroke: "rgba(82, 53, 239, 0.2)" });
        const runner = mk({ stroke: "rgb(82, 53, 239)", "stroke-dasharray": "30 100", pathLength: "100" });
        runner.animate(
          [
            { strokeDashoffset: 160, opacity: 0 },
            { strokeDashoffset: 158, opacity: 1, offset: 0.08 },
            { strokeDashoffset: 40, opacity: 1, offset: 0.78 },
            { strokeDashoffset: 30, opacity: 0 },
          ],
          { duration: 2320, iterations: Infinity, easing: "cubic-bezier(0.55, 0, 0.45, 1)" },
        );
        box.appendChild(svg);
      });
    });

    // 6. Testimonial carousel ------------------------------------------------
    root.querySelectorAll<HTMLElement>("[data-framer-name^='Testimonial ']").forEach((card) => {
      const avatars = Array.from(card.querySelectorAll<HTMLElement>("[data-framer-name='Avatar Image']"));
      const quote = card.querySelector<HTMLElement>("p[data-styles-preset='lxrsgGPBZ']");
      const nameEl = card.querySelector<HTMLElement>("p[data-styles-preset='BsCtaLVGw']");
      if (!avatars.length || !quote || !nameEl) return;
      let cur = 0;
      let timer: ReturnType<typeof setInterval>;
      avatars.forEach((a) => (a.style.transition = "width .3s " + EASE_OUT + ", height .3s " + EASE_OUT + ", opacity .3s " + EASE_OUT));
      const paint = () => {
        avatars.forEach((a, i) => {
          const on = i === cur;
          a.style.width = a.style.height = on ? "52px" : "42px";
          a.style.opacity = on ? "1" : "0.4";
          const ring = a.firstElementChild as HTMLElement | null;
          ring?.style.setProperty("--border-color", on ? "rgb(82, 53, 239)" : "rgba(82, 53, 239, 0)");
          a.style.cursor = "pointer";
        });
      };
      const show = (i: number) => {
        cur = i;
        paint();
        const t = TESTIMONIALS[i % TESTIMONIALS.length];
        [quote, nameEl].forEach((el) => {
          el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: EASE_OUT });
        });
        quote.textContent = t.quote;
        nameEl.textContent = t.name;
      };
      const start = () => {
        clearInterval(timer);
        timer = setInterval(() => show((cur + 1) % avatars.length), 3000);
      };
      avatars.forEach((a, i) =>
        a.addEventListener("click", () => {
          show(i);
          start();
        }),
      );
      paint();
      start();
      cleanups.push(() => clearInterval(timer));
    });

    // 7. Pricing toggle --------------------------------------------------------
    const YEARLY = [19, 49, 79];
    const MONTHLY = [29, 69, 89];
    const priceBoxes = Array.from(root.querySelectorAll<HTMLElement>("span")).filter((sp) => {
      const k = Array.from(sp.children) as HTMLElement[];
      return k.length >= 3 && k.every((c) => c.tagName === "SPAN" && c.style.display === "inline-block") && k[0].textContent === "$";
    });
    root.querySelectorAll<HTMLElement>("[data-framer-name='Toggle']").forEach((tg) => {
      const knob = tg.querySelector<HTMLElement>(".framer-pi9w4l");
      if (!knob) return;
      let yearly = true;
      knob.style.transition = "transform .3s " + EASE_OUT + ", background-color .3s " + EASE_OUT;
      tg.style.cursor = "pointer";
      const flip = () => {
        yearly = !yearly;
        knob.style.transform = yearly ? "none" : "translateX(-28px)";
        knob.style.backgroundColor = yearly ? "rgb(82, 53, 239)" : "rgb(255, 255, 255)";
        priceBoxes.forEach((box, idx) => {
          const val = String((yearly ? YEARLY : MONTHLY)[idx % 3]);
          const digits = (Array.from(box.children) as HTMLElement[]).slice(1);
          digits.forEach((d, i) => {
            d.textContent = val[i] ?? "";
            d.animate(
              [{ opacity: 0.001, transform: "rotateY(90deg)" }, { opacity: 1, transform: "none" }],
              { duration: 600, delay: i * 40, easing: SPRING, fill: "both" },
            );
          });
        });
      };
      tg.addEventListener("click", flip);
      tg.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && flip());
    });


    // 8. Ambient loops (measured from the original site) -------------------------
    // Floating cursor tags: linear ping-pong, ~4.9s each way.
    const FLOAT: Array<[string, number, number, number]> = [
      ["1a6stmn", 29.5, 0, 0],
      ["kqyn4f", -29.5, 29.5, 0],
      ["1sodgza", -29.4, 14.7, 0],
      ["aq87w1", -29.6, 14.8, 0],
      ["1x560ji", -24.5, -24.5, 12],
      ["cprzte", 0, 19.5, 0],
      ["19mli30", -14.7, -14.7, 0],
    ];
    FLOAT.forEach(([cls, dx, dy, rot]) => {
      root.querySelectorAll<HTMLElement>(".framer-" + cls).forEach((el) => {
        const r = rot ? " rotate(" + rot + "deg)" : "";
        el.animate(
          [{ transform: "translate(0px, 0px)" + r }, { transform: "translate(" + dx + "px, " + dy + "px)" + r }],
          { duration: 4900, iterations: Infinity, direction: "alternate", easing: "linear" },
        );
      });
    });
    // Emoji pulse: hold 0.7, spring to 1, hold, ease back (4s cycle).
    root.querySelectorAll<HTMLElement>(".framer-1v2s984").forEach((el) => {
      el.animate(
        [
          { transform: "scale(0.7)", offset: 0, easing: "linear" },
          { transform: "scale(0.7)", offset: 0.3, easing: SPRING },
          { transform: "scale(1)", offset: 0.5, easing: "linear" },
          { transform: "scale(1)", offset: 0.8, easing: EASE_OUT },
          { transform: "scale(0.7)", offset: 1 },
        ],
        { duration: 4040, iterations: Infinity },
      );
    });

    // 9. Scroll-linked orbit (Real-time collaboration card) -----------------------
    const orbits = Array.from(root.querySelectorAll<HTMLElement>("[data-framer-name='Avatar Hover']"));
    if (orbits.length) {
      const cur = new Map<HTMLElement, number>();
      let raf = 0;
      let last = performance.now();
      const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        let moving = false;
        orbits.forEach((g) => {
          const r = g.getBoundingClientRect();
          if (r.width === 0) return;
          const center = r.top + r.height / 2;
          const target = center > 560 ? 0 : (560 - center) * 0.19077;
          const prev = cur.get(g) ?? target;
          const next = prev + (target - prev) * (1 - Math.exp(-dt / 0.14));
          cur.set(g, next);
          if (Math.abs(target - next) > 0.01) moving = true;
          g.style.transform = "scale(0.9) rotate(" + next + "deg)";
          g.querySelectorAll<HTMLElement>(":scope > [data-framer-name='Avatar']").forEach((a) => {
            a.style.transform = "rotate(" + -next + "deg)";
          });
        });
        raf = requestAnimationFrame(frame);
        void moving;
      };
      raf = requestAnimationFrame(frame);
      cleanups.push(() => cancelAnimationFrame(raf));
    }


    // current page highlight in nav + footer
    root.querySelectorAll<HTMLAnchorElement>("header a[href], footer a[href]").forEach((a) => {
      const h = a.getAttribute("href") || "";
      if (h === pathname) a.setAttribute("data-framer-page-link-current", "true");
      else if (h.startsWith("/")) a.removeAttribute("data-framer-page-link-current");
    });

    // 10. Client-side navigation for internal links ---------------------------------
    const onLinkClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/") || a.target === "_blank") return;
      e.preventDefault();
      router.push(href);
    };
    root.addEventListener("click", onLinkClick);
    cleanups.push(() => root.removeEventListener("click", onLinkClick));

    // 11. FAQ accordion (independent items, spring-ish height) ------------------------
    const closedV = "framer-v-a0m6b3";
    const openV = "framer-v-46lmtf";
    const faqCards = Array.from(root.querySelectorAll<HTMLElement>("[data-framer-name='Desktop - Close']"));
    faqCards.forEach((card, idx) => {
      const q = card.querySelector<HTMLElement>("[data-framer-name='question']");
      const bar = card.querySelector<HTMLElement>(".framer-1d84p0r");
      if (!q) return;
      q.style.cursor = "pointer";
      if (bar) bar.style.transition = "transform .3s " + EASE_OUT;
      const toggle = () => {
        const isOpen = card.classList.contains(openV);
        const existing = card.querySelector<HTMLElement>(":scope > [data-framer-name='answer']");
        if (isOpen) {
          card.classList.replace(openV, closedV);
          card.setAttribute("data-framer-name", "Desktop - Close");
          if (bar) bar.style.transform = "none";
          if (existing) {
            const h = existing.offsetHeight;
            existing.style.overflow = "hidden";
            existing
              .animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 250, easing: EASE_OUT })
              .finished.then(() => existing.remove());
          }
        } else {
          card.classList.replace(closedV, openV);
          card.setAttribute("data-framer-name", "Desktop - Open");
          if (bar) bar.style.transform = "rotate(90deg)";
          const ans = document.createElement("div");
          ans.className = "framer-1xykk9k";
          ans.setAttribute("data-framer-name", "answer");
          ans.innerHTML =
            '<div class="framer-1ex3elh" data-framer-component-type="RichTextContainer" style="--framer-link-text-color:rgb(0,153,255);--framer-link-text-decoration:underline;transform:none"><p class="framer-text framer-styles-preset-1dpgerj" data-styles-preset="HK62ugKMT"></p></div>';
          ans.querySelector("p")!.textContent = FAQ_ANSWERS[idx % FAQ_ANSWERS.length];
          card.appendChild(ans);
          ans.style.overflow = "hidden";
          const h = ans.offsetHeight;
          ans
            .animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 300, easing: SPRING })
            .finished.then(() => {
              ans.style.overflow = "";
            });
        }
      };
      q.addEventListener("click", toggle);
      q.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle()));
    });

    // 12. Contact form ---------------------------------------------------------------
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".framer-form-input").forEach((inp) => {
      const sync = () => inp.classList.toggle("framer-form-input-empty", inp.value === "");
      inp.addEventListener("input", sync);
    });
    root.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) return form.reportValidity();
        const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
        const body = encodeURIComponent(
          "Name: " + v("name") + "\nEmail: " + v("email") + "\nCompany: " + v("company") + "\nPhone: " + v("phone") + "\n\n" + v("message"),
        );
        window.location.href = "mailto:support@brandefai.com?subject=" + encodeURIComponent("Message from " + v("name")) + "&body=" + body;
      });
    });

    // 13. Blog: card hover + Load More ----------------------------------------------------
    const bindCard = (card: HTMLElement) => {
      const img = card.querySelector<HTMLElement>(".framer-z9kpsg");
      if (!img) return;
      img.style.transition = "transform .4s " + EASE_OUT;
      card.addEventListener("mouseenter", () => {
        card.querySelector(".framer-QTBv0")?.classList.add("hover");
        img.style.transform = "scale(1.03)";
      });
      card.addEventListener("mouseleave", () => {
        card.querySelector(".framer-QTBv0")?.classList.remove("hover");
        img.style.transform = "none";
      });
    };
    root.querySelectorAll<HTMLElement>("a.framer-yx97tn").forEach(bindCard);
    const grid = root.querySelector<HTMLElement>(".framer-2lkdeh");
    Array.from(root.querySelectorAll<HTMLElement>("p"))
      .filter((p) => p.textContent === "Load More")
      .forEach((p) => {
        const btn = p.closest("button, a, [data-highlight]") as HTMLElement | null;
        const holder = grid && btn ? (Array.from(grid.children).find((c) => c.contains(btn)) as HTMLElement | undefined) : undefined;
        if (!btn || !holder || !grid || btn.hasAttribute("data-load-more")) return;
        btn.setAttribute("data-load-more", "");
        btn.style.cursor = "pointer";
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          EXTRA_POSTS.forEach((html) => {
            const tpl = document.createElement("template");
            tpl.innerHTML = html;
            const card = tpl.content.firstElementChild as HTMLElement;
            grid.insertBefore(card, holder);
            bindCard(card);
            card.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: SPRING });
          });
          holder.remove();
        });
      });

    // 14. Phone navigation menu ---------------------------------------------------------
    const phoneHeader = root.querySelector<HTMLElement>("header[data-framer-name='Navigation Close - Phone']");
    if (phoneHeader) {
      const icon = phoneHeader.querySelector<HTMLElement>("[data-framer-name='Icon']");
      const nav = phoneHeader.querySelector<HTMLElement>("nav");
      const top = phoneHeader.querySelector<HTMLElement>(".framer-jttex1");
      const bBot = phoneHeader.querySelector<HTMLElement>(".framer-4c0k9z");
      const bTop = phoneHeader.querySelector<HTMLElement>(".framer-1k59g45");
      let panel: HTMLElement | null = null;
      let overlay: HTMLElement | null = null;
      const close = () => {
        if (!panel) return;
        const p = panel;
        const o = overlay;
        panel = overlay = null;
        phoneHeader.className = phoneHeader.className.replace("framer-v-1cml3ff", "framer-v-mz5kpx");
        phoneHeader.setAttribute("data-framer-name", "Navigation Close - Phone");
        if (bBot) { bBot.style.transform = "none"; bBot.style.borderRadius = "10px"; }
        if (bTop) { bTop.style.transform = "none"; bTop.style.borderRadius = "10px"; }
        p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(() => p.remove());
        o?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(() => o.remove());
      };
      const open = () => {
        if (panel || !nav || !top) return;
        phoneHeader.className = phoneHeader.className.replace("framer-v-mz5kpx", "framer-v-1cml3ff");
        phoneHeader.setAttribute("data-framer-name", "Navigation - Phone");
        const t = document.createElement("template");
        t.innerHTML = PHONE_MENU_LINKS;
        panel = t.content.firstElementChild as HTMLElement;
        top.after(panel);
        const t2 = document.createElement("template");
        t2.innerHTML = PHONE_MENU_OVERLAY;
        overlay = t2.content.firstElementChild as HTMLElement;
        nav.after(overlay);
        overlay.addEventListener("click", close);
        panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
        panel.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: EASE_OUT });
        overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        [bBot, bTop].forEach((b) => b && (b.style.transition = "transform .3s " + EASE_OUT + ", border-radius .3s " + EASE_OUT));
        if (bBot) { bBot.style.transform = "rotate(45deg)"; bBot.style.borderRadius = "50% / 500%"; }
        if (bTop) { bTop.style.transform = "rotate(-45deg)"; bTop.style.borderRadius = "50% / 500%"; }
      };
      icon?.addEventListener("click", () => (panel ? close() : open()));
      icon?.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), panel ? close() : open()));
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
      const mq = window.matchMedia("(min-width: 810px)");
      const onMq = () => mq.matches && close();
      window.addEventListener("keydown", onKey);
      mq.addEventListener("change", onMq);
      cleanups.push(() => {
        window.removeEventListener("keydown", onKey);
        mq.removeEventListener("change", onMq);
      });
    }


    // 15. Header hides on scroll down and returns on scroll up (as in the original) -------
    const headerWraps = Array.from(root.querySelectorAll<HTMLElement>(".framer-11hb6jp-container"));
    headerWraps.forEach((w) => (w.style.transition = "transform .35s cubic-bezier(0.25, 1, 0.5, 1)"));
    let lastY = window.scrollY;
    let hidden = false;
    const setHeader = (hide: boolean) => {
      if (hide === hidden) return;
      hidden = hide;
      headerWraps.forEach((w) => (w.style.transform = hide ? "translateY(-80px)" : "none"));
    };
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (y <= 0) return setHeader(false);
      if (Math.abs(dy) < 2) return;
      const menuOpen = !!root.querySelector("header[data-framer-name='Navigation - Phone']");
      setHeader(dy > 0 && !menuOpen);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    return () => cleanups.forEach((fn) => fn());
  }, [router, pathname]);

  return null;
}
