# Tideboard — Boat community chore generator

Tideboard is a mobile-first, local-only chore planner for boat communities. It generates a Monday–Sunday rota around availability and rules, supports quick manual edits, and exports a WhatsApp-ready image.

## Run locally

```bash
npm install
npm run dev
```

Build for production with `npm run build`, preview it with `npm run preview`, and run the assignment/backup tests with `npm test`.

## Included in V1

- IndexedDB autosave with a small localStorage fallback.
- Seven prefilled daily chores and six demo crew members to edit or replace.
- Arrival/departure exclusion, strict “Cannot do” rules, soft preferences and dislikes.
- Random weekly generation with one-chore-per-person preference, repeat avoidance, and open-spot warnings.
- Per-day reassignment, unassignment, same-row swaps, and regeneration of a day or the remaining week.
- A horizontally scrollable week grid for mobile and a high-resolution PNG export.
- Copy/paste `TIDEBOARD/1:` backups with validation and overwrite confirmation.

No backend, login, hosted database, or historical schedule storage is used.
