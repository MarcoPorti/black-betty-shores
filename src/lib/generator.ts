import { Assignment, BoatState, Chore, Person, Schedule, addDays, dateKey, isActiveOnDay, parseDateKey, weekDates } from "../types";

export interface GenerateOptions {
  rng?: () => number;
  fromDay?: number;
}

function isAvailable(person: Person, date: string, chore: Chore): boolean {
  return date > person.arrival && (!person.departure || date < person.departure) && !person.cannot.includes(chore.id);
}

function scoreCandidate(person: Person, chore: Chore, date: string, assignments: Assignment[], previousDay: Assignment[], history: Schedule, rng: () => number): number {
  const dailyCount = assignments.filter((assignment) => assignment.personId === person.id).length;
  const choreCount = Object.values(history).flat().filter((assignment) => assignment.personId === person.id && assignment.choreId === chore.id).length;
  const sameChoreYesterday = previousDay.some((assignment) => assignment.personId === person.id && assignment.choreId === chore.id);
  let score = rng() * 16 - dailyCount * 60 - choreCount * 2;
  if (sameChoreYesterday) score -= 38;
  if (person.prefers.includes(chore.id)) score += 30;
  if (person.dislikes.includes(chore.id)) score -= 18;
  // A tiny date-based tie breaker keeps generation lively but repeatable within a render.
  score += (date.charCodeAt(date.length - 1) % 3) * 0.1;
  return score;
}

export function generateDay(people: Person[], chores: Chore[], date: string, dayIndex: number, history: Schedule, options: GenerateOptions = {}): Assignment[] {
  const rng = options.rng ?? Math.random;
  const assignments: Assignment[] = [];
  const previousDate = dateKey(addDays(parseDateKey(date), -1));
  const previousDay = history[previousDate] ?? [];

  for (const chore of chores) {
    if (!isActiveOnDay(chore, dayIndex)) continue;
    for (let slot = 0; slot < chore.required; slot += 1) {
      const candidates = people.filter((person) => isAvailable(person, date, chore) && !assignments.some((assignment) => assignment.choreId === chore.id && assignment.personId === person.id));
      if (candidates.length === 0) {
        assignments.push({ choreId: chore.id, personId: null });
        continue;
      }
      candidates.sort((left, right) => scoreCandidate(right, chore, date, assignments, previousDay, history, rng) - scoreCandidate(left, chore, date, assignments, previousDay, history, rng));
      assignments.push({ choreId: chore.id, personId: candidates[0]?.id ?? null });
    }
  }
  return assignments;
}

export function repairDuplicateTaskAssignments(schedule: Schedule): Schedule {
  return Object.fromEntries(Object.entries(schedule).map(([date, assignments]) => {
    const seen = new Set<string>();
    const repaired = assignments.map((assignment) => {
      if (!assignment.personId) return assignment;
      const key = `${assignment.choreId}:${assignment.personId}`;
      if (seen.has(key)) return { ...assignment, personId: null };
      seen.add(key);
      return assignment;
    });
    return [date, repaired];
  }));
}

export function generateWeek(people: Person[], chores: Chore[], weekStart: string, options: GenerateOptions = {}): Schedule {
  const schedule: Schedule = {};
  for (const [index, date] of weekDates(weekStart).entries()) {
    schedule[date] = generateDay(people, chores, date, index, schedule, options);
  }
  return schedule;
}

export function warningsForDay(state: Pick<BoatState, "people" | "chores" | "schedule">, date: string, dayIndex: number): string[] {
  const warnings: string[] = [];
  const assignments = state.schedule[date] ?? [];
  for (const assignment of assignments) {
    if (assignment.personId) continue;
    const chore = state.chores.find((item) => item.id === assignment.choreId);
    if (chore) warnings.push(`No eligible crew for ${chore.emoji} ${chore.name}`);
  }
  const dayPeople = new Set(assignments.filter((item) => item.personId).map((item) => item.personId));
  const eligiblePeople = state.people.filter((person) => date > person.arrival && (!person.departure || date < person.departure)).length;
  if (eligiblePeople === 0 && assignments.length > 0) warnings.push("Nobody is aboard for this day");
  if (dayPeople.size < Math.min(eligiblePeople, 2) && dayIndex >= 0) {
    // This line intentionally stays quiet for small crews; only assignment gaps are actionable.
  }
  return [...new Set(warnings)];
}

export function countUnassigned(schedule: Schedule): number {
  return Object.values(schedule).flat().filter((assignment) => !assignment.personId).length;
}
