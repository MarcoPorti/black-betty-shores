export type Frequency = "daily" | "weekdays" | "custom";
export type RestrictionKind = "cannot" | "prefers" | "dislikes";

export interface Chore {
  id: string;
  name: string;
  emoji: string;
  required: number;
  frequency: Frequency;
  days: number[];
}

export interface Person {
  id: string;
  name: string;
  arrival: string;
  departure: string;
  cannot: string[];
  prefers: string[];
  dislikes: string[];
}

export interface Assignment {
  choreId: string;
  personId: string | null;
}

export interface Schedule {
  [date: string]: Assignment[];
}

export interface BoatState {
  version: 1;
  weekStart: string;
  people: Person[];
  chores: Chore[];
  schedule: Schedule;
  onboardingComplete: boolean;
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const LONG_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date = new Date()): Date {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + mondayOffset);
  return next;
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => dateKey(addDays(parseDateKey(weekStart), index)));
}

export function formatShortDate(value: string): string {
  return parseDateKey(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRange(weekStart: string): string {
  const start = parseDateKey(weekStart);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endText = end.toLocaleDateString(undefined, { month: sameMonth ? undefined : "short", day: "numeric" });
  return `${startText} – ${endText}`;
}

export function isActiveOnDay(chore: Chore, dayIndex: number): boolean {
  if (chore.frequency === "daily") return true;
  if (chore.frequency === "weekdays") return dayIndex < 5;
  return chore.days.includes(dayIndex);
}
