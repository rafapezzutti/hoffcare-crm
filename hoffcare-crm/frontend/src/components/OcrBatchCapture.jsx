import { useState, useRef } from 'react';
import api from '../services/api';

/**
 * OcrBatchCapture — captura em lote de pacientes via IA
 * Aceita imagens (foto/scan) e documentos (xlsx, csv, docx, txt, pdf).
 * Extrai múltiplos pacientes, exibe tabela para revisão e salva em lote.
 *
 * Props:
 *   onClose     — callback para fechar o modal
 *   onComplete  — callback({ saved, skipped, errors }) chamado ao finalizar
 */

const IMAGE_TYPES = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'];
const DOC_EXTS    = ['.xlsx','.xls','.csv','.docx','.doc','.txt','.pdf'];
const DOC_LABELS  = { '.xlsx':'Excel', '.xls':'Excel', '.csv':'CSV', '.docx':'Word', '.doc':'Word', '.txt':'TXT', '.pdf':'PDF' };

const isImage = (file) => IMAGE_TYPES.includes(file.type);
const isDoc   = (file) => DOC_EXTS.some(ext => file.name.toLowerCase().endsWith(ext));
const fileIcon = (file) => {
  if (isImage(file)) return '🖼️';
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) return '📊';
  if (file.name.endsWith('.csv')) return '📋';
  if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) return '📝';
  if (file.name.endsWith('.pdf')) return '📄';
  return '📁';
};

const REQUIRED_FIELDS = ['name', 'cpf'];

const FIELD_LABELS = {
  name:      'Nome',
  cpf:       'CPF',
  birthdate: 'Nascimento',
  phone:     'Telefone',
  email:     'E-mail',
  gender:    'Gênero',
  notes:     'Obs.',
};

const TABLE_FIELDS = ['name', 'cpf', 'birthdate', 'phone', 'email'];

const validateRow = (row) => {
  if (!row.name?.trim()) return 'Nome obrigatório';
  const cpf = (row.cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) return 'CPF inválido (11 dígitos)';
  // birthdate é opcional na importação em lote
  return null;
};

export default function OcrBatchCapture({ onClose, onComplete }) {
  const [step, setStep]           = useState('capture');
  const [file, setFile]           = useState(null);    // arquivo selecionado (imagem ou doc)
  const [imageUrl, setImageUrl]   = useState(null);    // preview (só para imagens)
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [rows, setRows]           = useState([]);
  const [selected, setSelected]   = useState([]);
  const [progress, setProgress]   = useState([]);
  const [summary, setSummary]     = useState(null);
  const fileRef   = useRef();
  const cameraRef = useRef();

  // ── Seleção de arquivo ─────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (!isImage(f) && !isDoc(f)) {
      setError('Formato não suportado. Use: imagem, Excel, CSV, Word, TXT ou PDF.');
      return;
    }
    setFile(f);
    setImageUrl(isImage(f) ? URL.createObjectURL(f) : null);
    setError(null);
    setStep('preview');
  };

  // ── Extração ───────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      let extracted;
      const form = new FormData();

      if (isImage(file)) {
        // Rota de imagem (OCR visual)
        form.append('image', file);
        form.append('type', 'patient_batch');
        const res = await api.post('/ocr/extract', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        extracted = Array.isArray(res.data.data) ? res.data.data : [res.data.data];
      } else {
        // Rota de documento (extração de texto)
        form.append('file', file);
        const res = await api.post('/ocr/extract-document', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        extracted = Array.isArray(res.data.data) ? res.data.data : [res.data.data];
      }

      const normalized = extracted.map((p, i) => ({
        ...p,
        _id: i,
        cpf: p.cpf ? p.cpf.replace(/\D/g, '') : '',
      }));
      setRows(normalized);
      setSelected(normalized.map((_, i) => i));
      setStep('review');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar arquivo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Edição inline ──────────────────────────────────────────────────────────
  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const toggleRow = (idx) => {
    setSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const toggleAll = () => {
    setSelected(prev => prev.length === rows.length ? [] : rows.map((_, i) => i));
  };

  // ── Salvamento em lote ─────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    const toSave = rows.filter((_, i) => selected.includes(i));

    // Valida todos antes de começar
    const validationErrors = toSave.map((r, i) => ({ idx: i, error: validateRow(r) })).filter(e => e.error);
    if (validationErrors.length > 0) {
      const names = validationErrors.map(e => `Linha ${selected[e.idx] + 1}: ${e.error}`).join('\n');
      setError(`Corrija os erros antes de salvar:\n${names}`);
      return;
    }

    setStep('saving');
    const prog = toSave.map(() => ({ status: 'pending', msg: '' }));
    setProgress([...prog]);

    let saved = 0, skipped = 0, errors = 0;

    for (let i = 0; i < toSave.length; i++) {
      const patient = toSave[i];
      prog[i] = { status: 'saving', msg: 'Salvando...' };
      setProgress([...prog]);

      try {
        await api.post('/patients', {
          name:         patient.name?.trim(),
          cpf:          patient.cpf.replace(/\D/g, ''),
          birthdate:    patient.birthdate || null,
          phone:        patient.phone ? patient.phone.replace(/\D/g, '') : null,
          email:        patient.email || null,
          batch_import: true, // permite salvar sem data de nascimento
        });
        prog[i] = { status: 'success', msg: 'Salvo ✅' };
        saved++;
      } catch (err) {
        const msg = err.response?.data?.error || 'Erro';
        const isDuplicate = msg.toLowerCase().includes('já cadastrado') || msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicat') || err.response?.status === 409;
        if (isDuplicate) {
          prog[i] = { status: 'skipped', msg: 'Já cadastrado ⚠️' };
          skipped++;
        } else {
          prog[i] = { status: 'error', msg };
          errors++;
        }
      }
      setProgress([...prog]);
    }

    skipped += rows.length - toSave.length; // adiciona os desmarcados
    setSummary({ saved, skipped, errors });
    setStep('done');
    onComplete?.({ saved, skipped, errors });
  };

  // ── Estilos ────────────────────────────────────────────────────────────────
  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 },
    modal:   { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
    header:  { padding: '16px 24px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body:    { padding: '16px 24px', overflowY: 'auto', flex: 1 },
    footer:  { padding: '12px 24px', borderTop: '1px solid #eee', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' },
    btn: (v) => ({
      padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
      background: v === 'primary' ? '#E8841A' : v === 'blue' ? '#4DB8E8' : '#f1f3f5',
      color: v === 'secondary' ? '#495057' : '#fff',
    }),
    th: { padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#666', borderBottom: '1px solid #eee', textAlign: 'left', whiteSpace: 'nowrap' },
    td: { padding: '6px 6px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' },
    input: { width: '100%', padding: '5px 7px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
    badge: (s) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: s === 'success' ? '#e8f5e9' : s === 'error' ? '#ffebee' : s === 'saving' ? '#e3f2fd' : s === 'skipped' ? '#fff8e1' : '#f5f5f5',
      color: s === 'success' ? '#2e7d32' : s === 'error' ? '#c62828' : s === 'saving' ? '#1565c0' : s === 'skipped' ? '#f57f17' : '#999',
    }),
  };

  const validCount = rows.filter((r, i) => selected.includes(i) && !validateRow(r)).length;
  const invalidCount = rows.filter((r, i) => selected.includes(i) && validateRow(r)).length;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Captura em Lote — Pacientes</div>
              <div style={{ fontSize: 13, color: '#888' }}>Extrai múltiplos pacientes de uma única imagem</div>
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
                Selecione um arquivo com <strong>um ou mais pacientes</strong>. Aceita imagens, planilhas Excel, CSV, Word, TXT e PDF.
              </p>
              <div style={{ border: '2px dashed #4DB8E8', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: 'rgba(77,184,232,0.04)' }}
                onClick={() => fileRef.current.click()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                onDragOver={e => e.preventDefault()}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Clique para selecionar ou arraste o arquivo</div>
                <div style={{ fontSize: 12, color: '#999' }}>Imagens (JPG/PNG) • Excel (.xlsx/.csv) • Word (.docx) • PDF • TXT • máx. 20 MB</div>
              </div>
              <input ref={fileRef} type="file"
                accept="image/*,.xlsx,.xls,.csv,.docx,.doc,.txt,.pdf"
                style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              {error && <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#856404' }}>⚠️ {error}</div>}
              <div style={{ textAlign: 'center', margin: '14px 0', color: '#aaa', fontSize: 13 }}>ou</div>
              <button style={{ ...s.btn('secondary'), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => cameraRef.current.click()}>
                📷 Tirar foto com a câmera
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && file && (
            <div>
              {isImage(file) ? (
                <>
                  <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>Verifique se a imagem está nítida e legível:</p>
                  <img src={imageUrl} alt="Preview" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 10, border: '1px solid #eee' }} />
                </>
              ) : (
                <div style={{ background: '#f8f9fa', borderRadius: 12, padding: '32px 24px', textAlign: 'center', border: '1px solid #eee' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{fileIcon(file)}</div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{file.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
                    {DOC_LABELS[DOC_EXTS.find(e => file.name.toLowerCase().endsWith(e))] || 'Documento'} • {(file.size / 1024).toFixed(0)} KB
                  </div>
                  <div style={{ fontSize: 13, color: '#4DB8E8', marginTop: 8 }}>
                    ✅ Arquivo pronto para extração
                  </div>
                </div>
              )}
              {error && <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 14, color: '#856404' }}>⚠️ {error}</div>}
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14 }}>
                  <strong>{rows.length}</strong> paciente{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}.
                  {invalidCount > 0 && <span style={{ color: '#c62828', marginLeft: 8 }}>⚠️ {invalidCount} com dados incompletos</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{selected.length} selecionado{selected.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {error && <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#856404', whiteSpace: 'pre-line' }}>⚠️ {error}</div>}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={s.th}>
                        <input type="checkbox" checked={selected.length === rows.length} onChange={toggleAll} />
                      </th>
                      <th style={s.th}>#</th>
                      <th style={{ ...s.th, minWidth: 160 }}>Nome *</th>
                      <th style={{ ...s.th, minWidth: 120 }}>CPF *</th>
                      <th style={{ ...s.th, minWidth: 120 }}>Nascimento</th>
                      <th style={{ ...s.th, minWidth: 120 }}>Telefone</th>
                      <th style={{ ...s.th, minWidth: 160 }}>E-mail</th>
                      <th style={s.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const err = validateRow(row);
                      const isSel = selected.includes(idx);
                      return (
                        <tr key={idx} style={{ background: isSel ? '#fff' : '#fafafa', opacity: isSel ? 1 : 0.5 }}>
                          <td style={s.td}>
                            <input type="checkbox" checked={isSel} onChange={() => toggleRow(idx)} />
                          </td>
                          <td style={{ ...s.td, color: '#999', fontSize: 11 }}>{idx + 1}</td>
                          <td style={s.td}>
                            <input style={{ ...s.input, borderColor: isSel && !row.name ? '#e53935' : '#ddd' }}
                              value={row.name || ''} onChange={e => updateRow(idx, 'name', e.target.value)} placeholder="Nome completo" />
                          </td>
                          <td style={s.td}>
                            <input style={{ ...s.input, borderColor: isSel && (row.cpf || '').replace(/\D/g,'').length !== 11 ? '#e53935' : '#ddd' }}
                              value={row.cpf || ''} onChange={e => updateRow(idx, 'cpf', e.target.value.replace(/\D/g,''))} placeholder="00000000000" maxLength={11} />
                          </td>
                          <td style={s.td}>
                            <input style={s.input} type="date" value={row.birthdate || ''} onChange={e => updateRow(idx, 'birthdate', e.target.value)} />
                          </td>
                          <td style={s.td}>
                            <input style={s.input} value={row.phone || ''} onChange={e => updateRow(idx, 'phone', e.target.value.replace(/\D/g,''))} placeholder="00000000000" />
                          </td>
                          <td style={s.td}>
                            <input style={s.input} type="email" value={row.email || ''} onChange={e => updateRow(idx, 'email', e.target.value)} placeholder="email@..." />
                          </td>
                          <td style={s.td}>
                            {err
                              ? <span style={s.badge('error')} title={err}>⚠️ {err}</span>
                              : <span style={s.badge('success')}>✓ OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>* Campos obrigatórios. Desmarque linhas que não deseja salvar.</p>
            </div>
          )}

          {/* STEP: saving */}
          {step === 'saving' && (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 14 }}>Salvando pacientes...</p>
              {progress.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                  <span style={{ minWidth: 24, color: '#aaa' }}>{i + 1}.</span>
                  <span style={{ flex: 1 }}>{rows.filter((_, ri) => selected.includes(ri))[i]?.name || '—'}</span>
                  <span style={s.badge(p.status)}>{p.msg || 'Aguardando...'}</span>
                </div>
              ))}
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && summary && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {summary.errors === 0 ? '✅' : '⚠️'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Lote processado!</div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '12px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#2e7d32' }}>{summary.saved}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Salvos</div>
                </div>
                {summary.skipped > 0 && (
                  <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '12px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#999' }}>{summary.skipped}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Ignorados</div>
                  </div>
                )}
                {summary.errors > 0 && (
                  <div style={{ background: '#ffebee', borderRadius: 10, padding: '12px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#c62828' }}>{summary.errors}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Erros</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {file && isImage(file) ? 'A IA está lendo a imagem...' : 'Extraindo dados do arquivo...'}
              </div>
              <div style={{ color: '#888', fontSize: 13 }}>Aguarde alguns segundos.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={s.footer}>
            {step === 'capture' && <button style={s.btn('secondary')} onClick={onClose}>Cancelar</button>}

            {step === 'preview' && (
              <>
                <button style={s.btn('secondary')} onClick={() => { setStep('capture'); setFile(null); setImageUrl(null); setError(null); }}>Trocar arquivo</button>
                <button style={s.btn('blue')} onClick={handleExtract}>
                  🤖 Extrair pacientes com IA
                </button>
              </>
            )}

            {step === 'review' && (
              <>
                <span style={{ fontSize: 13, color: '#888', marginRight: 'auto' }}>
                  {validCount} pronto{validCount !== 1 ? 's' : ''} para salvar
                  {invalidCount > 0 ? `, ${invalidCount} com erro` : ''}
                </span>
                <button style={s.btn('secondary')} onClick={() => setStep('preview')}>Voltar</button>
                <button style={{ ...s.btn('primary'), opacity: validCount === 0 ? 0.5 : 1 }}
                  disabled={validCount === 0} onClick={handleSaveAll}>
                  💾 Salvar {validCount} paciente{validCount !== 1 ? 's' : ''}
                </button>
              </>
            )}

            {step === 'done' && <button style={s.btn('primary')} onClick={onClose}>Fechar</button>}
          </div>
        )}
      </div>
    </div>
  );
}
