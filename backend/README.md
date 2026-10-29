# Backend do painel (AWS SAM)

Cognito (login) + API Gateway HTTP API (autorizador JWT) + Lambdas Python 3.12 + DynamoDB
criptografado com chave KMS própria. Região padrão: `sa-east-1` (São Paulo).

```
src/painel/api.py              handlers (uma Lambda por rota)
src/painel/comum/validacao.py  validação no servidor (fonte da verdade)
src/painel/comum/repositorio.py  DynamoDB: chaves, transações, contadores, auditoria
template.yaml                  infraestrutura
scripts/cadastrar.py           cria unidades e farmacêuticos
scripts/servidor_local.py      backend local simulado (moto) para testar o front
tests/                         pytest com DynamoDB e Cognito simulados
```

## Rotas

| Método | Rota | O que faz |
|---|---|---|
| GET | `/dashboard` | atendimentos de hoje + indicadores da unidade. Admin: `?unidade=<id>`, só agregados (`visits` vazio, resumo em `todaySummary`) |
| POST | `/visits` | registra triagem: valida, emite protocolo, grava resumo, registro clínico e auditoria |
| PATCH | `/visits/{id}` | troca desfecho e/ou Red Flag, só de quem registrou (concorrência otimista + auditoria) |
| POST | `/rnds/sync` | responde 501 até a integração com a RNDS existir |
| GET | `/unidades` | farmácias cadastradas (`id`, `name`), só para a administração escolher no painel |
| GET | `/medicos` | médicos ativos (`id` = sub do Cognito, `name`; sem CPF), para o farmacêutico escolher |
| POST | `/encaminhamentos` | farmacêutico envia um atendimento da farmácia: `{ visitId, doctorId, reason, priority: rotina\|urgente }` |
| GET | `/encaminhamentos[?status=]` | farmacêutico: os da farmácia; médico: a caixa dele (resumos, sem ficha) |
| GET | `/encaminhamentos/{id}` | detalhe com a ficha copiada no envio; a primeira abertura pelo médico marca `read` |
| PATCH | `/encaminhamentos/{id}` | médico: `{ status: answered\|declined, response }`; farmácia: `{ status: cancelled }` |

Todas exigem o **token de acesso** do Cognito no cabeçalho `Authorization`.

## Papéis e permissões

Grupos do Cognito no token: `papel:<nome>` (um ou mais; as permissões somam) e `unidade:<id>` (no máximo uma).
A tabela é a de `src/painel/comum/auth.py`; o front espelha em `src/services/permissoes.js` só para esconder telas.

| | Farmacêutico | Médico | Admin (Sincofarma) |
|---|---|---|---|
| Unidade | obrigatória | não usa | não usa |
| Atendimentos com dados do paciente | da própria unidade | só os encaminhados a ele (rotas a fazer) | nunca |
| Indicadores | da própria unidade | não | de qualquer unidade (`?unidade=`, lista em `/unidades`) |
| Registrar triagem | sim | não | não |
| Mudar desfecho e Red Flag | só nos que registrou | não | não |

Páginas do site por perfil (front): farmacêutico vê Dashboard, Atendimentos, Nova Triagem e Encaminhamentos;
médico, só Encaminhamentos; administração, Dashboard (só números), Farmácias e Relatórios. Atendimentos chegam com `mine: true/false` (quem vê é quem registrou). Sem nenhum `papel:*` a API responde 403.

## Encaminhamentos

Estados: `sent` (enviado) → `read` (médico abriu) → `answered` (respondido) ou `declined` (recusado, com motivo).
A farmácia pode cancelar (`cancelled`) enquanto não houver resposta. Mudanças concorrentes dão 409.

- O médico **não** lê o registro clínico da farmácia: cada encaminhamento leva uma **cópia da ficha no momento
  do envio** (queixa, histórico, sinais vitais, risco, observações) e os dados do paciente para contato, com o
  CPF mascarado. Mudanças posteriores no atendimento não alteram o que foi encaminhado.
- Médico vê só os endereçados a ele; farmácia vê os que ela enviou; administração não vê (números irão para
  Relatórios). Fora disso a resposta é 404, como se não existisse.
- Toda ação (envio, leitura, resposta, recusa, cancelamento) entra na auditoria do atendimento.
- Médico é cadastrado com `--papel medico` (sem unidade e sem CRF) e identificado pelo `sub` do Cognito.

## Dados

- **Tabela painel**: resumo do atendimento (nome, CPF anonimizado, queixa, sinais, desfecho) e contadores.
- **Tabela clínico**: dados pessoais e clínicos completos, encaminhamentos (com a cópia da ficha) e a trilha de
  auditoria. O front só a lê pelas rotas de encaminhamento, e só o que cada perfil pode ver.
- O servidor recalcula urgência, sinais, CPF anonimizado, RT e protocolo; não confia no navegador.

## Desenvolvimento

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows
.venv/Scripts/python -m pytest                               # 47 testes
.venv/Scripts/cfn-lint --regions sa-east-1 -- template.yaml
```

Testar o front contra o backend sem AWS:

```bash
.venv/Scripts/python scripts/servidor_local.py --porta 3001 --origem http://localhost:5173
# imprime o CLIENT_ID e um usuário por papel (farmacêutico, administrador, médico), senha temporária Temporaria#2026
```

## Deploy

Pré-requisitos: AWS CLI configurada **com um usuário ou função de deploy (não o root)** e o SAM CLI.

```bash
cd backend
sam build
sam deploy                                   # dev (samconfig.toml), pede confirmação do changeset
sam deploy --config-env prod \
  --parameter-overrides Stage=prod AllowedOrigins=https://SEU-DOMINIO.vercel.app AlarmEmail=voce@exemplo.com
```

Depois do deploy:

```bash
python scripts/cadastrar.py unidade --stack sincofarma-painel-dev --id asa-sul \
  --nome "Drogaria Planalto - Asa Sul" --meta-mensal 525
python scripts/cadastrar.py usuario --stack sincofarma-painel-dev --papel farmaceutico --unidade asa-sul \
  --cpf 52998224725 --crf 4192 --nome "Dra. Ana Souza" --email ana@exemplo.com.br
python scripts/cadastrar.py usuario --stack sincofarma-painel-dev --papel admin \
  --cpf 11144477735 --nome "Gestor Sincofarma" --email gestor@exemplo.com.br
# dar ou tirar papel de quem já existe (vale no próximo login)
python scripts/cadastrar.py papel --stack sincofarma-painel-dev --cpf 52998224725 --adicionar admin
```

No front (Vercel → Settings → Environment Variables), com as saídas do stack:

```
VITE_API_URL=<ApiUrl>
VITE_COGNITO_REGION=<Region>
VITE_COGNITO_CLIENT_ID=<UserPoolClientId>
```

## Decisões e limites atuais

- Login por `USER_PASSWORD_AUTH` (a senha vai por TLS direto ao Cognito). Tokens de 15 min, sessão de até 12 h,
  revogação ligada; refresh token só no `sessionStorage`.
- MFA obrigatório por app autenticador (TOTP). No primeiro login o painel mostra o QR code para cadastrar o app;
  nos seguintes, pede o código de 6 dígitos. Se o farmacêutico perder o celular, o gestor remove o MFA do usuário
  no Cognito (`admin-set-user-mfa-preference`) e o cadastro do app é refeito no próximo login.
- Proteção contra ameaças do Cognito não configurada: recomendada antes de produção.
- Em `prod`, tabelas e user pool têm proteção contra exclusão; tabelas ficam retidas se o stack for apagado.
- Sem WAF na API (HTTP API não suporta WAF diretamente); há limite de taxa por rota.
