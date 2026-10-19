import { describe, expect, it } from "vitest";
import { decodeBackup, encodeBackup } from "./backup";
import { BoatState } from "../types";

const state: BoatState = { version: 1, weekStart: "2026-10-19", people: [{ id: "a", name: "Alex", arrival: "2026-10-18", departure: "2026-10-26", cannot: [], prefers: ["water"], dislikes: [] }], chores: [{ id: "water", name: "Water", emoji: "💧", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] }], schedule: { "2026-10-19": [{ choreId: "water", personId: "a" }] }, onboardingComplete: true };

describe("Tideboard text backups", () => {
  it("round trips the local state", () => {
    expect(decodeBackup(encodeBackup(state))).toEqual({ weekStart: state.weekStart, people: state.people, chores: state.chores, schedule: state.schedule });
  });

  it("rejects unsupported text", () => {
    expect(() => decodeBackup("not a Tideboard backup")).toThrow(/not a Tideboard backup/);
  });
});
