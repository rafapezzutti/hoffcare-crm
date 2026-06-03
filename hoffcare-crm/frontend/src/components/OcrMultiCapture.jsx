import { useState, useRef } from 'react';
import api from '../services/api';

/**
 * OcrMultiCapture — captura múltipla de imagens/documentos para preencher
 * dados de um único paciente.
 *
 * Fluxo:
 *  1. Usuário adiciona N arquivos (fotos ou documentos)
 *  2. Cada arquivo é processado pela IA individualmente
 *  3. Os resultados são mesclados (primeiro valor não-nulo vence)
 *  4. Usuário revisa os dados mesclados antes de confirmar
 *
 * Props:
 *   onExtracted(data) — chamado com os dados mesclados após confirmação
 *   onClose()         — fechar o modal
 */

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const DOC_EXTS    = ['.xlsx', '.xls', '.csv', '.docx', '.doc', '.txt', '.pdf'];

const isImage = (file) => IMAGE_TYPES.includes(file.type);
const isDoc   = (file) => DOC_EXTS.some(ext => file.name.toLowerCase().endsWith(ext));

const FIELD_LABELS = {
  name:      'Nome completo',
  cpf:       'CPF',
  birthdate: 'Data de Nascimento',
  phone:     'Telefone',
  email:     'E-mail',
  address:   'Endereço',
  gender:    'Gênero',
  profession:'Profissão',
  notes:     'Observações',
};

// Mescla N resultados: para cada campo, usa o primeiro valor não-nulo/vazio
function mergeResults(results) {
  const merged = {};
  const fields = Object.keys(FIELD_LABELS);
  for (const field of fields) {
    for (const r of results) {
      const val = r[field];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        merged[field] = val;
        break;
      }
    }
    if (merged[field] === undefined) merged[field] = '';
  }
  return merged;
}

export default function OcrMultiCapture({ onExtracted, onClose }) {
  const [files, setFiles]       = useState([]);   // [{ file, id, preview }]
  const [step, setStep]         = useState('select'); // select | processing | review
  const [statuses, setStatuses] = useState([]);   // [{ id, status, result, error }]
  const [merged, setMerged]     = useState({});
  const [error, setError]       = useState(null);

  const fileInputRef   = useRef();
  const cameraInputRef = useRef();

  // ── Adicionar arquivos ───────────────────────────────────────────────────────
  const addFiles = (incoming) => {
    const valid = [...incoming].filter(f => isImage(f) || isDoc(f));
    if (valid.length === 0) {
      setError('Formato não suportado. Use JPG, PNG, PDF, DOCX, etc.');
      return;
    }
    setError(null);
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({
        file: f,
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        preview: isImage(f) ? URL.createObjectURL(f) : null,
      })),
    ]);
  };

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

  const handleDrop = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  // ── Processamento ────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (files.length === 0) { setError('Adicione pelo menos um arquivo.'); return; }
    setError(null);
    setStep('processing');

    const initialStatuses = files.map(f => ({ id: f.id, status: 'pending', result: null, error: null }));
    setStatuses(initialStatuses);

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const { file, id } = files[i];

      setStatuses(prev => prev.map(s => s.id === id ? { ...s, status: 'processing' } : s));

      try {
        let data;
        const form = new FormData();

        if (isImage(file)) {
          form.append('image', file);
          form.append('type', 'patient');
          const res = await api.post('/ocr/extract', form, { headers: { 'Content-Type': 'multipart/form-data' } });
          data = res.data.data;
        } else {
          form.append('file', file);
          const res = await api.post('/ocr/extract-document', form, { headers: { 'Content-Type': 'multipart/form-data' } });
          // extract-document retorna array; pega o primeiro elemento se houver
          const arr = Array.isArray(res.data.data) ? res.data.data : [res.data.data];
          data = arr[0] || {};
        }

        results.push(data);
        setStatuses(prev => prev.map(s => s.id === id ? { ...s, status: 'done', result: data } : s));
      } catch (err) {
        const msg = err.response?.data?.error || 'Erro ao processar';
        setStatuses(prev => prev.map(s => s.id === id ? { ...s, status: 'error', error: msg } : s));
      }
    }

    const mergedData = mergeResults(results);
    setMerged(mergedData);
    setStep('review');
  };

  // ── Revisão ──────────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    // Normaliza CPF
    const final = {
      ...merged,
      cpf: merged.cpf ? String(merged.cpf).replace(/\D/g, '') : '',
      phone: merged.phone ? String(merged.phone).replace(/\D/g, '') : '',
    };
    onExtracted(final);
  };

  // ── Estilos ───────────────────────────────────────────────────────────────────
  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 },
    modal:   { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
    header:  { padding: '16px 24px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body:    { padding: '20px 24px', overflowY: 'auto', flex: 1 },
    footer:  { padding: '12px 24px', borderTop: '1px solid #eee', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' },
    dropzone:{ border: '2px dashed #4DB8E8', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(77,184,232,0.04)', marginBottom: 16 },
    btn: (v) => ({
      padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
      background: v === 'primary' ? '#E8841A' : v === 'blue' ? '#4DB8E8' : '#f1f3f5',
      color: v === 'secondary' ? '#495057' : '#fff',
    }),
    fileCard:{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #eee', borderRadius: 10, marginBottom: 8, background: '#fafafa' },
    statusBadge: (st) => ({
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
      background: st === 'done' ? '#e8f5e9' : st === 'error' ? '#ffebee' : st === 'processing' ? '#e3f2fd' : '#f5f5f5',
      color: st === 'done' ? '#2e7d32' : st === 'error' ? '#c62828' : st === 'processing' ? '#1565c0' : '#999',
    }),
    field:   { marginBottom: 14 },
    label:   { display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 },
    input:   { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fafafa', boxSizing: 'border-box' },
  };

  const fileIcon = (f) => {
    if (isImage(f.file)) return f.preview
      ? <img src={f.preview} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
      : <span style={{ fontSize: 28 }}>🖼️</span>;
    if (f.file.name.endsWith('.pdf')) return <span style={{ fontSize: 28 }}>📄</span>;
    if (f.file.name.endsWith('.docx') || f.file.name.endsWith('.doc')) return <span style={{ fontSize: 28 }}>📝</span>;
    return <span style={{ fontSize: 28 }}>📁</span>;
  };

  const statusIcon = (st) => ({ done: '✅', error: '❌', processing: '⏳', pending: '⏸️' }[st] || '');
  const statusLabel = (st) => ({ done: 'Extraído', error: 'Erro', processing: 'Processando...', pending: 'Aguardando' }[st] || st);

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Captura com IA — Dados do Paciente</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {step === 'select'     && 'Adicione fotos ou documentos do paciente'}
                {step === 'processing' && 'Extraindo dados de cada arquivo...'}
                {step === 'review'     && 'Revise os dados mesclados antes de confirmar'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999' }}>×</button>
        </div>

        {/* Body */}
        <div style={s.body}>

          {/* STEP: select */}
          {step === 'select' && (
            <>
              {/* Drop zone */}
              <div
                style={s.dropzone}
                onClick={() => fileInputRef.current.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Clique ou arraste arquivos aqui</div>
                <div style={{ fontSize: 12, color: '#999' }}>JPG · PNG · PDF · DOCX · máx. 10 MB por arquivo</div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.docx,.doc,.txt,.csv" style={{ display: 'none' }}
                onChange={e => addFiles(e.target.files)} />

              {/* Botão câmera */}
              <button style={{ ...s.btn('secondary'), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}
                onClick={() => cameraInputRef.current.click()}>
                📷 Tirar foto com a câmera
              </button>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => addFiles(e.target.files)} />

              {/* Dica */}
              <div style={{ background: 'rgba(77,184,232,0.07)', border: '1px solid rgba(77,184,232,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#555', marginBottom: 16 }}>
                💡 <strong>Dica:</strong> adicione frente e verso do RG/CNH, ficha de cadastro, cartão do convênio — a IA combina os dados de todos os arquivos automaticamente.
              </div>

              {error && (
                <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#856404' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Lista de arquivos adicionados */}
              {files.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>
                    {files.length} arquivo{files.length !== 1 ? 's' : ''} selecionado{files.length !== 1 ? 's' : ''}:
                  </div>
                  {files.map(f => (
                    <div key={f.id} style={s.fileCard}>
                      {fileIcon(f)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>{(f.file.size / 1024).toFixed(0)} KB</div>
                      </div>
                      <button onClick={() => removeFile(f.id)}
                        style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* STEP: processing */}
          {step === 'processing' && (
            <div>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Processando cada arquivo com a IA. Aguarde...</p>
              {statuses.map((s2, i) => {
                const f = files[i];
                return (
                  <div key={s2.id} style={s.fileCard}>
                    {fileIcon(f)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</div>
                      {s2.error && <div style={{ fontSize: 11, color: '#c62828', marginTop: 2 }}>{s2.error}</div>}
                    </div>
                    <div>
                      <span style={s.statusBadge(s2.status)}>{statusIcon(s2.status)} {statusLabel(s2.status)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div>
              {/* Resumo do processamento */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {statuses.map((s2, i) => (
                  <div key={s2.id} style={{ ...s.fileCard, flex: '0 0 auto', maxWidth: 200, padding: '6px 10px' }}>
                    <span style={{ fontSize: 16 }}>{statusIcon(s2.status)}</span>
                    <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{files[i]?.file.name}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#2e7d32' }}>
                ✅ Dados combinados de {statuses.filter(s => s.status === 'done').length} arquivo{statuses.filter(s => s.status === 'done').length !== 1 ? 's' : ''}. Revise e edite se necessário.
              </div>

              {/* Campos editáveis */}
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field} style={s.field}>
                  <label style={s.label}>{label}</label>
                  <input
                    style={s.input}
                    value={merged[field] || ''}
                    onChange={e => setMerged(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={`${label}...`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          {step === 'select' && (
            <>
              <button style={s.btn('secondary')} onClick={onClose}>Cancelar</button>
              <button
                style={{ ...s.btn('blue'), opacity: files.length === 0 ? 0.5 : 1 }}
                disabled={files.length === 0}
                onClick={handleProcess}
              >
                🤖 Extrair dados com IA ({files.length} arquivo{files.length !== 1 ? 's' : ''})
              </button>
            </>
          )}

          {step === 'processing' && (
            <span style={{ fontSize: 13, color: '#888' }}>Aguarde o processamento...</span>
          )}

          {step === 'review' && (
            <>
              <button style={s.btn('secondary')} onClick={() => { setStep('select'); setStatuses([]); setMerged({}); }}>
                Voltar
              </button>
              <button style={s.btn('primary')} onClick={handleConfirm}>
                ✅ Preencher formulário
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
