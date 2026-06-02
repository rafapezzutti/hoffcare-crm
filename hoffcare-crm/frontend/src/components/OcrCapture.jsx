import { useState, useRef } from 'react';
import api from '../services/api';

/**
 * OcrCapture — componente reutilizável para captura e extração de dados via Vertex AI
 *
 * Props:
 *   type        — 'patient' | 'anamnesis' | 'financial' | 'evolution'
 *   onExtracted — callback(data) chamado com os dados extraídos após revisão
 *   onClose     — callback para fechar o modal
 */

const TYPE_LABELS = {
  patient:   { title: 'Dados Pessoais',      icon: '👤', color: '#E8841A' },
  anamnesis: { title: 'Anamnese',             icon: '📋', color: '#4DB8E8' },
  financial: { title: 'Histórico Financeiro', icon: '💰', color: '#28a745' },
  evolution: { title: 'Evolução Clínica',     icon: '🩺', color: '#6f42c1' },
};

export default function OcrCapture({ type = 'patient', onExtracted, onClose }) {
  const [step, setStep]           = useState('capture');  // capture | preview | review | done
  const [imageUrl, setImageUrl]   = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [editData, setEditData]   = useState(null);
  const fileRef  = useRef();
  const cameraRef = useRef();

  const meta = TYPE_LABELS[type] || TYPE_LABELS.patient;

  // ── Captura de imagem ────────────────────────────────────────────────────────

  const handleFile = (file) => {
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setError(null);
    setStep('preview');
  };

  const handleFileInput = (e) => handleFile(e.target.files[0]);
  const handleCamera    = (e) => handleFile(e.target.files[0]);
  const handleDrop      = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  // ── Envio para a API ─────────────────────────────────────────────────────────

  const handleExtract = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('image', imageFile);
      form.append('type', type);

      const res = await api.post('/ocr/extract', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setExtracted(res.data.data);
      setEditData(flattenForEdit(res.data.data));
      setStep('review');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar imagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers de edição ────────────────────────────────────────────────────────

  // Transforma dados extraídos em campos editáveis simples (sem arrays)
  const flattenForEdit = (data) => {
    const flat = {};
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        flat[key] = JSON.stringify(val, null, 2);
      } else {
        flat[key] = val ?? '';
      }
    }
    return flat;
  };

  const rebuildData = () => {
    const result = {};
    for (const [key, val] of Object.entries(editData)) {
      if (typeof val === 'string' && val.startsWith('[')) {
        try { result[key] = JSON.parse(val); } catch { result[key] = val; }
      } else {
        result[key] = val === '' ? null : val;
      }
    }
    return result;
  };

  const handleConfirm = () => {
    const finalData = rebuildData();
    setStep('done');
    onExtracted?.(finalData);
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const fieldLabel = (key) => {
    const map = {
      name: 'Nome', cpf: 'CPF', birthdate: 'Data de Nascimento', phone: 'Telefone',
      email: 'E-mail', address: 'Endereço', gender: 'Gênero', profession: 'Profissão',
      emergency_contact: 'Contato de Emergência', notes: 'Observações',
      chief_complaint: 'Queixa Principal', medical_history: 'Histórico Médico',
      allergies: 'Alergias', medications: 'Medicamentos em Uso',
      surgeries: 'Cirurgias Anteriores', family_history: 'Histórico Familiar',
      habits: 'Hábitos', answers: 'Respostas da Anamnese',
      date: 'Data', patient_name: 'Paciente', professional_name: 'Profissional',
      procedures: 'Procedimentos', subtotal: 'Subtotal', discount: 'Desconto',
      total: 'Total', payment_method: 'Forma de Pagamento',
      subjective: 'Subjetivo (S)', objective: 'Objetivo (O)',
      assessment: 'Avaliação (A)', plan: 'Plano (P)',
      procedures_performed: 'Procedimentos Realizados', next_appointment: 'Próxima Consulta',
    };
    return map[key] || key;
  };

  const isLongField = (key) =>
    ['notes', 'address', 'answers', 'procedures', 'medical_history', 'allergies',
     'medications', 'surgeries', 'family_history', 'habits', 'subjective', 'objective',
     'assessment', 'plan', 'procedures_performed'].includes(key);

  // ── Estilos inline ───────────────────────────────────────────────────────────

  const s = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px',
    },
    modal: {
      background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620,
      maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    },
    header: {
      padding: '18px 24px', borderBottom: '1px solid #eee',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    body: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
    footer: {
      padding: '14px 24px', borderTop: '1px solid #eee',
      display: 'flex', gap: 10, justifyContent: 'flex-end',
    },
    dropzone: {
      border: `2px dashed ${meta.color}`, borderRadius: 12,
      padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
      background: 'rgba(232,132,26,0.04)', transition: 'background 0.2s',
    },
    img: { width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 10 },
    row: { marginBottom: 14 },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 },
    input: {
      width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8,
      fontSize: 14, background: '#fafafa', resize: 'vertical',
    },
    badge: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${meta.color}18`, color: meta.color,
      border: `1px solid ${meta.color}44`,
      borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600,
    },
    btn: (variant) => ({
      padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
      cursor: 'pointer', border: 'none',
      background: variant === 'primary' ? meta.color : variant === 'secondary' ? '#f1f3f5' : '#dc3545',
      color: variant === 'primary' ? '#fff' : variant === 'secondary' ? '#495057' : '#fff',
    }),
  };

  // ── Steps ────────────────────────────────────────────────────────────────────

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{meta.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Leitura de Documento</div>
              <div style={s.badge}>{meta.title}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999' }}>×</button>
        </div>

        {/* Body */}
        <div style={s.body}>

          {/* STEP: capture */}
          {step === 'capture' && (
            <div>
              <p style={{ marginBottom: 16, color: '#666', fontSize: 14 }}>
                Tire uma foto ou faça upload do documento físico. A IA irá extrair os dados automaticamente para você revisar antes de salvar.
              </p>
              <div
                style={s.dropzone}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current.click()}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Clique para selecionar ou arraste a imagem aqui</div>
                <div style={{ fontSize: 12, color: '#999' }}>JPG, PNG ou WEBP • máx. 10 MB</div>
              </div>

              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />

              <div style={{ textAlign: 'center', margin: '16px 0', color: '#aaa', fontSize: 13 }}>ou</div>

              <button
                style={{ ...s.btn('secondary'), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => cameraRef.current.click()}
              >
                📷 Tirar foto com a câmera
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCamera} />
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div>
              <p style={{ marginBottom: 12, color: '#666', fontSize: 14 }}>
                Verifique se a imagem está nítida e legível antes de processar.
              </p>
              <img src={imageUrl} alt="Documento" style={s.img} />
              {error && (
                <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 14, color: '#856404' }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && editData && (
            <div>
              <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#2e7d32' }}>
                ✅ Dados extraídos com sucesso! Revise e corrija se necessário antes de confirmar.
              </div>
              {Object.entries(editData).map(([key, val]) => (
                <div key={key} style={s.row}>
                  <label style={s.label}>{fieldLabel(key)}</label>
                  {isLongField(key) ? (
                    <textarea
                      style={{ ...s.input, minHeight: 72 }}
                      value={val}
                      onChange={(e) => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      style={s.input}
                      value={val}
                      onChange={(e) => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Dados aplicados!</div>
              <div style={{ color: '#666', fontSize: 14 }}>O formulário foi preenchido com os dados extraídos. Você pode editar antes de salvar.</div>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⏳</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Processando documento...</div>
              <div style={{ color: '#888', fontSize: 13 }}>A IA está lendo os dados. Aguarde alguns segundos.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={s.footer}>
            {step === 'capture' && (
              <button style={s.btn('secondary')} onClick={onClose}>Cancelar</button>
            )}
            {step === 'preview' && (
              <>
                <button style={s.btn('secondary')} onClick={() => { setStep('capture'); setImageUrl(null); setImageFile(null); }}>
                  Trocar imagem
                </button>
                <button style={s.btn('primary')} onClick={handleExtract}>
                  🤖 Extrair dados com IA
                </button>
              </>
            )}
            {step === 'review' && (
              <>
                <button style={s.btn('secondary')} onClick={() => setStep('preview')}>Voltar</button>
                <button style={s.btn('primary')} onClick={handleConfirm}>
                  ✅ Confirmar e preencher formulário
                </button>
              </>
            )}
            {step === 'done' && (
              <button style={s.btn('primary')} onClick={onClose}>Fechar</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
