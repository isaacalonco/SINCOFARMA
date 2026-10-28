/** Vocabulário do domínio (status, desfechos). Único lugar para esses rótulos. */

export const STATUS = {
  done: { label: "Concluído (MIP)", short: "Concluído", tone: "green" },
  referred: { label: "Encaminhado SES-DF", short: "Encaminhado", tone: "amber" },
  progress: { label: "Em Andamento", short: "Em andamento", tone: "blue" },
};

export const OUTCOME_META = {
  done: { label: "Resolvido no local", color: "var(--c-teal)" },
  referred: { label: "Encaminhado SES-DF", color: "var(--c-amber)" },
  progress: { label: "Acompanhamento Farmacote", color: "var(--c-blue)" },
};

export const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const WEEK_NAMES = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
