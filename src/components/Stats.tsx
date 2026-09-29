"use client";

import { useEffect, useRef } from "react";
import { stats } from "@/content/profile";

/** Numbers count up once when they scroll into view. Server-rendered with final values, so no-JS and crawlers see them. */
function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const frame = (t: number) => {
          const p = Math.min(1, (t - t0) / 900);
          el.textContent = `${Math.round(to * (1 - Math.pow(1 - p, 3)))}${suffix}`;
          if (p < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix]);

  return <b ref={ref}>{`${to}${suffix}`}</b>;
}

export default function Stats() {
  return (
    <div className="wrap stats">
      {stats.map((s) => (
        <div className="stat reveal" key={s.label}>
          <Counter to={s.to} suffix={s.suffix} />
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
