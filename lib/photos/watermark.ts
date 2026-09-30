import { formatAdminEventTime } from "@/lib/date-time/event-time";
import path from "node:path";
import { access } from "node:fs/promises";
import sharp, { type OverlayOptions } from "sharp";

export type WatermarkEvidence = {
  event: "check-in" | "check-out"; at: Date; timezone: string;
  latitude: number; longitude: number; accuracy: number; address?: string | null;
};
export function watermarkLines(evidence: WatermarkEvidence) {
  return [
    `ETime - Overtime ${evidence.event === "check-in" ? "Check-In" : "Check-Out"}`,
    formatAdminEventTime(evidence.at.toISOString(), evidence.timezone),
    `Lat: ${evidence.latitude.toFixed(6)}  Lon: ${evidence.longitude.toFixed(6)}`,
    `Accuracy: ±${evidence.accuracy} m`,
    ...(evidence.address ? [evidence.address, "Address: Geoapify (geoapify.com)"] : []),
  ];
}
const xml = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "").replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);

// Conservative glyph widths leave room for font fallback and non-Latin addresses.
function wrapText(text: string, availableWidth: number, font: number): string[] {
  const lines: string[] = [];
  let line = "";
  let used = 0;
  for (const word of text.trim().split(/\s+/u)) {
    const characters = Array.from(word);
    const advance = (character: string) => font * (/^[a-ln-vx-z0-9 .,:;!|]$/u.test(character) ? 0.7 : 1.1);
    const wordWidth = characters.reduce((sum, character) => sum + advance(character), 0);
    if (line && used + advance(" ") + wordWidth > availableWidth) {
      lines.push(line); line = ""; used = 0;
    }
    if (line) { line += " "; used += advance(" "); }
    for (const character of characters) {
      const size = advance(character);
      if (line && used + size > availableWidth) { lines.push(line); line = ""; used = 0; }
      line += character; used += size;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type WatermarkLineType = "heading" | "datetime" | "address" | "coordinates" | "accuracy" | "attribution";

// Pure layout data: no SVG text flow or renderer-specific line positioning.
export function calculateWatermarkLayout(width: number, height: number, evidence: WatermarkEvidence) {
  // These are normalized pixel dimensions supplied by processEvidencePhoto, not EXIF dimensions.
  const shortSide = Math.min(width, height);
  const margin = Math.max(4, Math.min(24, shortSide * 0.02));
  const padding = Math.max(6, Math.min(24, shortSide * 0.025));
  const panelWidth = width - margin * 2;
  const textWidth = panelWidth - padding * 2;
  const font = Math.max(10, Math.floor(Math.min(32, textWidth / 34, height / 22)));
  const titleFont = Math.ceil(font * 1.15);
  const lineHeight = Math.ceil(font * 1.5);
  const titleLineHeight = Math.ceil(titleFont * 1.5);
  const [, dateTime, coordinates, accuracy] = watermarkLines(evidence);
  const title = wrapText(`ETime · OT ${evidence.event === "check-in" ? "Check-In" : "Check-Out"}`, textWidth, titleFont);
  const metadata = [dateTime, coordinates, accuracy].flatMap(line => wrapText(line, textWidth, font));
  const attribution = evidence.address ? wrapText("Geoapify (geoapify.com)", textWidth, font) : [];
  // Baseline spacing preserves the larger heading ascent through the final metadata line.
  const fixedHeight = padding * 2 + titleFont - font + title.length * titleLineHeight + (metadata.length + attribution.length) * lineHeight;
  const addressCapacity = Math.max(0, Math.min(3, Math.floor((height - margin * 2 - fixedHeight) / lineHeight)));
  const addressLines = evidence.address ? wrapText(evidence.address, textWidth, font) : [];
  const address = addressLines.slice(0, addressCapacity);
  if (addressLines.length > address.length && address.length) {
    // Keep the panel inside the image; the full address remains in structured evidence.
    const last = address.length - 1;
    address[last] = `${Array.from(address[last]).slice(0, -2).join("")}…`;
  }
  const lines: { text: string; x: number; y: number; type: WatermarkLineType; fontSize: number; lineHeight: number }[] = [];
  function append(values: string[], type: WatermarkLineType) {
    const fontSize = type === "heading" ? titleFont : font;
    const spacing = type === "heading" ? titleLineHeight : lineHeight;
    for (const text of values) {
      const previous = lines.at(-1);
      // Baselines advance by the preceding line's full spacing, including at type boundaries.
      const y = previous ? previous.y + previous.lineHeight : padding + fontSize;
      lines.push({ text, x: margin + padding, y, type, fontSize, lineHeight: spacing });
    }
  }
  append(title, "heading");
  append(wrapText(dateTime, textWidth, font), "datetime");
  append(address, "address");
  append(wrapText(coordinates, textWidth, font), "coordinates");
  append(wrapText(accuracy, textWidth, font), "accuracy");
  append(attribution, "attribution");

  const last = lines[lines.length - 1];
  // Reserve descent/leading below the final baseline, then bottom padding.
  const panelHeight = Math.ceil(last.y + last.lineHeight - last.fontSize + padding);
  const panelY = height - margin - panelHeight;
  return {
    imageWidth: width, imageHeight: height,
    panelX: margin, panelY, panelWidth, panelHeight,
    headingFontSize: titleFont, metadataFontSize: font,
    headingLineHeight: titleLineHeight, metadataLineHeight: lineHeight,
    lines: lines.map(line => ({ ...line, y: panelY + line.y })),
  };
}

export async function watermarkImage(width: number, height: number, evidence: WatermarkEvidence) {
  const layout = calculateWatermarkLayout(width, height, evidence);
  const regular = path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf");
  const bold = path.join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf");
  // A missing deployment asset must fail explicitly, never silently use an OS font.
  await Promise.all([access(regular), access(bold)]);
  const panel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.imageWidth}" height="${layout.imageHeight}" viewBox="0 0 ${layout.imageWidth} ${layout.imageHeight}"><rect x="${layout.panelX}" y="${layout.panelY}" width="${layout.panelWidth}" height="${layout.panelHeight}" fill="#000" fill-opacity="0.76"/></svg>`);
  const overlays: OverlayOptions[] = [];
  for (const line of layout.lines) {
    const heading = line.type === "heading";
    const input = await sharp({ text: {
      text: `<span foreground="white">${xml(line.text)}</span>`,
      font: `Noto Sans ${heading ? "Bold" : "Regular"} ${line.fontSize}`,
      fontfile: heading ? bold : regular,
      dpi: 72,
      rgba: true,
      // Each line is already wrapped and positioned by calculateWatermarkLayout.
      // No width/height fitting or Pango automatic wrapping is requested.
      wrap: "none",
    } }).png().toBuffer();
    overlays.push({ input, left: Math.round(line.x), top: Math.round(line.y - line.fontSize) });
  }
  return sharp(panel).composite(overlays).png().toBuffer();
}
