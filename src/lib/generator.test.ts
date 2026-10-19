import { describe, expect, it } from "vitest";
import { generateDay, generateWeek, repairDuplicateTaskAssignments } from "./generator";
import { Chore, Person } from "../types";

const chores: Chore[] = [
  { id: "water", name: "Water", emoji: "💧", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "watch", name: "Watch", emoji: "👀", required: 2, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "lunch", name: "Lunch", emoji: "🥗", required: 1, frequency: "custom", days: [0, 2, 4] },
];
const people: Person[] = [
  { id: "a", name: "A", arrival: "2026-10-18", departure: "2026-10-25", cannot: [], prefers: [], dislikes: [] },
  { id: "b", name: "B", arrival: "2026-10-19", departure: "2026-10-24", cannot: ["watch"], prefers: ["water"], dislikes: [] },
];

describe("boat chore generator", () => {
  it("excludes both arrival and departure dates", () => {
    const schedule = generateDay(people, chores, "2026-10-19", 0, {}, { rng: () => 0.5 });
    expect(schedule.every((assignment) => assignment.personId === "a" || assignment.personId === null)).toBe(true);
    expect(generateDay(people, chores, "2026-10-25", 6, {}, { rng: () => 0.5 }).every((assignment) => assignment.personId === null)).toBe(true);
  });

  it("respects strict cannot-do rules", () => {
    const schedule = generateDay(people, chores, "2026-10-21", 2, {}, { rng: () => 0.5 });
    expect(schedule.filter((assignment) => assignment.choreId === "watch").every((assignment) => assignment.personId !== "b")).toBe(true);
  });

  it("does not assign one person twice to the same task", () => {
    const schedule = generateDay(people, chores, "2026-10-21", 2, {}, { rng: () => 0.5 });
    const watchPeople = schedule.filter((assignment) => assignment.choreId === "watch").map((assignment) => assignment.personId).filter(Boolean);
    expect(new Set(watchPeople).size).toBe(watchPeople.length);
  });

  it("repairs duplicate saved task assignments as open spots", () => {
    const repaired = repairDuplicateTaskAssignments({ "2026-10-21": [{ choreId: "watch", personId: "a" }, { choreId: "watch", personId: "a" }] });
    expect(repaired["2026-10-21"][1].personId).toBeNull();
  });

  it("only schedules custom chores on selected days", () => {
    const monday = generateDay(people, chores, "2026-10-19", 0, {}, { rng: () => 0.5 });
    const tuesday = generateDay(people, chores, "2026-10-20", 1, {}, { rng: () => 0.5 });
    expect(monday.some((assignment) => assignment.choreId === "lunch")).toBe(true);
    expect(tuesday.some((assignment) => assignment.choreId === "lunch")).toBe(false);
  });

  it("generates seven dates and leaves impossible spots open", () => {
    const schedule = generateWeek([], chores, "2026-10-19", { rng: () => 0.5 });
    expect(Object.keys(schedule)).toHaveLength(7);
    expect(Object.values(schedule).flat().every((assignment) => assignment.personId === null)).toBe(true);
  });
});
