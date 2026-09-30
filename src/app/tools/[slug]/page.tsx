import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ToolList from "@/components/ToolList";
import Base64Tool from "@/components/tools/Base64Tool";
import CacheTest from "@/components/tools/CacheTest";
import CronTool from "@/components/tools/CronTool";
import JsonFormatter from "@/components/tools/JsonFormatter";
import JwtDecoder from "@/components/tools/JwtDecoder";
import TimestampTool from "@/components/tools/TimestampTool";
import WebhookTester from "@/components/tools/WebhookTester";
import { AUTHOR, SITE_URL } from "@/content/site";
import { toolBySlug, tools } from "@/content/tools";

const TOOL_UI: Record<string, ReactNode> = {
  "webhook-tester": <WebhookTester />,
  "cache-test": <CacheTest />,
  "json-formatter": <JsonFormatter />,
  "jwt-decoder": <JwtDecoder />,
  base64: <Base64Tool />,
  "unix-timestamp": <TimestampTool />,
  "cron-expression": <CronTool />,
};

type Props = { params: Promise<{ slug: string }> };

// Only the tools in content/tools.ts exist. Any other address is a 404.
export const dynamicParams = false;
export const generateStaticParams = () => tools.map(({ slug }) => ({ slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = toolBySlug((await params).slug);
  if (!tool) return {};
  const { title, description } = tool;
  const url = `/tools/${tool.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: AUTHOR, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ToolPage({ params }: Props) {
  const tool = toolBySlug((await params).slug);
  if (!tool || !TOOL_UI[tool.slug]) notFound();

  // The headline style of the site: the last word in italics.
  const lastSpace = tool.name.lastIndexOf(" ");

  // Tells search engines that this page is a free web tool and what its questions and answers are.
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.name,
      url: `${SITE_URL}/tools/${tool.slug}`,
      description: tool.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@type": "Person", name: AUTHOR, url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: tool.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];

  return (
    <>
      <Link className="back" href="/tools">
        ← All tools
      </Link>
      <header className="tool-head">
        <h1 className="disp">
          {tool.name.slice(0, lastSpace + 1)}
          <i>{tool.name.slice(lastSpace + 1)}</i>.
        </h1>
        <p>{tool.intro}</p>
        <small>{tool.where}</small>
      </header>

      {TOOL_UI[tool.slug]}

      {tool.behind && (
        <section className="behind" id="behind">
          <h2 className="disp">
            Behind the <i>scenes</i>.
          </h2>
          <dl>
            {tool.behind.points.map((point) => (
              <div key={point.label}>
                <dt>{point.label}</dt>
                <dd>{point.text}</dd>
              </div>
            ))}
          </dl>
          <small>{tool.behind.stack}</small>
        </section>
      )}

      <section className="tool-text">
        <div>
          {tool.sections.map((section) => (
            <article key={section.heading}>
              <h3>{section.heading}</h3>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </div>
        <div>
          <h3>Questions</h3>
          <dl>
            {tool.faq.map(({ q, a }) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="more-tools">
        <h2 className="disp">
          More <i>tools</i>.
        </h2>
        <ToolList tools={tools.filter((other) => other.slug !== tool.slug)} />
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    </>
  );
}
