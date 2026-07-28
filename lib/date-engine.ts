export type Anniversary = {
  id: string;
  name: string;
  anniversary_date: string;
};

export type SpecialOccurrence = {
  id: string;
  name: string;
  date: string;
  kind: "yearly" | "milestone";
  milestone?: number;
  daysAway: number;
};

const DAY_MS = 86_400_000;

function parts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function ordinal(year: number, month: number, day: number) {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function iso(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function formatDateInput(value: string) {
  const { year, month, day } = parts(value);
  return `${day.toString().padStart(2, "0")}/${month.toString().padStart(2, "0")}/${year.toString().padStart(4, "0")}`;
}

export function parseDateInput(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return iso(year, month, day);
}

export function localIsoDate(date = new Date()) {
  return iso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function dateDifference(from: string, to: string) {
  return ordinal(...Object.values(parts(to)) as [number, number, number]) - ordinal(...Object.values(parts(from)) as [number, number, number]);
}

export function yearlyOccurrence(anniversaryDate: string, year: number) {
  const { month, day } = parts(anniversaryDate);
  if (month === 2 && day === 29) {
    const isLeap = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29;
    return iso(year, 2, isLeap ? 29 : 28);
  }
  return iso(year, month, day);
}

export function nextYearlyOccurrence(anniversaryDate: string, today: string) {
  const year = parts(today).year;
  const thisYear = yearlyOccurrence(anniversaryDate, year);
  return thisYear > today ? thisYear : yearlyOccurrence(anniversaryDate, year + 1);
}

export function isBirthdayName(name: string) {
  return name.toLocaleLowerCase().includes("birthday");
}

export function nextMilestone(anniversaryDate: string, today: string, name = "") {
  if (isBirthdayName(name)) return null;
  const elapsed = dateDifference(anniversaryDate, today);
  const interval = elapsed > 1000 ? 1000 : 100;
  const n = Math.max(1, Math.floor(elapsed / interval) + 1);
  return { date: addCalendarDays(anniversaryDate, n * interval), milestone: n * interval };
}

export function addCalendarDays(value: string, days: number) {
  const { year, month, day } = parts(value);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return iso(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

export function isSpecialToday(anniversary: Anniversary, today: string) {
  const yearly = yearlyOccurrence(anniversary.anniversary_date, parts(today).year) === today;
  const elapsed = dateDifference(anniversary.anniversary_date, today);
  const interval = elapsed > 1000 ? 1000 : 100;
  const milestone = !isBirthdayName(anniversary.name) && elapsed > 0 && elapsed % interval === 0;
  return { yearly, milestone };
}

export function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${weekday} ${monthName} ${day}${suffix}`;
}

export function countdown(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function upcomingOccurrences(anniversaries: Anniversary[], today: string) {
  const occurrences: SpecialOccurrence[] = [];
  for (const anniversary of anniversaries) {
    const yearly = nextYearlyOccurrence(anniversary.anniversary_date, today);
    const milestone = nextMilestone(anniversary.anniversary_date, today, anniversary.name);
    occurrences.push({ id: `${anniversary.id}-yearly-${yearly}`, name: anniversary.name, date: yearly, kind: "yearly", daysAway: dateDifference(today, yearly) });
    if (milestone) occurrences.push({ id: `${anniversary.id}-milestone-${milestone.date}`, name: anniversary.name, date: milestone.date, kind: "milestone", milestone: milestone.milestone, daysAway: dateDifference(today, milestone.date) });
  }
  const deduped = Array.from(new Map(occurrences.map((item) => [`${item.name.toLowerCase()}-${item.date}`, item])).values());
  return deduped.sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
}
