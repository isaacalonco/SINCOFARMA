import { isSameDay } from "../utils/dates";
import { STATUS } from "./catalog";

/** Conta atendimentos por desfecho (ignora status desconhecidos). */
export function countBy(list) {
  const out = { done: 0, referred: 0, progress: 0 };
  list.forEach((v) => {
    if (Object.hasOwn(out, v.status)) out[v.status] += 1;
  });
  return out;
}

export function isVisit(v) {
  return (
    !!v &&
    typeof v === "object" &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.trim() !== "" &&
    typeof v.status === "string" &&
    Object.hasOwn(STATUS, v.status)
  );
}

/**
 * Indicadores do painel a partir da lista de atendimentos.
 * `baseline` são os totais do mês já consolidados no servidor (ou no mock);
 * `week` é o histórico de triagens por dia (segunda = 0).
 * Função pura: fácil de testar e de trocar pela resposta da API.
 */
export function computeStats(visits, { baseline, week, now = new Date() }) {
  const today = visits.filter((v) => isSameDay(v.at, now));
  const todayCounts = countBy(today);
  const counts = countBy(visits);

  const outcomes = {
    done: baseline.outcomes.done + counts.done - baseline.seedCounts.done,
    referred: baseline.outcomes.referred + counts.referred - baseline.seedCounts.referred,
    progress: baseline.outcomes.progress + counts.progress - baseline.seedCounts.progress,
  };
  const monthTotal = outcomes.done + outcomes.referred + outcomes.progress;

  const todayIndex = (now.getDay() + 6) % 7;
  const addedToday = Math.max(today.length - baseline.seedCount, 0);
  const weekValues = week.map((v, i) => (i === todayIndex ? v + addedToday : v));

  return {
    todayTotal: today.length,
    monthTotal,
    outcomes,
    waiting: todayCounts.progress,
    resolutionPercent: monthTotal ? Math.round((outcomes.done / monthTotal) * 100) : 0,
    referralsToday: baseline.referralsToday + todayCounts.referred - baseline.seedCounts.referred,
    urgentToday: today.filter((v) => v.urgent).length,
    triageMinutes: baseline.triageMinutes,
    triageGoal: baseline.triageGoal,
    goalProgress: baseline.monthGoal ? Math.min(monthTotal / baseline.monthGoal, 1) : 0,
    monthGoal: baseline.monthGoal,
    todayIndex,
    week: weekValues,
  };
}
