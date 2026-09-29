"use client";

import { useEffect, useState } from "react";
import { links } from "@/content/profile";
import { Moon, Sun } from "./Icons";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The theme lives on <html data-theme>, so CSS decides which icon shows — no React state needed.
  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: the switch still works for this visit */
    }
  };

  return (
    <header className={scrolled ? "scrolled" : undefined}>
      <div className="wrap nav">
        <a href="#top" className="logo" aria-label="Rishabh Kumar — back to top">
          <span className="logo-mark">RK</span>Rishabh Kumar
        </a>
        <nav className="menu" aria-label="Sections">
          <a href="#about">About</a>
          <a href="#experience">Experience</a>
          <a href="#work">Work</a>
          <a href="#principles">How I work</a>
          <a href="#skills">Skills</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="nav-right">
          <button className="icon-btn theme" type="button" onClick={toggleTheme} aria-label="Switch colour theme">
            <Sun className="sun" />
            <Moon className="moon" />
          </button>
          <a className="btn sm primary" href={links.resume} target="_blank" rel="noopener">
            Resume
          </a>
        </div>
      </div>
    </header>
  );
}
