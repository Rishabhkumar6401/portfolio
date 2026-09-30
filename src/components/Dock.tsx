"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  ["work", "Work"],
  ["experience", "Experience"],
  ["about", "About"],
  ["tools", "Tools"],
  ["contact", "Contact"],
] as const;

/** The small floating menu at the bottom. It highlights the section currently on screen. */
export default function Dock({ resume }: { resume: string }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      let found: string | null = null;
      for (const [id] of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.5) found = id;
      }
      setCurrent(found);
    };
    const first = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={[current === id && "on", id === "tools" && "wide"].filter(Boolean).join(" ") || undefined}>
          {label}
        </a>
      ))}
      <a className="cv" href={resume} target="_blank" rel="noopener">
        Resume ↗
      </a>
    </nav>
  );
}
