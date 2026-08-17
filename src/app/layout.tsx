import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Plus_Jakarta_Sans, Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSetting, getSettingsMap } from "@/lib/settings";

const sans = Plus_Jakarta_Sans({ variable: "--font-geist-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const serif = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "500", "600", "700", "800", "900"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const defaultBodyFont = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
const defaultHeadingFont = "var(--font-playfair), Georgia, 'Times New Roman', serif";
const defaultMonoFont = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

// Every page is database-driven (settings, plans, content), so nothing is
// prerendered at build time — builds must work without a reachable database.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [name, tagline] = await Promise.all([
    getSetting("app.name", "ImmigrationOnMe"),
    getSetting("app.tagline", "Immigration paperwork, organized"),
  ]);
  return { title: { default: name, template: `%s · ${name}` }, description: tagline };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fonts = await getSettingsMap(["font.body", "font.heading", "font.mono"]);
  const fontStyle = {
    "--font-body": fonts["font.body"] || defaultBodyFont,
    "--font-heading": fonts["font.heading"] || defaultHeadingFont,
    "--font-code": fonts["font.mono"] || defaultMonoFont,
  } as CSSProperties;

  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${geistMono.variable} font-sans`} style={fontStyle}>{children}</body>
    </html>
  );
}
