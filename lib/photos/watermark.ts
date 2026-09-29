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
const xml = (text: string) => text.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);
export function watermarkSvg(width: number, height: number, evidence: WatermarkEvidence) {
  const font = Math.max(8, Math.min(24, width / 42, height / 24));
  const padding = Math.max(4, font * 0.6);
  const chars = Math.max(12, Math.floor((width - padding * 2) / (font * 0.62)));
  const lines = watermarkLines(evidence).flatMap(line => line.match(new RegExp(`.{1,${chars}}`, "gu")) ?? []);
  const lineHeight = font * 1.35;
  const panelHeight = Math.ceil(lines.length * lineHeight + 2 * padding);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0" y="${height - panelHeight}" width="${width}" height="${panelHeight}" fill="#000" fill-opacity="0.72"/>${lines.map((line, index) => `<text x="${padding}" y="${height - panelHeight + padding + font + index * lineHeight}" fill="white" font-family="sans-serif" font-size="${font}">${xml(line)}</text>`).join("")}</svg>`);
}
