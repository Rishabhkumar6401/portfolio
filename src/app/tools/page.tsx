import type { Metadata } from "next";
import ToolList from "@/components/ToolList";
import { tools } from "@/content/tools";

const title = "Free developer tools";
const description =
  "Free tools for backend work: a webhook tester, a live cache test, JSON formatter, JWT decoder, Base64 converter, Unix timestamp converter and cron expression explainer. No sign-up.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tools" },
  openGraph: { title, description, url: "/tools", siteName: "Rishabh Kumar", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function ToolsPage() {
  return (
    <>
      <header className="tool-head">
        <span className="tag">Free, no sign-up</span>
        <h1 className="disp">
          Developer <i>tools</i>.
        </h1>
        <p>Tools for everyday backend work, built into this site. The first two run on a backend I wrote for them. The rest run in your browser.</p>
      </header>
      <ToolList tools={tools} />
    </>
  );
}
