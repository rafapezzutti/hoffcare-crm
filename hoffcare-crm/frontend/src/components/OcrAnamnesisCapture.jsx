import { useState, useRef } from 'react';
import api from '../services/api';

/**
 * OcrAnamnesisCapture — importação histórica de anamneses via foto
 *
 * Fluxo: upload foto → IA extrai perguntas/respostas → revisão → salva como anamnese completed
 *
 * Props:
 *   patientId  — id do paciente
 *   onClose    — fecha o modal
 *   onComplete — callback após salvar com sucesso
 */
export default function OcrAnamnesisCapture({ patientId, onClose, onComplete }) {
  const [step,      setStep]      = useState('capture');
  const [file,      setFile]      = useState(null);
  const [imageUrl,  setImageUrl]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [extracted, setExtracted] = useState(null); // raw data from OCR
  const [rows,      setRows]      = useState([]);   // [{ question, answer }]
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);

  const fileRef   = useRef();
  const cameraRef = useRef();

  // ── Seleção de arquivo ──────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'];
    if (!allowed.includes(f.type)) {
      setError('Use uma imagem JPG, PNG ou WEBP.');
      return;
    }
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setError(null);
    setStep('preview');
  };

  // ── Extração OCR ────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('type', 'anamnesis');
      const res = await api.post('/ocr/extract', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = res.data.data;

      // Monta linhas editáveis a partir da resposta da IA
      const lines = [];

      // Perguntas/respostas detectadas na ficha
      if (Array.isArray(data.answers) && data.answers.length > 0) {
        data.answers.forEach(a => {
          if (a.question?.trim()) lines.push({ question: a.question.trim(), answer: a.answer || '' });
        });
      }

      // Campos estruturados que a IA extraiu separadamente
      const estruturados = [
        { key: 'chief_complaint', label: 'Queixa principal' },
        { key: 'medical_history',  label: 'Histórico médico' },
        { key: 'allergies',        label: 'Alergias' },
        { key: 'medications',      label: 'Medicamentos em uso' },
        { key: 'surgeries',        label: 'Cirurgias / internações anteriores' },
        { key: 'family_history',   label: 'Histórico familiar' },
        { key: 'habits',           label: 'Hábitos (tabagismo, etilismo, etc.)' },
        { key: 'notes',            label: 'Observações adicionais' },
      ];

      estruturados.forEach(({ key, label }) => {
        if (data[key] && data[key] !== 'null' && String(data[key]).trim()) {
          // Não duplica se já veio em "answers"
          const alreadyIn = lines.some(l => l.question.toLowerCase().includes(label.toLowerCase()));
          if (!alreadyIn) lines.push({ question: label, answer: String(data[key]).trim() });
        }
      });

      // Garante ao menos uma linha
      if (lines.length === 0) {
        lines.push({ question: '', answer: '' });
      }

      setExtracted(data);
      setRows(lines);
      setStep('review');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar imagem. Verifique se está nítida e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Edição das linhas ───────────────────────────────────────────────────────
  const updateRow  = (i, field, value) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addRow     = () => setRows(prev => [...prev, { question: '', answer: '' }]);
  const removeRow  = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  // ── Salvar ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const valid = rows.filter(r => r.question.trim());
    if (valid.length === 0) { setError('Adicione ao menos uma pergunta.'); return; }

    setSaving(true);
    setError(null);
    try {
      // 1. Cria a anamnese
      const createRes = await api.post('/anamnesis', {
        patient_id:         patientId,
        selected_questions: valid.map(r => r.question.trim()),
        send_email:         false,
      });
      const anamnesisId = createRes.data.id;

      // 2. Preenche as respostas imediatamente
      const responses = {};
      valid.forEach((r, i) => {
        responses[i] = r.answer || '';
      });
      await api.put(`/anamnesis/${anamnesisId}/fill`, { responses });

      setDone(true);
      setStep('done');
      onComplete?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar anamnese.');
    } finally {
      setSaving(false);
    }
  };

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 },
    modal:   { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
    header:  { padding: '16px 24px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body:    { padding: '16px 24px', overflowY: 'auto', flex: 1 },
    footer:  { padding: '12px 24px', borderTop: '1px solid #eee', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' },
    btn: (v) => ({
      padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
      background: v === 'primary' ? '#34d399' : v === 'blue' ? '#4DB8E8' : '#f1f3f5',
      color: v === 'secondary' ? '#495057' : '#fff',
    }),
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🗂️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Importar Anamnese Histórica</div>
              <div style={{ fontSize: 13, color: '#888' }}>Foto de ficha em papel → extração por IA → salva no sistema</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999' }}>×</button>
        </div>

        {/* Body */}
        <div style={s.body}>

          {/* STEP: capture */}
          {step === 'capture' && (
            <div>
              <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
                Tire uma foto da ficha de anamnese em papel ou selecione uma imagem existente.
                A IA vai extrair automaticamente as perguntas e respostas preenchidas.
              </p>
              <div
                style={{ border: '2px dashed #34d399', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: 'rgba(52,211,153,0.04)' }}
                onClick={() => fileRef.current.click()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                onDragOver={e => e.preventDefault()}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Clique para selecionar imagem ou arraste aqui</div>
                <div style={{ fontSize: 12, color: '#999' }}>JPG, PNG, WEBP, HEIC — máx. 10 MB</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              {error && <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#856404' }}>⚠️ {error}</div>}
              <div style={{ textAlign: 'center', margin: '14px 0', color: '#aaa', fontSize: 13 }}>ou</div>
              <button style={{ ...s.btn('secondary'), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 18px' }}
                onClick={() => cameraRef.current.click()}>
                📱 Tirar foto com a câmera
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div>
              <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
                Verifique se a imagem está nítida e legível antes de enviar para a IA:
              </p>
              <img src={imageUrl} alt="Ficha" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 10, border: '1px solid #eee' }} />
              {error && <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#856404' }}>⚠️ {error}</div>}
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14 }}>
                  <strong>{rows.filter(r => r.question.trim()).length}</strong> itens extraídos.
                  <span style={{ color: '#888', marginLeft: 8, fontSize: 13 }}>Revise e edite antes de salvar.</span>
                </div>
                <button onClick={addRow}
                  style={{ padding: '5px 12px', border: '1px solid #34d399', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  + Adicionar linha
                </button>
              </div>

              {error && <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#856404' }}>⚠️ {error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>PERGUNTA</div>
                      <input
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff' }}
                        value={row.question}
                        onChange={e => updateRow(i, 'question', e.target.value)}
                        placeholder="Pergunta da ficha..."
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>RESPOSTA</div>
                      <input
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff' }}
                        value={row.answer}
                        onChange={e => updateRow(i, 'answer', e.target.value)}
                        placeholder="Resposta registrada..."
                      />
                    </div>
                    <button onClick={() => removeRow(i)}
                      style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 16 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
                Linhas com pergunta em branco serão ignoradas na hora de salvar.
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🤖</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>A IA está lendo a ficha...</div>
              <div style={{ color: '#888', fontSize: 13 }}>Extraindo perguntas e respostas. Aguarde.</div>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Anamnese importada!</div>
              <p style={{ color: '#666', fontSize: 14 }}>
                A ficha histórica foi salva como anamnese preenchida no prontuário do paciente.
              </p>
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
                <button style={s.btn('secondary')} onClick={() => { setStep('capture'); setFile(null); setImageUrl(null); setError(null); }}>
                  Trocar imagem
                </button>
                <button style={s.btn('blue')} onClick={handleExtract}>
                  🤖 Extrair com IA
                </button>
              </>
            )}

            {step === 'review' && (
              <>
                <button style={s.btn('secondary')} onClick={() => { setStep('preview'); setError(null); }}>Voltar</button>
                <button
                  style={{ ...s.btn('primary'), opacity: saving ? 0.7 : 1 }}
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? 'Salvando...' : `💾 Salvar anamnese (${rows.filter(r => r.question.trim()).length} itens)`}
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
