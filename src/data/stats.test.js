import { describe, it, expect } from "vitest";
import { computeStats, countBy, isVisit } from "./stats";

const now = new Date(2026, 9, 28, 14, 0); // quarta-feira
const at = (dayOffset, h = 9) => {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const baseline = {
  outcomes: { done: 100, referred: 20, progress: 10 },
  referralsToday: 5,
  triageMinutes: 8,
  triageGoal: "< 10 min",
  monthGoal: 200,
  // os exemplos já estão contados em `outcomes`
  seedCounts: { done: 1, referred: 1, progress: 0 },
  seedCount: 2,
};
const seeds = [
  { id: "s1", name: "A", status: "done", at: at(0) },
  { id: "s2", name: "B", status: "referred", at: at(0), urgent: true },
];
const week = [10, 10, 10, 10, 10, 10, 10];

describe("computeStats", () => {
  it("sem cadastros novos, reproduz a base", () => {
    const s = computeStats(seeds, { baseline, week, now });
    expect(s.monthTotal).toBe(130);
    expect(s.resolutionPercent).toBe(77);
    expect(s.todayTotal).toBe(2);
    expect(s.referralsToday).toBe(5);
    expect(s.urgentToday).toBe(1);
    expect(s.todayIndex).toBe(2);
    expect(s.week).toEqual(week);
  });

  it("um cadastro de hoje soma em tudo que é de hoje e do mês", () => {
    const visits = [{ id: "n1", name: "C", status: "referred", at: at(0, 13), urgent: true }, ...seeds];
    const s = computeStats(visits, { baseline, week, now });
    expect(s.monthTotal).toBe(131);
    expect(s.outcomes.referred).toBe(21);
    expect(s.referralsToday).toBe(6);
    expect(s.urgentToday).toBe(2);
    expect(s.todayTotal).toBe(3);
    expect(s.week[2]).toBe(11);
  });

  it("um registro de ontem conta no mês, mas não em hoje", () => {
    const visits = [{ id: "o1", name: "D", status: "progress", at: at(-1), urgent: true }, ...seeds];
    const s = computeStats(visits, { baseline, week, now });
    expect(s.monthTotal).toBe(131);
    expect(s.todayTotal).toBe(2);
    expect(s.urgentToday).toBe(1);
    expect(s.waiting).toBe(0);
    expect(s.week[2]).toBe(10);
  });

  it("progresso da meta satura em 100%", () => {
    const s = computeStats(seeds, { baseline: { ...baseline, monthGoal: 50 }, week, now });
    expect(s.goalProgress).toBe(1);
  });
});

describe("countBy / isVisit", () => {
  it("ignora status desconhecidos", () => {
    expect(countBy([{ status: "done" }, { status: "x" }, { status: "done" }])).toEqual({ done: 2, referred: 0, progress: 0 });
  });
  it("valida a forma mínima de um atendimento", () => {
    expect(isVisit({ id: "1", name: "Ana", status: "done" })).toBe(true);
    expect(isVisit({ id: "1", name: " ", status: "done" })).toBe(false);
    expect(isVisit({ id: "1", name: "Ana", status: "inexistente" })).toBe(false);
    expect(isVisit(null)).toBe(false);
  });
});
