# Deploy — HoffCare CRM

Stack: **Node.js/Express** (backend) · **React/Vite** (frontend) · **Neon** (PostgreSQL) · **Render.com** (hospedagem)

---

## Pré-requisitos

- Conta no [Render.com](https://render.com) (plano gratuito funciona)
- Conta no [Neon](https://neon.tech) (plano gratuito funciona)
- Repositório no GitHub com o código do projeto
- Node.js 18+ instalado localmente

---

## Passo 1 — Banco de dados no Neon

1. Acesse [neon.tech](https://neon.tech) e crie um projeto chamado `hoffcare-crm`
2. Selecione a região **South America (São Paulo)** para menor latência
3. Após criação, vá em **Connection Details** e copie a **Connection String** (formato `postgresql://...`)
4. Guarde essa string — ela será usada como `DATABASE_URL` nas próximas etapas

> O banco já existe se você estiver usando o `.env` atual. Pule para o Passo 2 se o banco já tiver dados.

---

## Passo 2 — Preparar o repositório

Certifique-se de que o `.gitignore` contém:

```
node_modules/
.env
backend/.env
frontend/.env
```

Se ainda não fez o commit do código, execute no terminal dentro da pasta `hoffcare-crm`:

```bash
git add .
git commit -m "chore: prepara deploy"
git push origin main
```

---

## Passo 3 — Deploy do Backend no Render

1. No Render, clique em **New → Web Service**
2. Conecte o repositório GitHub do projeto
3. Configure o serviço:

| Campo | Valor |
|---|---|
| **Name** | `hoffcare-crm-backend` |
| **Root Directory** | `hoffcare-crm/backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (ou pago se precisar de uptime garantido) |

4. Vá em **Environment Variables** e adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | A connection string do Neon (Passo 1) |
| `JWT_SECRET` | Uma string longa e aleatória (ex: gere em [randomkeygen.com](https://randomkeygen.com)) |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `FRONTEND_URL` | (preencher depois, com a URL do frontend — Passo 5) |

5. Clique em **Create Web Service** e aguarde o deploy terminar
6. Anote a URL gerada, no formato `https://hoffcare-crm-backend.onrender.com`

---

## Passo 4 — Rodar as migrations no banco

Com o backend no ar, rode as migrations pelo terminal do Render ou localmente apontando para o banco de produção.

**Opção A — Pelo Shell do Render** (mais fácil):

No painel do serviço backend, vá em **Shell** e execute:

```bash
node src/config/migrate.js
```

**Opção B — Localmente** (exige ter o Node instalado):

```bash
cd hoffcare-crm/backend
DATABASE_URL="sua-connection-string-do-neon" node src/config/migrate.js
```

Se quiser popular o banco com dados iniciais (procedimentos padrão):

```bash
node seeds/seed.js
```

---

## Passo 5 — Deploy do Frontend no Render

1. No Render, clique em **New → Static Site**
2. Conecte o mesmo repositório GitHub
3. Configure:

| Campo | Valor |
|---|---|
| **Name** | `hoffcare-crm` |
| **Root Directory** | `hoffcare-crm/frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

4. Adicione a variável de ambiente:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | URL do backend do Passo 3 (ex: `https://hoffcare-crm-backend.onrender.com`) |

5. Clique em **Create Static Site** e aguarde o build
6. Anote a URL gerada, no formato `https://hoffcare-crm.onrender.com`

---

## Passo 6 — Atualizar FRONTEND_URL no backend

Agora que o frontend está no ar:

1. Volte ao serviço de backend no Render
2. Vá em **Environment** e atualize:

| Variável | Valor |
|---|---|
| `FRONTEND_URL` | `https://hoffcare-crm.onrender.com` |

3. O Render vai reiniciar o serviço automaticamente

---

## Passo 7 — Verificar se está funcionando

Acesse no navegador:

```
https://hoffcare-crm-backend.onrender.com/api/health
```

Deve retornar `{"status":"ok"}`. Se retornar isso, o backend está vivo.

Depois acesse o frontend pela URL do Static Site e tente fazer login.

---

## Domínio próprio (opcional)

Se quiser usar `psaude.ia.br` (que já está no CORS do backend):

1. No Render, abra o Static Site → **Settings → Custom Domains**
2. Adicione `psaude.ia.br` e `www.psaude.ia.br`
3. No seu provedor de DNS, aponte um registro CNAME para o endereço que o Render indicar
4. O Render provisiona o certificado SSL automaticamente

---

## Atualizar após mudanças no código

Nenhuma ação manual necessária. Sempre que você fizer `git push origin main`, o Render detecta e faz o redeploy automático tanto do backend quanto do frontend.

Para forçar um redeploy manual: no painel do serviço → **Manual Deploy → Deploy latest commit**.

---

## Troubleshooting comum

**Backend não sobe / erro de banco**
→ Verifique se `DATABASE_URL` está correta e se o IP do Render está liberado no Neon (em Projects → IP Allow List, adicione `0.0.0.0/0` para liberar tudo)

**Frontend mostra tela em branco**
→ Verifique se `VITE_API_URL` aponta para o backend correto e não tem barra no final

**Erro de CORS**
→ Confirme que `FRONTEND_URL` no backend está com a URL exata do frontend (sem barra final)

**Plano gratuito do Render "dorme" após 15 min de inatividade**
→ Normal no free tier. O primeiro acesso após inatividade demora ~30s. Para evitar, use um cron externo (ex: [cron-job.org](https://cron-job.org)) para pingar `/api/health` a cada 10 minutos.
