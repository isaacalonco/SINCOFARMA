// Dados simulados (usados só pelo mockRepository, quando não há API).
import { countBy } from "./stats";

export const unit = "Drogaria Planalto — Unidade Asa Sul / RA I";

// triagens por dia da semana (segunda = 0); hoje soma os novos cadastros
export const weekBase = [15, 18, 21, 26, 18, 14, 9];
export const historicAverage = 17;

export const seedVisits = [
  { id: "v1", name: "Maria da Silva Santos", cpf: "***.***.***-01", complaint: "Cefaleia tensional e Febre leve", signs: "Tax 37.8 °C · PA 120/80 mmHg", time: "09:30", rt: "Dra. Ana Souza", status: "done" },
  { id: "v2", name: "João Carlos Pereira", cpf: "***.***.***-55", complaint: "Dor torácica e Falta de ar", signs: "PA 170/110 mmHg · SpO2 94%", time: "10:15", rt: "Dra. Ana Souza", status: "referred", urgent: true },
  { id: "v3", name: "Ana Beatriz Oliveira", cpf: "***.***.***-22", complaint: "Tosse persistente e Coriza", signs: "Ausculta em triagem · Escore clínico", time: "11:00", rt: "Dr. Rafael Mendes", status: "progress" },
  { id: "v4", name: "Carlos Eduardo Lima", cpf: "***.***.***-90", complaint: "Dor lombar crônica mecânica", signs: "Sem sinais de alerta neurológico", time: "14:30", rt: "Dra. Ana Souza", status: "done" },
  { id: "v5", name: "Mariana Costa Ribeiro", cpf: "***.***.***-18", complaint: "Erupção cutânea, Coceira intensa", signs: "Quadro alérgico leve sem edema facial", time: "16:00", rt: "Dra. Ana Souza", status: "done" },
  { id: "v6", name: "Pedro Henrique Alves", cpf: "***.***.***-63", complaint: "Dor de garganta e Rouquidão", signs: "Tax 37.2 °C · Sem placas amigdalianas", time: "08:45", rt: "Dr. Rafael Mendes", status: "done" },
  { id: "v7", name: "Lúcia Fernandes Rocha", cpf: "***.***.***-12", complaint: "Controle pressórico de rotina", signs: "PA 148/92 mmHg · Adesão parcial", time: "08:10", rt: "Dra. Ana Souza", status: "progress" },
];

// Registros que a "RNDS" entrega a cada sincronização (um por vez).
export const rndsQueue = [
  { name: "Rafael Nogueira Dias", cpf: "***.***.***-88", complaint: "Retorno: crise asmática leve", signs: "SpO2 96% · Sibilos discretos", rt: "Dr. Rafael Mendes", status: "progress" },
  { name: "Helena Martins Prado", cpf: "***.***.***-04", complaint: "Renovação de receita contínua", signs: "Hipotireoidismo controlado", rt: "Dra. Ana Souza", status: "done" },
];

/**
 * Totais do mês já consolidados (no mundo real, vêm do servidor).
 * `outcomes` já inclui os seedVisits; `seedCounts/seedCount` permitem
 * somar só o que foi cadastrado além deles.
 */
export const baseline = {
  outcomes: { done: 357, referred: 77, progress: 48 },
  referralsToday: 18,
  triageMinutes: 8,
  triageGoal: "< 10 min",
  monthGoal: 525,
  seedCounts: countBy(seedVisits),
  seedCount: seedVisits.length,
};
