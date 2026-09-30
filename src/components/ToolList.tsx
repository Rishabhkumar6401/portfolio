import Link from "next/link";
import type { Tool } from "@/content/tools";

/** The tools as a numbered list of links. Used on the home page, on /tools and under each tool. */
export default function ToolList({ tools, className }: { tools: Tool[]; className?: string }) {
  return (
    <ol className={className ? `tool-list ${className}` : "tool-list"}>
      {tools.map((tool, i) => (
        <li key={tool.slug}>
          <Link href={`/tools/${tool.slug}`}>
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <b>{tool.name}</b>
            <p>
              {tool.tagline}
              {tool.behind && <small>{tool.behind.stack}</small>}
            </p>
            <span className="go" aria-hidden="true">
              →
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
