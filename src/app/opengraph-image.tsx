import { ImageResponse } from "next/og";
import { apiProfile, hero } from "@/content/profile";

// The preview image LinkedIn, WhatsApp, Slack and X show when someone shares the site.
// Generated once at build time; colours match the light theme in globals.css.
export const alt = "Rishabh Kumar, backend engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors = { bg: "#F2F4EC", ink: "#0F1C15", mute: "#5A665E", accent: "#C6F06A", line: "rgba(15,28,21,0.16)" };
const footer = "REST APIs, background jobs and integrations";
const site = "rishabh-kumar.vercel.app";

/**
 * One of the site's fonts, trimmed by Google Fonts to just the characters on the image.
 * If the download fails, the build still succeeds with the default font.
 */
async function googleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const fontUrl = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return fontUrl ? await (await fetch(fontUrl)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const { first, before, accent, after } = hero.headline;
  const text = `${apiProfile.name}${first}${before}${accent}${after}${hero.tag}${footer}${site}`;
  const [serif, italic, sans] = await Promise.all([
    googleFont("Fraunces:opsz,wght@144,500", text),
    googleFont("Fraunces:ital,opsz,wght@1,144,400", text),
    googleFont("Instrument+Sans:wght@500", text),
  ]);
  const fonts = [
    ...(serif ? [{ name: "Fraunces", data: serif, weight: 500 as const, style: "normal" as const }] : []),
    ...(italic ? [{ name: "Fraunces", data: italic, weight: 400 as const, style: "italic" as const }] : []),
    ...(sans ? [{ name: "Instrument Sans", data: sans, weight: 500 as const, style: "normal" as const }] : []),
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
          padding: "60px 72px",
          background: colors.bg,
          color: colors.ink,
          fontFamily: "Instrument Sans",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 32 }}>{apiProfile.name}</div>
          <div style={{ display: "flex", background: colors.accent, borderRadius: 12, padding: "8px 16px", fontSize: 22 }}>{hero.tag}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Fraunces", fontSize: 104, letterSpacing: -3, lineHeight: 1 }}>
          <div style={{ display: "flex" }}>{first}</div>
          {/* Flex children lose their edge spaces in this renderer, so the words are spaced with a gap. */}
          <div style={{ display: "flex", gap: 26 }}>
            <span>{before.trim()}</span>
            <span style={{ fontStyle: "italic", fontWeight: 400 }}>{accent}</span>
            <span>{after.trim()}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${colors.line}`,
            paddingTop: 26,
            fontSize: 26,
            color: colors.mute,
          }}
        >
          <div style={{ display: "flex" }}>{footer}</div>
          <div style={{ display: "flex", color: colors.ink }}>{site}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
