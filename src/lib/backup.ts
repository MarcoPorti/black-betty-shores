import { BoatState } from "../types";

const PREFIX = "TIDEBOARD/1:";

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function encodeBackup(state: BoatState): string {
  const compact = { v: 1, w: state.weekStart, p: state.people, c: state.chores, s: state.schedule };
  return `${PREFIX}${toBase64Url(JSON.stringify(compact))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function decodeBackup(input: string): Pick<BoatState, "weekStart" | "people" | "chores" | "schedule"> {
  const trimmed = input.trim();
  if (!trimmed.startsWith(PREFIX)) throw new Error("That backup is not a Tideboard backup.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length)));
  } catch {
    throw new Error("The backup text is incomplete or damaged.");
  }
  if (!isRecord(parsed) || parsed.v !== 1 || typeof parsed.w !== "string" || !Array.isArray(parsed.p) || !Array.isArray(parsed.c) || !isRecord(parsed.s)) {
    throw new Error("This backup version is not supported.");
  }
  if (!parsed.p.every((person) => isRecord(person) && typeof person.id === "string" && typeof person.name === "string")) throw new Error("The people list in this backup is invalid.");
  if (!parsed.c.every((chore) => isRecord(chore) && typeof chore.id === "string" && typeof chore.name === "string" && typeof chore.required === "number")) throw new Error("The chores list in this backup is invalid.");
  return { weekStart: parsed.w, people: parsed.p as BoatState["people"], chores: parsed.c as BoatState["chores"], schedule: parsed.s as BoatState["schedule"] };
}
