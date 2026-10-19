import { BoatState, DAY_NAMES, formatShortDate, weekDates } from "../types";

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[character] ?? character));
}

export function buildWeekSvg(state: BoatState): string {
  const dates = weekDates(state.weekStart);
  const width = 1800;
  const left = 360;
  const col = (width - left) / 7;
  const row = 98;
  const gridHeaderY = 116;
  const gridHeaderHeight = 68;
  const contentTop = 202;
  const height = contentTop + state.chores.length * row + 110;
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  lines.push(`<rect width="100%" height="100%" fill="#0c171c"/>`);
  lines.push(`<text x="64" y="66" fill="#f3f8f3" font-family="Arial,sans-serif" font-size="38" font-weight="700">Tideboard</text>`);
  lines.push(`<text x="64" y="108" fill="#9fb4b4" font-family="Arial,sans-serif" font-size="21">Boat chores · ${escapeXml(formatShortDate(state.weekStart))} – ${escapeXml(formatShortDate(dates[6]))}</text>`);
  dates.forEach((date, index) => {
    const x = left + index * col;
    lines.push(`<rect x="${x}" y="${gridHeaderY}" width="${col}" height="${gridHeaderHeight}" rx="18" fill="#15272c"/>`);
    lines.push(`<text x="${x + 24}" y="${gridHeaderY + 29}" fill="#eaf2ee" font-family="Arial,sans-serif" font-size="21" font-weight="700">${DAY_NAMES[index]}</text>`);
    lines.push(`<text x="${x + 24}" y="${gridHeaderY + 53}" fill="#8da5a4" font-family="Arial,sans-serif" font-size="18">${escapeXml(formatShortDate(date))}</text>`);
  });
  state.chores.forEach((chore, choreIndex) => {
    const y = contentTop + choreIndex * row;
    lines.push(`<line x1="${left}" y1="${y + row - 5}" x2="${width - 48}" y2="${y + row - 5}" stroke="#20383c"/>`);
    lines.push(`<text x="64" y="${y + 46}" fill="#f3f8f3" font-family="Arial,sans-serif" font-size="22" font-weight="700">${escapeXml(chore.emoji)}  ${escapeXml(chore.name)}</text>`);
    dates.forEach((date, dayIndex) => {
      const x = left + dayIndex * col;
      const people = state.schedule[date]?.filter((assignment) => assignment.choreId === chore.id).map((assignment) => state.people.find((person) => person.id === assignment.personId)?.name ?? "Open") ?? [];
      const labels = people.length ? people : ["—"];
      labels.slice(0, 3).forEach((name, nameIndex) => lines.push(`<text x="${x + 24}" y="${y + 32 + nameIndex * 25}" fill="${name === "Open" || name === "—" ? "#f2aa74" : "#b9dcca"}" font-family="Arial,sans-serif" font-size="19">${escapeXml(name)}</text>`));
    });
  });
  lines.push(`<text x="64" y="${height - 32}" fill="#668080" font-family="Arial,sans-serif" font-size="17">Generated with Tideboard · local-only</text>`);
  lines.push("</svg>");
  return lines.join("");
}

export async function downloadWeekPng(state: BoatState): Promise<void> {
  const svg = buildWeekSvg(state);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not render the image.")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = image.width * 2;
    canvas.height = image.height * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("Could not make a PNG.");
    const downloadUrl = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `tideboard-${state.weekStart}.png`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}
