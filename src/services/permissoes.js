// Quem vê o quê no painel. Espelha a tabela do backend
// (backend/src/painel/comum/auth.py), que é quem realmente bloqueia: aqui
// só escondemos o que o servidor recusaria. Mudou lá? Mude aqui também.
//
// Papéis (somam): farmaceutico, medico, admin (gestão do Sincofarma).

export const PAPEIS = {
  farmaceutico: "Farmacêutico(a)",
  medico: "Médico(a)",
  admin: "Administração Sincofarma",
};

const PERMISSOES = {
  // atendimentos com dados do paciente, só da própria unidade
  ver_atendimentos: ["farmaceutico"],
  // indicadores agregados, sem dado que identifique paciente
  ver_indicadores: ["farmaceutico", "admin"],
  criar_triagem: ["farmaceutico"],
  // desfecho e Red Flag, e só de quem registrou (o atendimento chega com `mine`)
  alterar_atendimento: ["farmaceutico"],
  sincronizar_rnds: ["farmaceutico"],
  ver_todas_unidades: ["admin"],
  ver_encaminhamentos: ["farmaceutico", "medico"],
};

/** O usuário tem a permissão? `user.roles` vem do login (grupos `papel:*`). */
export function pode(user, permissao) {
  const papeis = PERMISSOES[permissao];
  if (!papeis) throw new Error(`Permissão desconhecida: ${permissao}`);
  return (user?.roles ?? []).some((r) => papeis.includes(r));
}

/** Pode mudar desfecho e Red Flag deste atendimento? */
export function podeAlterar(user, visit) {
  // sem `mine` (modo demonstração) vale só o papel
  return pode(user, "alterar_atendimento") && visit?.mine !== false;
}

// rota -> quem entra. O painel da unidade exige estar numa unidade.
const ROTAS = {
  "/dashboard": (u) => pode(u, "ver_atendimentos") && !!u.unit,
  "/atendimentos": (u) => pode(u, "ver_atendimentos") && !!u.unit,
  "/nova-triagem": (u) => pode(u, "criar_triagem") && !!u.unit,
  "/encaminhamentos": (u) => pode(u, "ver_encaminhamentos"),
  "/farmacias": (u) => pode(u, "ver_todas_unidades"),
  "/relatorios": (u) => pode(u, "ver_indicadores"),
};

export function podeRota(user, path) {
  const regra = ROTAS[path];
  return !!user && !!regra && regra(user);
}

/** Primeira tela que o usuário pode abrir (destino depois do login). */
export function rotaInicial(user) {
  return Object.keys(ROTAS).find((p) => podeRota(user, p)) ?? "/sem-acesso";
}
