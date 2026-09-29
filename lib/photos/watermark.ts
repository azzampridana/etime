import { formatAdminEventTime } from "@/lib/date-time/event-time";

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

export function watermarkSvg(width: number, height: number, evidence: WatermarkEvidence) {
  // These are normalized pixel dimensions supplied by processEvidencePhoto, not EXIF dimensions.
  const shortSide = Math.min(width, height);
  const margin = Math.max(4, Math.min(24, shortSide * 0.02));
  const padding = Math.max(6, Math.min(24, shortSide * 0.025));
  const panelWidth = width - margin * 2;
  const textWidth = panelWidth - padding * 2;
  const font = Math.max(10, Math.min(32, textWidth / 34, height / 22));
  const titleFont = font * 1.15;
  const lineHeight = font * 1.5;
  const titleLineHeight = titleFont * 1.5;
  const [, dateTime, coordinates, accuracy] = watermarkLines(evidence);
  const title = wrapText(`ETime · OT ${evidence.event === "check-in" ? "Check-In" : "Check-Out"}`, textWidth, titleFont);
  const metadata = [dateTime, coordinates, accuracy].flatMap(line => wrapText(line, textWidth, font));
  const attribution = evidence.address ? wrapText("Geoapify (geoapify.com)", textWidth, font) : [];
  const fixedHeight = padding * 2 + title.length * titleLineHeight + (metadata.length + attribution.length) * lineHeight;
  const addressCapacity = Math.max(0, Math.min(3, Math.floor((height - margin * 2 - fixedHeight) / lineHeight)));
  const addressLines = evidence.address ? wrapText(evidence.address, textWidth, font) : [];
  const address = addressLines.slice(0, addressCapacity);
  if (addressLines.length > address.length && address.length) {
    // Keep the panel inside the image; the full address remains in structured evidence.
    const last = address.length - 1;
    address[last] = `${Array.from(address[last]).slice(0, -2).join("")}…`;
  }
  const panelHeight = Math.ceil(fixedHeight + address.length * lineHeight);
  const top = height - margin - panelHeight;
  let y = top + padding;
  const text = [
    ...title.map(value => ({ value, size: titleFont, height: titleLineHeight, weight: 700 })),
    ...[...metadata, ...address, ...attribution].map(value => ({ value, size: font, height: lineHeight, weight: 400 })),
  ].map(line => {
    const baseline = y + line.size;
    y += line.height;
    return `<text x="${margin + padding}" y="${baseline}" fill="white" font-family="DejaVu Sans, sans-serif" font-size="${line.size}" font-weight="${line.weight}">${xml(line.value)}</text>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${margin}" y="${top}" width="${panelWidth}" height="${panelHeight}" rx="${padding / 2}" fill="#000" fill-opacity="0.76"/>${text}</svg>`);
}
