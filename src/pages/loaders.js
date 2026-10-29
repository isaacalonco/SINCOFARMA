// Carregadores das páginas (cada uma vira um chunk separado: o login não baixa
// o código do painel). Usados pelas rotas e pela tela de entrada, que baixa
// todas antes de abrir o painel.
export const loaders = {
  Login: () => import("./Login/Login"),
  Dashboard: () => import("./Dashboard/Dashboard"),
  NovaTriagem: () => import("./NovaTriagem/NovaTriagem"),
  EmBreve: () => import("./EmBreve/EmBreve"),
  SemAcesso: () => import("./SemAcesso/SemAcesso"),
};

/** Páginas internas (tudo menos o login). */
export const appPages = [loaders.Dashboard, loaders.NovaTriagem, loaders.EmBreve, loaders.SemAcesso];
