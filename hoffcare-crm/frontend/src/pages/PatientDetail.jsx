import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import OcrMultiCapture from '../components/OcrMultiCapture';
import dayjs from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
import { formatPhone, formatCPF } from '../utils/format';

const emptyForm = { name: '', cpf: '', birthdate: '', phone: '', email: '' };

const BUDGET_STATUS = {
  rascunho:   { label: 'Rascunho',   badge: 'badge-gray'   },
  enviado:    { label: 'Enviado',    badge: 'badge-blue'   },
  aguardando: { label: 'Aguardando', badge: 'badge-orange' },
  aceito:     { label: 'Aceito',     badge: 'badge-green'  },
  declinado:  { label: 'Declinado',  badge: 'badge-red'    },
  expirado:   { label: 'Expirado',   badge: 'badge-gray'   },
};

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [patient,       setPatient]       = useState(null);
  const [form,          setForm]          = useState(emptyForm);
  const [editOpen,      setEditOpen]      = useState(isNew);
  const [records,       setRecords]       = useState([]);
  const [anamneses,     setAnamneses]     = useState([]);
  const [budgets,       setBudgets]       = useState([]);
  const [error,         setError]         = useState('');
  const fileRef = useRef();

  const load = async () => {
    if (isNew) return;
    const [p, r, a, b] = await Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/records?patient_id=${id}`),
      api.get(`/anamnesis?patient_id=${id}`),
      api.get(`/budgets?patient_id=${id}`).catch(() => ({ data: [] })),
    ]);
    setPatient(p.data);
    setRecords(r.data);
    setAnamneses(a.data);
    setBudgets(b.data);
    setForm({
      name:      p.data.name,
      cpf:       p.data.cpf,
      birthdate: p.data.birthdate?.slice(0, 10) || '',
      phone:     p.data.phone || '',
      email:     p.data.email || '',
    });
  };

  useEffect(() => { load(); }, [id]);

  // ── Validação ────────────────────────────────────────────────────────────────
  const validateForm = () => {
    if (!form.name?.trim()) return 'Nome é obrigatório.';
    if (!form.cpf?.trim())  return 'CPF é obrigatório.';
    const cpfDigits = form.cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) return 'CPF deve ter 11 dígitos.';
    if (!form.birthdate) return 'Data de nascimento é obrigatória.';
    const birth = dayjs(form.birthdate);
    if (!birth.isValid() || birth.isAfter(dayjs())) return 'Data de nascimento inválida.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const err = validateForm();
    if (err) { setError(err); return; }
    const payload = { ...form, cpf: form.cpf.replace(/\D/g, '') };
    try {
      if (isNew) {
        const res = await api.post('/patients', payload);
        navigate(`/patients/${res.data.id}`);
      } else {
        await api.put(`/patients/${id}`, payload);
        setEditOpen(false);
        load();
      }
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await api.post(`/patients/${id}/attachments`, fd);
    load();
  };

  const handleDeleteAttachment = async (attachId) => {
    if (!confirm('Remover arquivo?')) return;
    await api.delete(`/patients/${id}/attachments/${attachId}`);
    load();
  };

  if (!isNew && !patient) return <div className="loading"><div className="spinner" /></div>;

  // Última anamnese respondida
  const lastAnamnesis = anamneses.find(a => a.status === 'completed');
  const lastAnamnesisQuestions = lastAnamnesis
    ? (Array.isArray(lastAnamnesis.custom_questions)
        ? lastAnamnesis.custom_questions
        : (() => { try { return JSON.parse(lastAnamnesis.custom_questions); } catch { return []; } })())
    : [];
  const lastAnamnesisResponses = lastAnamnesis?.responses || {};

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/patients')}>
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">{isNew ? 'Novo Paciente' : patient?.name}</h1>
            {!isNew && <p className="page-subtitle">CPF: {formatCPF(patient?.cpf)}</p>}
          </div>
        </div>
        {!isNew && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => navigate(`/patients/${id}/evolution`)}>
              <i className="fas fa-notes-medical" /> Evolução
            </button>
            <button className="btn btn-outline" onClick={() => navigate(`/patients/${id}/odontogram`)}>
              <i className="fas fa-tooth" /> Odontograma
            </button>
            <button className="btn btn-outline" onClick={() => navigate(`/patients/${id}/before-after`)}>
              <i className="fas fa-images" /> Antes/Depois
            </button>
            <button className="btn btn-outline" onClick={() => navigate(`/patients/${id}/anamnesis`)}>
              <i className="fas fa-clipboard-list" /> Anamnese
            </button>
            <button className="btn btn-outline" onClick={() => navigate(`/patients/${id}/anthropometry`)}>
              <i className="fas fa-weight-scale" /> Antropometria
            </button>
            <button className="btn btn-outline" onClick={() => setEditOpen(true)}>
              <i className="fas fa-pen" /> Editar
            </button>
            <button className="btn btn-primary" onClick={() => navigate(`/records/new?patient_id=${id}`)}>
              <i className="fas fa-file-medical" /> Novo Registro
            </button>
          </div>
        )}
      </div>

      {isNew ? (
        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}
          <PatientForm form={form} setForm={setForm} onSubmit={handleSubmit} onCancel={() => navigate('/patients')} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── Coluna esquerda ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Dados pessoais */}
            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fas fa-user" style={{ color: 'var(--blue)', marginRight: 8 }} />Dados Pessoais</span>
              </div>
              <InfoRow label="CPF"               value={formatCPF(patient.cpf)} />
              <InfoRow label="Data de Nascimento" value={patient.birthdate ? dayjs(patient.birthdate).format('DD/MM/YYYY') : '-'} />
              <InfoRow label="Telefone"           value={formatPhone(patient.phone)} />
              <InfoRow label="Email"              value={patient.email || '-'} />
            </div>

            {/* Última anamnese respondida */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <i className="fas fa-clipboard-check" style={{ color: '#34d399', marginRight: 8 }} />
                  Última Anamnese
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${id}/anamnesis`)}>
                  <i className="fas fa-arrow-right" /> Ver todas
                </button>
              </div>
              {!lastAnamnesis ? (
                <div style={{ padding: '12px 0', color: 'var(--gray-400)', fontSize: 13 }}>
                  Nenhuma anamnese respondida.
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 10 }}
                    onClick={() => navigate(`/patients/${id}/anamnesis`)}>
                    <i className="fas fa-plus" /> Criar
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12, color: 'var(--gray-500)' }}>
                    <span><i className="fas fa-calendar" style={{ marginRight: 4 }} />{dayjs(lastAnamnesis.completed_at).format('DD/MM/YYYY HH:mm')}</span>
                    <span><i className="fas fa-list" style={{ marginRight: 4 }} />{lastAnamnesisQuestions.length} perguntas</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {lastAnamnesisQuestions.slice(0, 5).map((q, i) => {
                      const ans = lastAnamnesisResponses[i] ?? lastAnamnesisResponses[String(i)];
                      if (!ans) return null;
                      return (
                        <div key={i} style={{ padding: '8px 10px', background: 'var(--gray-50)', borderRadius: 6, borderLeft: `3px solid ${ans === 'Sim' ? '#ef4444' : ans === 'Não' ? '#22c55e' : '#94a3b8'}` }}>
                          <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 2 }}>{q}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: ans === 'Sim' ? '#dc2626' : ans === 'Não' ? '#16a34a' : 'var(--gray-700)' }}>{ans}</div>
                        </div>
                      );
                    }).filter(Boolean)}
                    {lastAnamnesisQuestions.length > 5 && (
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: 0 }}>
                        + {lastAnamnesisQuestions.length - 5} perguntas —{' '}
                        <button style={{ background: 'none', border: 'none', color: '#4DB8E8', cursor: 'pointer', fontSize: 12, padding: 0 }}
                          onClick={() => navigate(`/patients/${id}/anamnesis`)}>ver completo</button>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Arquivos */}
            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fas fa-paperclip" style={{ color: 'var(--blue)', marginRight: 8 }} />Arquivos</span>
                <button className="btn btn-outline btn-sm" onClick={() => fileRef.current.click()}>
                  <i className="fas fa-upload" /> Anexar
                </button>
              </div>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
              {(patient.attachments || []).length === 0
                ? <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Nenhum arquivo</p>
                : patient.attachments.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <span style={{ fontSize: 13 }}><i className="fas fa-file" style={{ marginRight: 8, color: 'var(--gray-400)' }} />{a.original_name}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={`${API_URL}/uploads/${a.filename}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"><i className="fas fa-eye" /></a>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAttachment(a.id)}><i className="fas fa-trash" /></button>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* ── Coluna direita ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Orçamentos */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <i className="fas fa-file-invoice" style={{ color: '#E8841A', marginRight: 8 }} />
                  Orçamentos
                </span>
                <button className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/budgets/new?patient_id=${id}&patient_name=${encodeURIComponent(patient.name)}`)}>
                  <i className="fas fa-plus" /> Novo Orçamento
                </button>
              </div>
              {budgets.length === 0
                ? <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhum orçamento cadastrado.</p>
                : budgets.map(b => {
                    const st = BUDGET_STATUS[b.status] || { label: b.status, badge: 'badge-gray' };
                    return (
                      <div key={b.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }}
                        onClick={() => navigate(`/budgets/${b.id}/edit`)}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {b.number ? `Orç. #${b.number}` : `Orçamento`}
                            <span className={`badge ${st.badge}`} style={{ marginLeft: 8, fontSize: 10 }}>{st.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                            {dayjs(b.created_at).format('DD/MM/YYYY')}
                            {b.valid_until && ` · válido até ${dayjs(b.valid_until).format('DD/MM/YYYY')}`}
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 14 }}>
                          R$ {Number(b.total).toFixed(2)}
                        </span>
                      </div>
                    );
                  })
              }
            </div>

            {/* Histórico de atendimentos */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <i className="fas fa-clock-rotate-left" style={{ color: 'var(--orange)', marginRight: 8 }} />
                  Histórico de Atendimentos
                </span>
              </div>
              {records.length === 0
                ? <div className="empty-state"><i className="fas fa-file-medical" /><p>Sem registros</p></div>
                : records.map(r => (
                    <div key={r.id}
                      style={{ padding: '12px 0', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }}
                      onClick={() => navigate(`/records/${r.id}/view`)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>{dayjs(r.consultation_date).format('DD/MM/YYYY')}</span>
                        <span className={`badge ${r.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>
                          {r.type === 'medico' ? 'Médico' : 'Odonto'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{r.professional_name}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginTop: 4 }}>
                        R$ {Number(r.total_value).toFixed(2)}
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      <Modal open={editOpen && !isNew} onClose={() => setEditOpen(false)} title="Editar Paciente" size="modal-lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>Salvar</button>
          </>
        }>
        {error && <div className="alert alert-error">{error}</div>}
        <PatientForm form={form} setForm={setForm} onSubmit={handleSubmit} />
      </Modal>
    </div>
  );
}

// ── Formulário de edição/criação (sem declaração de saúde) ───────────────────
function PatientForm({ form, setForm, onSubmit, onCancel }) {
  const [showOcr, setShowOcr] = useState(false);
  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  const handleOcrExtracted = (data) => {
    setForm(prev => ({
      ...prev,
      name:      data.name      || prev.name,
      cpf:       data.cpf       ? data.cpf.replace(/\D/g, '') : prev.cpf,
      birthdate: data.birthdate || prev.birthdate,
      phone:     data.phone     ? data.phone.replace(/\D/g, '') : prev.phone,
      email:     data.email     || prev.email,
    }));
    setShowOcr(false);
  };

  return (
    <>
      {showOcr && (
        <OcrMultiCapture onExtracted={handleOcrExtracted} onClose={() => setShowOcr(false)} />
      )}
      <form onSubmit={onSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-700)', margin: 0 }}>
            <i className="fas fa-user" style={{ marginRight: 8 }} />Dados Pessoais
          </h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowOcr(true)}
            style={{ background: 'rgba(77,184,232,0.08)', borderColor: 'var(--blue)', color: 'var(--blue)', fontWeight: 600 }}>
            <i className="fas fa-camera" style={{ marginRight: 6 }} />Captura com IA
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nome <span className="required">*</span></label>
            <input className="form-control" {...f('name')} required />
          </div>
          <div className="form-group">
            <label className="form-label">CPF <span className="required">*</span></label>
            <input className="form-control" {...f('cpf')} placeholder="000.000.000-00" required />
          </div>
          <div className="form-group">
            <label className="form-label">Data de Nascimento <span className="required">*</span></label>
            <input className="form-control" type="date" {...f('birthdate')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" {...f('email')} />
          </div>
        </div>
        {onCancel && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar Paciente</button>
          </div>
        )}
      </form>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
      <span style={{ color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
