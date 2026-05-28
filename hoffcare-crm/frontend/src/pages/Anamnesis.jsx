import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';

const CATEGORY_LABELS = {
  geral:         { label: 'Geral / Clínico',         color: '#4DB8E8' },
  estetica:      { label: 'Estética / Dermatologia',  color: '#a78bfa' },
  odontologica:  { label: 'Odontológica',             color: '#34d399' },
  personalizada: { label: 'Personalizada',            color: '#f59e0b' },
};

const STATUS_MAP = {
  pending:   { label: 'Pendente',   badge: 'badge-orange' },
  sent:      { label: 'Enviada',    badge: 'badge-blue' },
  completed: { label: 'Respondida', badge: 'badge-green' },
};

function printAnamnesis(patientName, questions) {
  const rows = questions.map((q, i) => `
    <div style="margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:16px">
      <p style="margin:0 0 6px;font-weight:600;color:#1a2535">${i + 1}. ${q}</p>
      <div style="border:1px solid #ccc;border-radius:4px;min-height:52px;margin-top:6px;padding:8px 10px;color:#999;font-size:12px">
        (espaço para resposta)
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Anamnese — ${patientName}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; color: #333; }
  h1 { font-size: 22px; color: #1a2535; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 30px; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <h1>Anamnese Digital</h1>
  <p class="sub">Paciente: <strong>${patientName}</strong> &nbsp;|&nbsp; Data: ${dayjs().format('DD/MM/YYYY')}</p>
  ${rows}
  <div style="margin-top:40px;border-top:2px solid #333;padding-top:12px;display:flex;justify-content:space-between">
    <div><p style="font-size:12px;color:#666">Assinatura do paciente</p></div>
    <div><p style="font-size:12px;color:#666">Assinatura do profissional</p></div>
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
      } catch { alert('Erro ao salvar pergunta'); }
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
    if (!confirm('Remover esta pergunta do banco?')) return;
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
    if (!selected.length) { alert('Selecione ao menos uma pergunta.'); return; }
    setLoading(true);
    try {
      await api.post('/anamnesis', {
        patient_id: patientId,
        selected_questions: selectedQuestions.map(q => q.question),
        send_email: withEmail,
      });
      setOpen(false);
      load();
    } catch (err) { alert(err.response?.data?.error || 'Erro ao criar anamnese'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta anamnese?')) return;
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
            <h1 className="page-title"><i className="fas fa-clipboard-list" style={{ marginRight: 8, color: 'var(--blue)' }} />Anamnese Digital</h1>
            {patient && <p className="page-subtitle">{patient.name}</p>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <i className="fas fa-paper-plane" /> Nova Anamnese
        </button>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty-state"><i className="fas fa-clipboard-list" /><p>Nenhuma anamnese registrada</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Data</th><th>Perguntas</th><th>Status</th><th>Enviada</th><th>Respondida</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {list.map(a => {
                  const qs = Array.isArray(a.custom_questions) ? a.custom_questions : (() => { try { return JSON.parse(a.custom_questions); } catch { return []; } })();
                  return (
                    <tr key={a.id}>
                      <td>{dayjs(a.created_at).format('DD/MM/YYYY')}</td>
                      <td>{qs.length} perguntas</td>
                      <td><span className={`badge ${STATUS_MAP[a.status]?.badge || 'badge-blue'}`}>{STATUS_MAP[a.status]?.label || a.status}</span></td>
                      <td>{a.sent_at ? dayjs(a.sent_at).format('DD/MM/YYYY HH:mm') : '—'}</td>
                      <td>{a.completed_at ? dayjs(a.completed_at).format('DD/MM/YYYY HH:mm') : '—'}</td>
                      <td>
                        <div className="table-actions">
                          {a.status === 'completed' && (
                            <button className="btn btn-outline btn-sm" onClick={() => { setViewing(a); setViewOpen(true); }}>
                              <i className="fas fa-eye" /> Ver
                            </button>
                          )}
                          <button className="btn btn-outline btn-sm" title="Imprimir formulário"
                            onClick={() => printAnamnesis(patient?.name || '', qs)}>
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
      <Modal open={open} onClose={() => setOpen(false)} title="Nova Anamnese Digital" size="modal-xl"
        footer={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-outline" disabled={!selected.length || loading}
              onClick={() => { printAnamnesis(patient?.name || '', selectedQuestions.map(q => q.question)); }}>
              <i className="fas fa-print" style={{ marginRight: 6 }} />Imprimir
            </button>
            <button className="btn btn-outline" disabled={!selected.length || loading || !patient?.email}
              onClick={() => handleCreate(true)} title={!patient?.email ? 'Paciente sem e-mail' : ''}>
              <i className="fas fa-envelope" style={{ marginRight: 6 }} />
              {loading ? 'Enviando...' : 'Enviar por E-mail'}
            </button>
            <button className="btn btn-primary" disabled={!selected.length || loading}
              onClick={() => handleCreate(false)}>
              <i className="fas fa-save" style={{ marginRight: 6 }} />
              {loading ? 'Criando...' : 'Criar sem enviar'}
            </button>
          </div>
        }>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 480 }}>

          {/* ── Esquerda: banco de perguntas ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-700)', marginBottom: 2 }}>
              <i className="fas fa-database" style={{ marginRight: 6, color: '#4DB8E8' }} />
              Banco de Perguntas
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-control" style={{ fontSize: 12, flex: 1 }}
                placeholder="Buscar pergunta..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-control" style={{ fontSize: 12, width: 140 }}
                value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="todas">Todas</option>
                {categories.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]?.label || c}</option>
                ))}
              </select>
            </div>

            {/* Lista por grupo */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, border: '1px solid var(--gray-200)', borderRadius: 8 }}>
              {Object.keys(grouped).length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma pergunta encontrada</div>
              )}
              {Object.entries(grouped).map(([cat, qs]) => (
                <div key={cat}>
                  <div style={{
                    padding: '6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 0.5, color: CATEGORY_LABELS[cat]?.color || '#666',
                    background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)',
                    position: 'sticky', top: 0,
                  }}>
                    {CATEGORY_LABELS[cat]?.label || cat}
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
                Adicionar pergunta
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input className="form-control" style={{ fontSize: 12, flex: 1 }}
                  placeholder="Digite a pergunta..."
                  value={newQ} onChange={e => setNewQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomQ(); } }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={addCustomQ}>
                  <i className="fas fa-plus" />
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={saveToBank} onChange={e => setSaveToBank(e.target.checked)} />
                Salvar no banco para usar no futuro
              </label>
            </div>
          </div>

          {/* ── Direita: selecionadas ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-700)', marginBottom: 2 }}>
              <i className="fas fa-check-circle" style={{ marginRight: 6, color: '#22c55e' }} />
              Perguntas selecionadas ({selected.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400, border: '1px solid var(--gray-200)', borderRadius: 8 }}>
              {selectedQuestions.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                  <i className="fas fa-mouse-pointer" style={{ display: 'block', fontSize: 24, marginBottom: 8 }} />
                  Marque as perguntas ao lado
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
                Paciente sem e-mail. Somente impressão disponível.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Modal ver respostas ── */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Respostas da Anamnese" size="modal-xl"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => {
              const qs = Array.isArray(viewing?.custom_questions) ? viewing.custom_questions
                : (() => { try { return JSON.parse(viewing?.custom_questions); } catch { return []; } })();
              printAnamnesis(patient?.name || '', qs);
            }}><i className="fas fa-print" style={{ marginRight: 6 }} />Imprimir</button>
            <button className="btn btn-primary" onClick={() => setViewOpen(false)}>Fechar</button>
          </div>
        }>
        {viewing && (() => {
          const qs = Array.isArray(viewing.custom_questions) ? viewing.custom_questions
            : (() => { try { return JSON.parse(viewing.custom_questions); } catch { return []; } })();
          const resp = viewing.responses || {};
          return (
            <div>
              <p style={{ marginBottom: 16, color: 'var(--gray-500)', fontSize: 13 }}>
                Respondida em {dayjs(viewing.completed_at).format('DD/MM/YYYY HH:mm')}
              </p>
              {qs.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>
                  <i className="fas fa-clipboard" />
                  <p>Esta anamnese não contém perguntas registradas.</p>
                </div>
              )}
              {qs.map((q, i) => {
                const answer = resp[i] ?? resp[String(i)] ?? resp[q];
                const detail = resp[`${i}_detail`] ?? resp[`${String(i)}_detail`];
                return (
                  <div key={i} style={{ marginBottom: 12, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-100)' }}>
                    <p style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: 'var(--gray-700)' }}>{i + 1}. {q}</p>
                    <p style={{ fontSize: 14, color: answer ? 'var(--gray-900)' : 'var(--gray-400)', fontStyle: answer ? 'normal' : 'italic' }}>
                      {answer || 'Sem resposta'}
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
                    <i className="fas fa-comment" style={{ marginRight: 6 }} />Observações do paciente
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
