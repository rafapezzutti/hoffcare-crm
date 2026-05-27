import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';

const SPECIALTIES = [
  { value: 'geral',        label: 'Geral / Clínico' },
  { value: 'estetica',     label: 'Estética / Dermatologia' },
  { value: 'odontologica', label: 'Odontológica' },
];

const STATUS_MAP = {
  pending:   { label: 'Pendente',   color: '#f59e0b', badge: 'badge-orange' },
  sent:      { label: 'Enviada',    color: '#3b82f6', badge: 'badge-blue' },
  completed: { label: 'Respondida', color: '#22c55e', badge: 'badge-green' },
};

export default function Anamnesis() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [form, setForm] = useState({ specialty: 'geral', send_email: true, custom_questions: [] });
  const [customQ, setCustomQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [p, a, d] = await Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/anamnesis?patient_id=${patientId}`),
      api.get('/anamnesis/defaults'),
    ]);
    setPatient(p.data);
    setList(a.data);
    setDefaults(d.data);
  };

  useEffect(() => { load(); }, [patientId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/anamnesis', { patient_id: patientId, ...form });
      setOpen(false);
      setForm({ specialty: 'geral', send_email: true, custom_questions: [] });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Erro ao criar anamnese'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta anamnese?')) return;
    await api.delete(`/anamnesis/${id}`);
    load();
  };

  const addCustomQ = () => {
    if (!customQ.trim()) return;
    setForm(p => ({ ...p, custom_questions: [...p.custom_questions, customQ.trim()] }));
    setCustomQ('');
  };

  const removeCustomQ = (i) => setForm(p => ({ ...p, custom_questions: p.custom_questions.filter((_, idx) => idx !== i) }));

  const previewQuestions = form.custom_questions.length > 0 ? form.custom_questions : (defaults[form.specialty] || []);

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
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
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
                <tr><th>Data</th><th>Especialidade</th><th>Status</th><th>Enviada em</th><th>Respondida em</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {list.map(a => (
                  <tr key={a.id}>
                    <td>{dayjs(a.created_at).format('DD/MM/YYYY')}</td>
                    <td>{SPECIALTIES.find(s => s.value === a.specialty)?.label || a.specialty}</td>
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
                        <a href={`${window.location.origin}/anamnesis/form/${a.token}`} target="_blank" rel="noreferrer"
                          className="btn btn-outline btn-sm"><i className="fas fa-link" /></a>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}><i className="fas fa-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nova Anamnese Digital" size="modal-xl"
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Criando...' : 'Criar e Enviar'}
          </button></>}>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div className="form-group">
                <label className="form-label">Especialidade</label>
                <select className="form-control" value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}>
                  {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" id="send_email" checked={form.send_email}
                  onChange={e => setForm(p => ({ ...p, send_email: e.target.checked }))} />
                <label htmlFor="send_email" style={{ cursor: 'pointer', marginBottom: 0 }}>
                  Enviar por e-mail ao paciente {patient?.email ? `(${patient.email})` : '(sem e-mail cadastrado)'}
                </label>
              </div>
              {!patient?.email && (
                <div className="alert alert-error" style={{ fontSize: 12, padding: '8px 12px' }}>
                  Paciente sem e-mail. O link será gerado mas não enviado automaticamente.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Adicionar perguntas personalizadas</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" placeholder="Digite uma pergunta..." value={customQ}
                    onChange={e => setCustomQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomQ(); } }} />
                  <button type="button" className="btn btn-outline" onClick={addCustomQ}><i className="fas fa-plus" /></button>
                </div>
              </div>
              {form.custom_questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, padding: '6px 10px', background: 'var(--gray-50)', borderRadius: 6 }}>{q}</span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCustomQ(i)}><i className="fas fa-times" /></button>
                </div>
              ))}
            </div>
            <div>
              <label className="form-label">Perguntas que serão enviadas ({previewQuestions.length})</label>
              <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12, maxHeight: 360, overflowY: 'auto' }}>
                {previewQuestions.map((q, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                    <span style={{ color: 'var(--gray-400)', marginRight: 8 }}>{i+1}.</span>{q}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal ver respostas */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Respostas da Anamnese" size="modal-xl"
        footer={<button className="btn btn-primary" onClick={() => setViewOpen(false)}>Fechar</button>}>
        {viewing && (
          <div>
            <p style={{ marginBottom: 16, color: 'var(--gray-500)', fontSize: 13 }}>
              Respondida em {dayjs(viewing.completed_at).format('DD/MM/YYYY HH:mm')}
            </p>
            {(viewing.custom_questions || []).map((q, i) => (
              <div key={i} style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <p style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{i+1}. {q}</p>
                <p style={{ fontSize: 14, color: 'var(--gray-700)' }}>
                  {viewing.responses?.[i] || viewing.responses?.[q] || <em style={{ color: 'var(--gray-400)' }}>Sem resposta</em>}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
