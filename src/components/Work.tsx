"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Project } from "@/content/profile";

/**
 * The project slides. The section is several screens tall and its content stays pinned, so scrolling
 * moves through the projects one at a time. components/Scene.tsx reads the same scroll position to
 * bring in the matching 3D object.
 */
export default function Work({ projects, note }: { projects: Project[]; note: string }) {
  const section = useRef<HTMLElement>(null);
  const fill = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = section.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (rect.height - window.innerHeight)));
      setActive(Math.min(projects.length - 1, Math.floor(progress * projects.length)));
      if (fill.current) fill.current.style.transform = `scaleX(${progress})`;
    };
    const first = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", onScroll);
    };
  }, [projects.length]);

  const two = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="work" id="work" ref={section} style={{ "--slides": projects.length } as CSSProperties}>
      <div className="pin">
        <div className="panes">
          {projects.map((p, i) => (
            <article className={i === active ? "pane on" : "pane"} key={p.title}>
              <span className="tag">{p.tag}</span>
              <h2 className="disp">{p.title}</h2>
              <dl className="case">
                <div>
                  <dt>Problem</dt>
                  <dd>{p.problem}</dd>
                </div>
                <div>
                  <dt>What I built</dt>
                  <dd>{p.built}</dd>
                </div>
                <div>
                  <dt>How it works</dt>
                  <dd>{p.how}</dd>
                </div>
              </dl>
              <small>{p.stack}</small>
            </article>
          ))}
        </div>
        <div className="rail" aria-hidden="true">
          <b>{two(active + 1)}</b>
          <span>
            <i ref={fill} />
          </span>
          {two(projects.length)}
          <em>{note}</em>
        </div>
      </div>
    </section>
  );
}
