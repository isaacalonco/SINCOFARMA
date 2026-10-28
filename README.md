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
  no primeiro acesso e MFA obrigatório por app autenticador (QR code no primeiro login, código de 6 dígitos
  nos seguintes). Os tokens ficam em memória e o refresh token no `sessionStorage`.

## Desenvolvendo contra o backend local

**Nunca teste contra a produção**: lá ficam dados clínicos reais. Para ver uma página com login, API e banco
de verdade, rode o backend simulado na sua máquina (não precisa de conta AWS):

1. Prepare o Python uma vez (Python 3.12; detalhes em [`backend/README.md`](backend/README.md)):

   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows (Linux/macOS: .venv/bin/python)
   ```

2. Suba o servidor local. Ele imprime um `CLIENT_ID`, que muda a cada vez que o servidor reinicia:

   ```bash
   .venv/Scripts/python scripts/servidor_local.py --porta 3001 --origem http://localhost:5173
   ```

3. Na raiz do projeto, crie um `.env.local` (fica fora do git) com o `CLIENT_ID` impresso e rode `npm run dev`:

   ```
   VITE_API_URL=http://localhost:3001
   VITE_COGNITO_REGION=sa-east-1
   VITE_COGNITO_CLIENT_ID=<CLIENT_ID impresso>
   VITE_COGNITO_ENDPOINT=http://localhost:3001/
   ```

4. Entre com o CPF `52998224725` e a senha temporária `Temporaria#2026`. O painel pede uma senha nova e
   depois mostra o QR code do MFA: no servidor local **qualquer código de 6 dígitos** é aceito.

Os dados ficam só na memória do servidor e somem quando ele para. Reiniciou o servidor? Atualize o
`CLIENT_ID` no `.env.local` e reinicie o `npm run dev`.

Para olhar só o visual, sem login nem API, apague o `.env.local`: o app volta ao modo demonstração.

## Fluxo de trabalho

- A `main` publica direto no site real (Vercel). Trabalhe numa branch e abra um pull request.
- Todo push e pull request roda o CI do GitHub ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):
  lint, testes e build do front; testes e cfn-lint do backend. Só faça merge com tudo verde.
- A Vercel gera um link de pré-visualização para cada pull request. As variáveis `VITE_*` ficam marcadas só
  para **Production** na Vercel, então a pré-visualização roda em modo demonstração e nunca toca nos dados reais.
- Antes de subir, rode localmente: `npm run lint`, `npm test` e `npm run build`.
- Precisa de uma rota nova na API? Combine antes: a validação e as regras ficam no backend.

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
