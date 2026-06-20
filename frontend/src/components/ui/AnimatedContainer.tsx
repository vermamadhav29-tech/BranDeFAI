"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fadeIn, fadeInUp, staggerContainer } from "@/lib/animations";
import type { Variants } from "framer-motion";

const variantMap: Record<string, Variants> = {
  fadeIn,
  fadeInUp,
  stagger: staggerContainer,
};

interface AnimatedContainerProps {
  children: React.ReactNode;
  variant?: "fadeIn" | "fadeInUp" | "stagger";
  delay?: number;
  className?: string;
}

export default function AnimatedContainer({
  children,
  variant = "fadeInUp",
  delay = 0,
  className,
}: AnimatedContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chosen = variantMap[variant];

  return (
    <motion.div
      ref={ref}
      variants={chosen}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      custom={delay}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}
