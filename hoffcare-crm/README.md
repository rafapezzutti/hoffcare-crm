# HoffCare CRM — Clínica & Odonto

Sistema web de gestão para clínicas médicas e odontológicas.

**powered by P. Soluções**

---

## Stack Tecnológica

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Banco de Dados:** PostgreSQL (Neon.tech)
- **Hospedagem:** Render.com
- **Repositório:** GitHub

---

## Estrutura do Projeto

```
hoffcare-crm/
├── backend/          ← API Node.js
│   ├── src/
│   │   ├── config/   ← Conexão banco + migrations
│   │   ├── middleware/
│   │   └── routes/   ← auth, users, clinics, professionals, rooms, procedures, patients, appointments, records
│   ├── migrations/
│   │   └── 001_initial.sql
│   └── seeds/
│       ├── seed.js
│       └── procedures.sql  ← 118 procedimentos odonto + 500 TUSS médicos
└── frontend/         ← React App
    └── src/
        ├── pages/    ← Login, Dashboard, Calendários, Cadastros, etc.
        ├── components/
        ├── context/
        └── services/
```

---

## Setup Completo (Passo a Passo)

### 1. GitHub — Criar Repositório

1. Acesse https://github.com e crie um novo repositório: `hoffcare-crm`
2. Clone localmente: `git clone https://github.com/SEU_USUARIO/hoffcare-crm`
3. Copie os arquivos deste projeto para a pasta clonada
4. Commit inicial:
   ```bash
   git add .
   git commit -m "Initial commit - HoffCare CRM"
   git push origin main
   ```

---

### 2. Neon.tech — Banco de Dados PostgreSQL

1. Acesse https://neon.tech e crie uma conta gratuita
2. Crie um novo projeto: `hoffcare-db`
3. Na aba **Connection Details**, copie a **Connection String** (formato: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
4. Guarde essa string — você vai precisar nos próximos passos

---

### 3. Render.com — Backend (API)

1. Acesse https://render.com e conecte com seu GitHub
2. Clique em **New → Web Service**
3. Selecione o repositório `hoffcare-crm`
4. Configure:
   - **Name:** `hoffcare-api`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Em **Environment Variables**, adicione:
   ```
   DATABASE_URL = [sua connection string do Neon.tech]
   JWT_SECRET   = [gere uma chave segura: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"]
   NODE_ENV     = production
   FRONTEND_URL = https://hoffcare-crm.onrender.com
   PORT         = 3001
   ```
6. Clique em **Create Web Service**
7. Anote a URL gerada (ex: `https://hoffcare-api.onrender.com`)

---

### 4. Criar Tabelas e Seed Inicial

Após o deploy do backend, execute localmente (com o `.env` preenchido):

```bash
cd backend
cp .env.example .env
# Edite o .env com a DATABASE_URL do Neon.tech

npm install
node src/config/migrate.js   # Cria as tabelas
node seeds/seed.js           # Insere procedimentos + usuário admin
```

**Login padrão após seed:**
- Email: `admin@hoffcare.com.br`
- Senha: `admin123`
- ⚠️ Altere a senha após o primeiro login!

---

### 5. Render.com — Frontend (React)

1. No Render, clique em **New → Static Site**
2. Selecione o mesmo repositório
3. Configure:
   - **Name:** `hoffcare-crm`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Em **Environment Variables**, adicione:
   ```
   VITE_API_URL = https://hoffcare-api.onrender.com/api
   ```
5. Clique em **Create Static Site**

---

## Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| Login | Tela de acesso com perfil admin e responsável |
| Dashboard | Estatísticas, agenda do dia e ações rápidas |
| Agenda Diária | Calendário hora a hora, adicionar/editar consultas |
| Calendário Mensal | Visão mensal de todas as consultas |
| Pacientes | Cadastro completo com declaração de saúde e anexos |
| Profissionais | Cadastro de médicos e dentistas |
| Salas | Cadastro de salas médicas e odontológicas |
| Procedimentos | Lista completa TUSS + Odontológicos, editável |
| Registro Pós-Consulta | Lançamento de procedimentos com valores e totalizador |
| Impressão/PDF | Geração de documento A4 com assinaturas |
| Histórico | Busca por nome ou CPF com histórico completo |
| Consultórios | Gerenciar unidades (admin only) |
| Usuários | Criar perfis admin e responsável (admin only) |

---

## Procedimentos Pré-carregados

- **118** procedimentos odontológicos (Lista PF Saúde / tabela CHO)
- **~500** procedimentos médicos (Tabela TUSS/SASSEPE atualizada 2024)

---

## Cores HoffCare

```css
--orange: #E8841A   /* Logo e destaques */
--blue:   #4DB8E8   /* Interface principal */
```

---

## Segurança

- Autenticação JWT com expiração de 12h
- Senhas criptografadas com bcrypt (salt 10)
- Banco segregado por consultório
- SSL obrigatório em produção (Neon.tech)

---

## Contato / Suporte

**P. Soluções** — powered by P. Soluções
