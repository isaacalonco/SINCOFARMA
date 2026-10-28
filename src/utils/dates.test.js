import { describe, it, expect } from "vitest";
import { isSameDay, parseBrDate, monthLabel, startOfDay } from "./dates";

describe("dates", () => {
  it("compara dias ignorando a hora", () => {
    const ref = new Date(2026, 9, 28, 15, 0);
    expect(isSameDay(new Date(2026, 9, 28, 0, 5).toISOString(), ref)).toBe(true);
    expect(isSameDay(new Date(2026, 9, 27, 23, 59).toISOString(), ref)).toBe(false);
  });

  it("interpreta dd/mm/aaaa e rejeita datas inexistentes", () => {
    expect(parseBrDate("10/05/1990")?.getFullYear()).toBe(1990);
    expect(parseBrDate("31/02/2024")).toBeNull();
    expect(parseBrDate("29/02/2024")).not.toBeNull();
    expect(parseBrDate("1/5/1990")).toBeNull();
    expect(parseBrDate("")).toBeNull();
  });

  it("formata o mês em português com inicial maiúscula", () => {
    expect(monthLabel(new Date(2026, 9, 1))).toBe("Outubro 2026");
  });

  it("zera a hora em startOfDay", () => {
    const d = startOfDay(new Date(2026, 9, 28, 17, 30));
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});
