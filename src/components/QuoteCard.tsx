"use client";

import { useState } from "react";
import { quotes } from "@/content/profile";

export default function QuoteCard() {
  const [index, setIndex] = useState(0);
  const [swapping, setSwapping] = useState(false);

  const next = () => {
    let n = index;
    while (n === index) n = Math.floor(Math.random() * quotes.length);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setIndex(n);
    setSwapping(true);
    window.setTimeout(() => {
      setIndex(n);
      setSwapping(false);
    }, 230);
  };

  const [text, by] = quotes[index];
  return (
    <figure className={`quote reveal${swapping ? " swap" : ""}`}>
      <div className="q-label">Words to build by</div>
      <blockquote aria-live="polite">{text}</blockquote>
      <figcaption>— {by}</figcaption>
      <button className="q-next" type="button" onClick={next}>
        Another one <span aria-hidden="true">↻</span>
      </button>
    </figure>
  );
}
