# Sincofarma DF · Painel Clínico

Painel de atendimento farmacêutico (triagem, desfechos e encaminhamentos) do Sincofarma DF.
Front-end em React 19 + Vite 8, com framer-motion para animação.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
```

No Windows, se o terminal tiver `NODE_ENV=production` definido, o `npm install` pula as
dependências de desenvolvimento. Nesse caso use `NODE_ENV=development npm install`.

Outros comandos:

```bash
npm run build      # build de produção em dist/
npm run preview    # serve o build local
npm run lint       # ESLint
npm test           # testes unitários (Vitest)
```

## Dados: simulado vs. API

O app fala com os dados por um único ponto, `src/data/index.js`, que escolhe o repositório:

- **sem `VITE_API_URL`** → `mockRepository`: dados de exemplo persistidos no `localStorage`,
  com latência simulada. É o modo padrão para desenvolvimento e demonstração.
- **com `VITE_API_URL`** → `apiRepository`: chama a API real via `src/services/api.js`
  (JSON, token Bearer, timeout, 401 encerra a sessão).

Copie `.env.example` para `.env` e preencha a URL para usar a API. O contrato esperado está
documentado no topo de `src/data/apiRepository.js`.

Os indicadores do painel são calculados no cliente por `computeStats` (`src/data/stats.js`),
uma função pura coberta por testes.

## Login

- **Sem `VITE_COGNITO_*`**: modo demonstração (qualquer identificador, senha `12345678`). Nunca em produção.
- **Com `VITE_COGNITO_REGION` e `VITE_COGNITO_CLIENT_ID`**: login real no Amazon Cognito, com troca de senha
  no primeiro acesso. Os tokens ficam em memória e o refresh token no `sessionStorage`.

## Backend

O backend (AWS SAM: Cognito, API Gateway, Lambda em Python e DynamoDB) fica em [`backend/`](backend/README.md),
com instruções de teste, deploy e cadastro de usuários.

## Estrutura

```
src/
  components/   peças compartilhadas (sidebar, tabela, painel do paciente, avisos…)
  contexts/     AuthProvider, ClinicProvider (estado clínico), MotionPrefs (animações)
  data/         repositórios (mock/API), catálogo do domínio, estatísticas, dados de exemplo
  hooks/        foco em diálogos, tilt/holofote, online, montagem adiada
  layouts/      AppLayout (sidebar + topo + rotas internas)
  pages/        Login, Dashboard, NovaTriagem, EmBreve
  services/     cliente HTTP e serviço de login
  styles/       CSS global e do app
  utils/        CPF/máscaras, datas, iniciais, linguagem de movimento
```

## Acessibilidade e movimento

- Painéis e menu mobile prendem o foco e devolvem ao fechar; Esc fecha.
- Tabela, gráficos e filtro funcionam por teclado.
- O app segue `prefers-reduced-motion`. O botão ao lado de "Sair" alterna entre
  automático, ligadas e reduzidas (fica salvo no navegador).

## Deploy

`vercel.json` reescreve todas as rotas para `index.html` (SPA). Os chunks são separados por
biblioteca (`react`, `motion`, `icons`) e por página, com pré-carregamento após o login.
