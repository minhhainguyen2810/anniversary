import { describe, expect, it } from "vitest";
import { addCalendarDays, dateDifference, formatDate, isSpecialToday, nextMilestone, yearlyOccurrence } from "./date-engine";

describe("anniversary date engine", () => {
  it("uses calendar days, not elapsed hours", () => {
    expect(dateDifference("2024-03-09", "2024-03-10")).toBe(1);
    expect(addCalendarDays("2024-12-31", 1)).toBe("2025-01-01");
  });
  it("recognizes yearly and 100-day celebrations", () => {
    const anniversary = { id: "a", name: "Us", anniversary_date: "2020-01-01" };
    expect(isSpecialToday(anniversary, "2024-01-01").yearly).toBe(true);
    expect(isSpecialToday(anniversary, "2020-04-10").milestone).toBe(true);
    expect(isSpecialToday(anniversary, "2020-01-01").milestone).toBe(false);
  });
  it("handles leap day on February 28 in non-leap years", () => {
    expect(yearlyOccurrence("2020-02-29", 2021)).toBe("2021-02-28");
    expect(yearlyOccurrence("2020-02-29", 2024)).toBe("2024-02-29");
  });
  it("finds the next positive milestone", () => {
    expect(nextMilestone("2020-01-01", "2020-04-10")).toEqual({ date: "2020-07-19", milestone: 200 });
  });
  it("uses yearly recurrence only for birthdays", () => {
    const birthday = { id: "b", name: "Alex Birthday", anniversary_date: "2020-01-01" };
    expect(isSpecialToday(birthday, "2020-04-10").milestone).toBe(false);
    expect(nextMilestone(birthday.anniversary_date, "2020-01-02", birthday.name)).toBeNull();
  });
  it("switches to 1000-day milestones after day 1000", () => {
    const anniversary = { id: "c", name: "Us", anniversary_date: "2020-01-01" };
    expect(isSpecialToday(anniversary, "2022-09-27").milestone).toBe(true);
    expect(isSpecialToday(anniversary, "2022-12-06").milestone).toBe(false);
    expect(isSpecialToday(anniversary, "2025-06-23").milestone).toBe(true);
  });
  it("formats requested ordinal dates", () => {
    expect(formatDate("2026-01-06")).toBe("Tue Jan 6th");
  });
});
