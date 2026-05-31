import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';

const CATEGORY_KEYS = {
  geral:         { tKey: 'anamnesis.catGeral',         color: '#4DB8E8' },
  estetica:      { tKey: 'anamnesis.catEstetica',      color: '#a78bfa' },
  odontologica:  { tKey: 'anamnesis.catOdontologica',  color: '#34d399' },
  personalizada: { tKey: 'anamnesis.catPersonalizada', color: '#f59e0b' },
};

const STATUS_BADGE = {
  pending:   'badge-orange',
  sent:      'badge-blue',
  completed: 'badge-green',
};

function printAnamnesis(patientName, questions, t) {
  const answerSpace = t ? t('anamnesis.printAnswerSpace') : '(espaço para resposta)';
  const patientSig = t ? t('anamnesis.printPatientSignature') : 'Assinatura do paciente';
  const profSig = t ? t('anamnesis.printProfSignature') : 'Assinatura do profissional';
  const title = t ? t('anamnesis.printTitle') : 'Anamnese Digital';
  const patientLabel = t ? t('anamnesis.printPatient') : 'Paciente';
  const dateLabel = t ? t('anamnesis.printDate') : 'Data';

  const rows = questions.map((q, i) => `
    <div style="margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:16px">
      <p style="margin:0 0 6px;font-weight:600;color:#1a2535">${i + 1}. ${q}</p>
      <div style="border:1px solid #ccc;border-radius:4px;min-height:52px;margin-top:6px;padding:8px 10px;color:#999;font-size:12px">
        ${answerSpace}
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title} — ${patientName}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; color: #333; }
  h1 { font-size: 22px; color: #1a2535; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 30px; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <h1>${title}</h1>
  <p class="sub">${patientLabel}: <strong>${patientName}</strong> &nbsp;|&nbsp; ${dateLabel}: ${dayjs().format('DD/MM/YYYY')}</p>
  ${rows}
  <div style="margin-top:40px;border-top:2px solid #333;padding-top:12px;display:flex;justify-content:space-between">
    <div><p style="font-size:12px;color:#666">${patientSig}</p></div>
    <div><p style="font-size:12px;color:#666">${profSig}</p></div>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

export default function Anamnesis() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [patient, setPatient] = useState(null);
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [selected, setSelected] = useState([]);       // ids selecionados
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('todas');
  const [newQ, setNewQ] = useState('');
  const [saveToBank, setSaveToBank] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [p, a, q] = await Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/anamnesis?patient_id=${patientId}`),
      api.get('/anamnesis/questions'),
    ]);
    setPatient(p.data);
    setList(a.data);
    setAllQuestions(q.data);
  };

  useEffect(() => { load(); }, [patientId]);

  // Abre modal limpando seleção
  const openModal = () => {
    setSelected([]);
    setSearch('');
    setFilterCat('todas');
    setNewQ('');
    setOpen(true);
  };

  // Perguntas visíveis (filtro)
  const visible = useMemo(() => {
    let q = allQuestions;
    if (filterCat !== 'todas') q = q.filter(x => x.category === filterCat);
    if (search.trim()) q = q.filter(x => x.question.toLowerCase().includes(search.toLowerCase()));
    return q;
  }, [allQuestions, filterCat, search]);

  // Agrupar por categoria
  const grouped = useMemo(() => {
    const g = {};
    visible.forEach(q => {
      if (!g[q.category]) g[q.category] = [];
      g[q.category].push(q);
    });
    return g;
  }, [visible]);

  const toggle = (id) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const selectedQuestions = allQuestions.filter(q => selected.includes(q.id));

  const addCustomQ = async () => {
    if (!newQ.trim()) return;
    if (saveToBank) {
      try {
        const res = await api.post('/anamnesis/questions', { question: newQ.trim(), category: 'personalizada' });
        setAllQuestions(p => [...p, res.data]);
        setSelected(p => [...p, res.data.id]);
      } catch { alert(t('anamnesis.errorSaveQuestion')); }
    } else {
      // Adiciona só localmente como objeto temporário
      const tmp = { id: `tmp_${Date.now()}`, question: newQ.trim(), category: 'personalizada', is_default: false };
      setAllQuestions(p => [...p, tmp]);
      setSelected(p => [...p, tmp.id]);
    }
    setNewQ('');
  };

  const deleteQuestion = async (q) => {
    if (q.is_default) return;
    if (!confirm(t('anamnesis.confirmDeleteQuestion'))) return;
    if (String(q.id).startsWith('tmp_')) {
      setAllQuestions(p => p.filter(x => x.id !== q.id));
      setSelected(p => p.filter(x => x !== q.id));
      return;
    }
    await api.delete(`/anamnesis/questions/${q.id}`);
    setAllQuestions(p => p.filter(x => x.id !== q.id));
    setSelected(p => p.filter(x => x !== q.id));
  };

  const handleCreate = async (withEmail) => {
    if (!selected.length) { alert(t('anamnesis.selectAtLeastOne')); return; }
    setLoading(true);
    try {
      await api.post('/anamnesis', {
        patient_id: patientId,
        selected_questions: selectedQuestions.map(q => q.question),
        send_email: withEmail,
      });
      setOpen(false);
      load();
    } catch (err) { alert(err.response?.data?.error || t('anamnesis.errorCreate')); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('anamnesis.delete'))) return;
    await api.delete(`/anamnesis/${id}`);
    load();
  };

  const categories = [...new Set(allQuestions.map(q => q.category))];

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${patientId}`)}>
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title"><i className="fas fa-clipboard-list" style={{ marginRight: 8, color: 'var(--blue)' }} />{t('anamnesis.title')}</h1>
            {patient && <p className="page-subtitle">{patient.name}</p>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <i className="fas fa-paper-plane" /> {t('anamnesis.new')}
        </button>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty-state"><i className="fas fa-clipboard-list" /><p>{t('anamnesis.noRecords')}</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>{t('anamnesis.date')}</th><th>{t('anamnesis.questions')}</th><th>{t('anamnesis.status')}</th><th>{t('anamnesis.sent')}</th><th>{t('anamnesis.answered')}</th><th>{t('common.actions')}</th></tr>
              </thead>
              <tbody>
                {list.map(a => {
                  const qs = Array.isArray(a.custom_questions) ? a.custom_questions : (() => { try { return JSON.parse(a.custom_questions); } catch { return []; } })();
                  return (
                    <tr key={a.id}>
                      <td>{dayjs(a.created_at).format('DD/MM/YYYY')}</td>
                      <td>{qs.length} {t('anamnesis.questions')}</td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-blue'}`}>{a.status === 'pending' ? t('anamnesis.statusPending') : a.status === 'sent' ? t('anamnesis.statusSent') : a.status === 'completed' ? t('anamnesis.statusCompleted') : a.status}</span></td>
                      <td>{a.sent_at ? dayjs(a.sent_at).format('DD/MM/YYYY HH:mm') : '—'}</td>
                      <td>{a.completed_at ? dayjs(a.completed_at).format('DD/MM/YYYY HH:mm') : '—'}</td>
                      <td>
                        <div className="table-actions">
                          {a.status === 'completed' && (
                            <button className="btn btn-outline btn-sm" onClick={() => { setViewing(a); setViewOpen(true); }}>
                              <i className="fas fa-eye" /> {t('anamnesis.view')}
                            </button>
                          )}
                          <button className="btn btn-outline btn-sm" title={t('anamnesis.print')}
                            onClick={() => printAnamnesis(patient?.name || '', qs, t)}>
                            <i className="fas fa-print" />
                          </button>
                          <a href={`${window.location.origin}/anamnesis/form/${a.token}`} target="_blank" rel="noreferrer"
                            className="btn btn-outline btn-sm"><i className="fas fa-link" /></a>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}><i className="fas fa-trash" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal criar ── */}
      <Modal open={open} onClose={() => setOpen(false)} title={t('anamnesis.new')} size="modal-xl"
        footer={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-outline" disabled={!selected.length || loading}
              onClick={() => { printAnamnesis(patient?.name || '', selectedQuestions.map(q => q.question), t); }}>
              <i className="fas fa-print" style={{ marginRight: 6 }} />{t('anamnesis.print')}
            </button>
            <button className="btn btn-outline" disabled={!selected.length || loading || !patient?.email}
              onClick={() => handleCreate(true)} title={!patient?.email ? t('anamnesis.noEmail') : ''}>
              <i className="fas fa-envelope" style={{ marginRight: 6 }} />
              {loading ? t('anamnesis.sending') : t('anamnesis.send')}
            </button>
            <button className="btn btn-primary" disabled={!selected.length || loading}
              onClick={() => handleCreate(false)}>
              <i className="fas fa-save" style={{ marginRight: 6 }} />
              {loading ? t('anamnesis.creating') : t('anamnesis.createWithoutSending')}
            </button>
          </div>
        }>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 480 }}>

          {/* ── Esquerda: banco de perguntas ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-700)', marginBottom: 2 }}>
              <i className="fas fa-database" style={{ marginRight: 6, color: '#4DB8E8' }} />
              {t('anamnesis.questionBank')}
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-control" style={{ fontSize: 12, flex: 1 }}
                placeholder={t('anamnesis.searchQuestion')} value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-control" style={{ fontSize: 12, width: 140 }}
                value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="todas">{t('anamnesis.allCategories')}</option>
                {categories.map(c => (
                  <option key={c} value={c}>{CATEGORY_KEYS[c]?.tKey ? t(CATEGORY_KEYS[c].tKey) : c}</option>
                ))}
              </select>
            </div>

            {/* Lista por grupo */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, border: '1px solid var(--gray-200)', borderRadius: 8 }}>
              {Object.keys(grouped).length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>{t('anamnesis.noQuestionsFound')}</div>
              )}
              {Object.entries(grouped).map(([cat, qs]) => (
                <div key={cat}>
                  <div style={{
                    padding: '6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 0.5, color: CATEGORY_KEYS[cat]?.color || '#666',
                    background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)',
                    position: 'sticky', top: 0,
                  }}>
                    {CATEGORY_KEYS[cat]?.tKey ? t(CATEGORY_KEYS[cat].tKey) : cat}
                  </div>
                  {qs.map(q => (
                    <div key={q.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 12px', borderBottom: '1px solid var(--gray-100)',
                      background: selected.includes(q.id) ? '#eff9ff' : 'white',
                      cursor: 'pointer',
                    }} onClick={() => toggle(q.id)}>
                      <input type="checkbox" readOnly checked={selected.includes(q.id)}
                        style={{ cursor: 'pointer', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1, lineHeight: 1.4 }}>{q.question}</span>
                      {!q.is_default && (
                        <button type="button" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                          onClick={e => { e.stopPropagation(); deleteQuestion(q); }} title="Remover do banco">
                          <i className="fas fa-times" style={{ fontSize: 11 }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Adicionar pergunta */}
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>
                <i className="fas fa-plus-circle" style={{ marginRight: 6, color: '#f59e0b' }} />
                {t('anamnesis.addQuestion')}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input className="form-control" style={{ fontSize: 12, flex: 1 }}
                  placeholder={t('anamnesis.questionPlaceholder')}
                  value={newQ} onChange={e => setNewQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomQ(); } }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={addCustomQ}>
                  <i className="fas fa-plus" />
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={saveToBank} onChange={e => setSaveToBank(e.target.checked)} />
                {t('anamnesis.saveToBank')}
              </label>
            </div>
          </div>

          {/* ── Direita: selecionadas ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-700)', marginBottom: 2 }}>
              <i className="fas fa-check-circle" style={{ marginRight: 6, color: '#22c55e' }} />
              {t('anamnesis.selectedQuestions')} ({selected.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400, border: '1px solid var(--gray-200)', borderRadius: 8 }}>
              {selectedQuestions.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                  <i className="fas fa-mouse-pointer" style={{ display: 'block', fontSize: 24, marginBottom: 8 }} />
                  {t('anamnesis.checkQuestions')}
                </div>
              ) : (
                selectedQuestions.map((q, i) => (
                  <div key={q.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '8px 12px', borderBottom: '1px solid var(--gray-100)',
                  }}>
                    <span style={{ color: 'var(--gray-400)', fontSize: 11, marginTop: 2, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: 12, flex: 1, lineHeight: 1.4 }}>{q.question}</span>
                    <button type="button" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                      onClick={() => toggle(q.id)}>
                      <i className="fas fa-times" style={{ fontSize: 11 }} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {!patient?.email && sendEmail && (
              <div className="alert alert-error" style={{ fontSize: 12, padding: '8px 12px' }}>
                {t('anamnesis.noEmailWarning')}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Modal ver respostas ── */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={t('anamnesis.answersTitle')} size="modal-xl"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => {
              const qs = Array.isArray(viewing?.custom_questions) ? viewing.custom_questions
                : (() => { try { return JSON.parse(viewing?.custom_questions); } catch { return []; } })();
              printAnamnesis(patient?.name || '', qs, t);
            }}><i className="fas fa-print" style={{ marginRight: 6 }} />{t('anamnesis.print')}</button>
            <button className="btn btn-primary" onClick={() => setViewOpen(false)}>{t('anamnesis.close')}</button>
          </div>
        }>
        {viewing && (() => {
          const qs = Array.isArray(viewing.custom_questions) ? viewing.custom_questions
            : (() => { try { return JSON.parse(viewing.custom_questions); } catch { return []; } })();
          const resp = viewing.responses || {};
          return (
            <div>
              <p style={{ marginBottom: 16, color: 'var(--gray-500)', fontSize: 13 }}>
                {t('anamnesis.answeredAt')} {dayjs(viewing.completed_at).format('DD/MM/YYYY HH:mm')}
              </p>
              {qs.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>
                  <i className="fas fa-clipboard" />
                  <p>{t('anamnesis.noQuestionsFound')}</p>
                </div>
              )}
              {qs.map((q, i) => {
                const answer = resp[i] ?? resp[String(i)] ?? resp[q];
                const detail = resp[`${i}_detail`] ?? resp[`${String(i)}_detail`];
                return (
                  <div key={i} style={{ marginBottom: 12, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-100)' }}>
                    <p style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: 'var(--gray-700)' }}>{i + 1}. {q}</p>
                    <p style={{ fontSize: 14, color: answer ? 'var(--gray-900)' : 'var(--gray-400)', fontStyle: answer ? 'normal' : 'italic' }}>
                      {answer || t('anamnesis.noAnswer')}
                    </p>
                    {detail && (
                      <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4, paddingLeft: 8, borderLeft: '2px solid #4DB8E8' }}>
                        {detail}
                      </p>
                    )}
                  </div>
                );
              })}
              {resp['observacoes'] && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <p style={{ fontWeight: 600, fontSize: 12, color: '#92400e', marginBottom: 6 }}>
                    <i className="fas fa-comment" style={{ marginRight: 6 }} />{t('anamnesis.patientNotes')}
                  </p>
                  <p style={{ fontSize: 14, color: '#78350f' }}>{resp['observacoes']}</p>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
