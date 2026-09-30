"use client";

import { Fragment, useEffect, useRef, useState } from "react";

/** One big sentence that lights up word by word as it scrolls through the screen. */
export default function Statement({ text }: { text: string }) {
  const words = text.split(" ");
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = paragraph.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (vh * 0.78 - rect.top) / (rect.height + vh * 0.25)));
      setLit(Math.round(progress * words.length));
    };
    const first = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", onScroll);
    };
  }, [words.length]);

  return (
    <section className="statement">
      <p className="disp" ref={paragraph}>
        {words.map((word, i) => (
          <Fragment key={i}>
            <span className={i < lit ? "on" : undefined}>{word}</span>{" "}
          </Fragment>
        ))}
      </p>
    </section>
  );
}
