import { ImageResponse } from "next/og";
import { apiProfile } from "@/content/profile";

// The preview image LinkedIn, WhatsApp, Slack and X show when someone shares the site.
// Generated once at build time; colours match the dark theme in globals.css.
export const alt = "Rishabh Kumar — Backend engineer building reliable APIs for AI products";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors = { bg: "#0e1016", text: "#eceef3", muted: "#a4aab7", accent: "#8c8cff", line: "#262a36" };
const footer = `${apiProfile.experience} · ${apiProfile.stack.slice(0, 5).join(" · ")}`;
const site = "rishabh-kumar.vercel.app";

/**
 * The site's font (Plus Jakarta Sans), trimmed by Google Fonts to just the characters on the image.
 * If the download fails, the build still succeeds with the default font.
 */
async function siteFont(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const fontUrl = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return fontUrl ? await (await fetch(fontUrl)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const text = `RK${apiProfile.name}Backend engineer building reliable APIs for AI products.${footer}${site}`;
  const [bold, regular] = await Promise.all([siteFont(800, text), siteFont(500, text)]);
  const fonts = [
    ...(bold ? [{ name: "Plus Jakarta Sans", data: bold, weight: 800 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Plus Jakarta Sans", data: regular, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: colors.bg,
          color: colors.text,
          fontFamily: "Plus Jakarta Sans",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 60,
              height: 60,
              borderRadius: 14,
              background: colors.text,
              color: colors.bg,
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            RK
          </div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{apiProfile.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 800, letterSpacing: -2, lineHeight: 1.12 }}>
          <div style={{ display: "flex" }}>Backend engineer building</div>
          <div style={{ display: "flex" }}>
            <span style={{ color: colors.accent }}>reliable APIs</span>
            <span>&nbsp;for AI products.</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${colors.line}`,
            paddingTop: 28,
            fontSize: 26,
            color: colors.muted,
          }}
        >
          <div style={{ display: "flex" }}>{footer}</div>
          <div style={{ display: "flex", color: colors.accent }}>{site}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
