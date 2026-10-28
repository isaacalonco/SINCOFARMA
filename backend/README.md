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
| GET | `/dashboard` | atendimentos de hoje + indicadores da unidade |
| POST | `/visits` | registra triagem: valida, emite protocolo, grava resumo, registro clínico e auditoria |
| PATCH | `/visits/{id}` | troca desfecho e/ou Red Flag (concorrência otimista + auditoria) |
| POST | `/rnds/sync` | responde 501 até a integração com a RNDS existir |

Todas exigem o **token de acesso** do Cognito no cabeçalho `Authorization`. A unidade do usuário
vem do grupo `unidade:<id>` no token; cada usuário pertence a exatamente uma unidade.

## Dados

- **Tabela painel**: resumo do atendimento (nome, CPF anonimizado, queixa, sinais, desfecho) e contadores.
- **Tabela clínico**: dados pessoais e clínicos completos e a trilha de auditoria. O front nunca lê esta tabela.
- O servidor recalcula urgência, sinais, CPF anonimizado, RT e protocolo; não confia no navegador.

## Desenvolvimento

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows
.venv/Scripts/python -m pytest                               # 20 testes
.venv/Scripts/cfn-lint --regions sa-east-1 -- template.yaml
```

Testar o front contra o backend sem AWS:

```bash
.venv/Scripts/python scripts/servidor_local.py --porta 3001 --origem http://localhost:5174
# imprime o CLIENT_ID; o usuário de teste é CPF 52998224725 / senha temporária Temporaria#2026
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
python scripts/cadastrar.py usuario --stack sincofarma-painel-dev --unidade asa-sul \
  --cpf 52998224725 --crf 4192 --nome "Dra. Ana Souza" --email ana@exemplo.com.br
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
- MFA desligado e proteção contra ameaças do Cognito não configurada: recomendados antes de produção.
- Em `prod`, tabelas e user pool têm proteção contra exclusão; tabelas ficam retidas se o stack for apagado.
- Sem WAF na API (HTTP API não suporta WAF diretamente); há limite de taxa por rota.
