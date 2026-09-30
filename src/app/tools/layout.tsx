import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

// Every page under /tools: a plain header, the tool, and a line that leads back to the portfolio.
export default function ToolsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="top">
        <Link className="me" href="/">
          Rishabh Kumar
        </Link>
        <nav className="top-links" aria-label="Site">
          <Link href="/tools">Tools</Link>
          <Link href="/">Portfolio</Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="tools">{children}</main>

      <footer className="tools-foot">
        <p>
          Built and run by <b>Rishabh Kumar</b>, a backend engineer.
        </p>
        <Link className="btn small" href="/">
          See my work →
        </Link>
      </footer>
    </>
  );
}
