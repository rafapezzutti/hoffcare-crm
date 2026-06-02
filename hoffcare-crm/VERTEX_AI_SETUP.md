# Vertex AI — Guia de Configuração e Deploy

Integração do P. Saúde com o Google Vertex AI (Gemini Vision) para leitura automática de documentos físicos via OCR + IA.

---

## 1. Pré-requisitos

- Conta Google (pode ser a mesma do Google Workspace)
- Acesso ao [Google Cloud Console](https://console.cloud.google.com)
- Node.js instalado localmente
- Projeto P. Saúde clonado e rodando

---

## 2. Google Cloud — Criar o Projeto

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Clique em **Selecionar projeto** → **Novo projeto**
3. Nome sugerido: `psaude-vertexai`
4. Clique em **Criar**
5. Anote o **ID do projeto** (ex: `psaude-vertexai-123456`) — você vai precisar dele

---

## 3. Ativar a Vertex AI API

1. No menu esquerdo → **APIs e serviços** → **Biblioteca**
2. Pesquise: `Vertex AI API`
3. Clique em **Ativar**
4. Aguarde alguns segundos

---

## 4. Criar a Service Account (Conta de Serviço)

1. No menu → **IAM e administrador** → **Contas de serviço**
2. Clique em **+ Criar conta de serviço**
3. Preencha:
   - **Nome**: `psaude-ocr`
   - **ID**: `psaude-ocr` (gerado automaticamente)
   - Descrição: `Leitura de documentos via Vertex AI`
4. Clique em **Criar e continuar**
5. Em **Conceder acesso a este projeto**, adicione o papel:
   - **Vertex AI → Usuário do Vertex AI**
6. Clique em **Continuar** → **Concluído**

---

## 5. Gerar a Chave JSON

1. Na lista de contas de serviço, clique na que você acabou de criar (`psaude-ocr`)
2. Aba **Chaves** → **Adicionar chave** → **Criar nova chave**
3. Selecione **JSON** → **Criar**
4. O arquivo `psaude-vertexai-XXXXXX.json` será baixado automaticamente
5. **Guarde este arquivo em local seguro — não suba para o GitHub**

---

## 6. Instalar o pacote no Backend

No terminal, dentro da pasta `backend`:

```bash
npm install @google-cloud/vertexai
```

---

## 7. Configurar as Variáveis de Ambiente (Local)

1. Abra o arquivo `backend/.env`
2. Adicione as variáveis abaixo:

```env
GOOGLE_CLOUD_PROJECT=psaude-vertexai-123456
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.0-flash-001
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

**Como converter o JSON para uma linha só** (necessário para a variável de ambiente):

No terminal Linux/Mac:
```bash
cat psaude-vertexai-XXXXXX.json | tr -d '\n'
```

No PowerShell (Windows):
```powershell
(Get-Content psaude-vertexai-XXXXXX.json -Raw) -replace "`r`n","\n" -replace "`n","\n"
```

Cole o resultado no valor de `GOOGLE_CREDENTIALS_JSON`.

**Atenção:** A chave privada (`private_key`) contém `\n` reais — não remova esses caracteres, apenas as quebras de linha entre as propriedades do JSON.

---

## 8. Testar Localmente

Inicie o backend:
```bash
cd backend
npm start
```

Teste com curl:
```bash
curl -X POST http://localhost:3001/api/ocr/extract \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -F "image=@/caminho/para/foto.jpg" \
  -F "type=patient"
```

Resposta esperada:
```json
{
  "success": true,
  "type": "patient",
  "data": {
    "name": "Maria da Silva",
    "cpf": "12345678900",
    "birthdate": "1985-03-15",
    "phone": "11987654321",
    "email": "maria@email.com",
    "address": "Rua das Flores, 123 - São Paulo/SP",
    ...
  }
}
```

---

## 9. Deploy no Render

### 9.1 Adicionar as variáveis de ambiente

1. Acesse [render.com](https://render.com) → seu serviço de backend (`hoffcare-api`)
2. Aba **Environment** → **Add Environment Variable**
3. Adicione cada variável:

| Chave | Valor |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | ID do seu projeto (ex: `psaude-vertexai-123456`) |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` |
| `VERTEX_MODEL` | `gemini-2.0-flash-001` |
| `GOOGLE_CREDENTIALS_JSON` | Conteúdo JSON em uma única linha |

> **Dica Render:** Para `GOOGLE_CREDENTIALS_JSON`, cole o conteúdo completo do arquivo JSON (em uma linha) diretamente no campo de valor. O Render escapa as aspas automaticamente.

### 9.2 Redeploy

Após adicionar as variáveis:
1. Aba **Manual Deploy** → **Deploy latest commit**
2. Aguarde o build finalizar
3. Verifique nos logs: `HoffCare API running on port 3001`

---

## 10. Usando no Frontend

O componente `OcrCapture` já está pronto. Para usar em qualquer página:

```jsx
import { useState } from 'react';
import OcrCapture from '../components/OcrCapture';

export default function MinhaPage() {
  const [showOcr, setShowOcr] = useState(false);
  const [form, setForm]       = useState({ name: '', cpf: '', phone: '' });

  const handleExtracted = (data) => {
    // Preenche o formulário com os dados extraídos
    setForm(prev => ({
      ...prev,
      name:  data.name  || prev.name,
      cpf:   data.cpf   || prev.cpf,
      phone: data.phone || prev.phone,
    }));
    setShowOcr(false);
  };

  return (
    <div>
      <button onClick={() => setShowOcr(true)}>
        📷 Ler do papel
      </button>

      {showOcr && (
        <OcrCapture
          type="patient"
          onExtracted={handleExtracted}
          onClose={() => setShowOcr(false)}
        />
      )}

      {/* Formulário normal */}
      <input value={form.name}  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      <input value={form.cpf}   onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} />
      <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
    </div>
  );
}
```

### Tipos disponíveis

| type | Documento | Campos extraídos |
|---|---|---|
| `patient` | Ficha de cadastro | nome, cpf, nascimento, telefone, email, endereço |
| `anamnesis` | Ficha de anamnese | queixa, alergias, medicamentos, histórico, hábitos |
| `financial` | Recibo / histórico financeiro | procedimentos, valores, forma de pagamento |
| `evolution` | Evolução clínica (SOAP) | subjetivo, objetivo, avaliação, plano |

---

## 11. Custos e Limites

O Vertex AI Gemini Flash é cobrado por tokens. Para o volume típico de uma clínica:

| Situação | Estimativa |
|---|---|
| 1 documento processado | ~0,001 USD (menos de R$0,01) |
| 100 documentos/mês | ~R$ 0,50 a R$ 1,00 |
| 500 documentos/mês | ~R$ 2,50 a R$ 5,00 |

**Crédito gratuito:** Contas novas no Google Cloud recebem **$300 de crédito** por 90 dias — suficiente para meses de uso.

Para monitorar o consumo: Google Cloud Console → **Faturamento** → **Relatórios**.

---

## 12. LGPD — Considerações de Privacidade

- As imagens são processadas **em memória** — não são gravadas em disco nem no banco de dados
- A transmissão para o Vertex AI usa **HTTPS/TLS** obrigatório
- O Google Cloud **não usa os dados para treinar modelos** quando via Vertex AI (diferente do AI Studio gratuito)
- Para máxima conformidade, use a região `southamerica-east1` (São Paulo) nas variáveis de ambiente — os dados não sairão do Brasil
- Recomendado: adicionar cláusula de consentimento informando ao paciente que documentos podem ser processados por IA

---

## 13. Solução de Problemas

**Erro: `GOOGLE_CLOUD_PROJECT não configurado`**
→ Verifique se a variável foi adicionada corretamente no Render.

**Erro: `PERMISSION_DENIED`**
→ A Service Account não tem o papel "Usuário do Vertex AI". Revise o passo 4.

**Erro: `GOOGLE_CREDENTIALS_JSON inválido`**
→ O JSON provavelmente tem quebras de linha. Use o comando do passo 7 para converter.

**Erro: `A IA não retornou um JSON válido`**
→ A imagem está ilegível ou muito escura. Peça ao usuário para tirar uma foto com melhor iluminação.

**Erro: `RESOURCE_EXHAUSTED`**
→ Limite de requisições por minuto atingido. Aguarde 1 minuto e tente novamente.
