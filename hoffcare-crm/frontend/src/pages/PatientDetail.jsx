import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';
import { formatPhone, formatCPF } from '../utils/format';

const emptyHD = { has_diabetes: false, is_smoker: false, has_cardiac_history: false, has_surgeries: false, has_other_conditions: false, other_conditions_comment: '', comment: '', declaration_date: dayjs().format('YYYY-MM-DD') };
const emptyForm = { name: '', cpf: '', birthdate: '', phone: '', email: '', health_declaration: emptyHD };

const YES_NO = [{ value: false, label: 'Não' }, { value: true, label: 'Sim' }];

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editOpen, setEditOpen] = useState(isNew);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const load = async () => {
    if (isNew) return;
    const [p, r] = await Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/records?patient_id=${id}`)
    ]);
    setPatient(p.data);
    setRecords(r.data);
    const hd = p.data.health_declaration;
    setForm({
      name: p.data.name, cpf: p.data.cpf,
      birthdate: p.data.birthdate?.slice(0, 10) || '',
      phone: p.data.phone || '', email: p.data.email || '',
      health_declaration: hd ? { ...hd, declaration_date: hd.declaration_date?.slice(0, 10) || '' } : emptyHD
    });
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (isNew) {
        const res = await api.post('/patients', form);
        navigate(`/patients/${res.data.id}`);
      } else {
        await api.put(`/patients/${id}`, form);
        setEditOpen(false);
        load();
      }
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const setHD = (field, value) => setForm(p => ({ ...p, health_declaration: { ...p.health_declaration, [field]: value } }));

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

  const HDField = ({ field, label }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <select className="form-control" style={{ width: 80 }}
        value={form.health_declaration[field] === true ? 'true' : 'false'}
        onChange={e => setHD(field, e.target.value === 'true')}>
        <option value="false">Não</option>
        <option value="true">Sim</option>
      </select>
    </div>
  );

  if (!isNew && !patient) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/patients')}><i className="fas fa-arrow-left" /></button>
          <div>
            <h1 className="page-title">{isNew ? 'Novo Paciente' : patient?.name}</h1>
            {!isNew && <p className="page-subtitle">CPF: {formatCPF(patient?.cpf)}</p>}
          </div>
        </div>
        {!isNew && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setEditOpen(true)}><i className="fas fa-pen" /> Editar</button>
            <button className="btn btn-primary" onClick={() => navigate(`/records/new?patient_id=${id}`)}><i className="fas fa-file-medical" /> Novo Registro</button>
          </div>
        )}
      </div>

      {isNew ? (
        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}
          <PatientForm form={form} setForm={setForm} setHD={setHD} HDField={HDField} onSubmit={handleSubmit} onCancel={() => navigate('/patients')} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title"><i className="fas fa-user" style={{ color: 'var(--blue)', marginRight: 8 }} />Dados Pessoais</span></div>
              <InfoRow label="CPF" value={formatCPF(patient.cpf)} />
              <InfoRow label="Data de Nascimento" value={patient.birthdate ? dayjs(patient.birthdate).format('DD/MM/YYYY') : '-'} />
              <InfoRow label="Telefone" value={formatPhone(patient.phone)} />
              <InfoRow label="Email" value={patient.email || '-'} />
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title"><i className="fas fa-heart-pulse" style={{ color: 'var(--orange)', marginRight: 8 }} />Declaração de Saúde</span></div>
              {patient.health_declaration ? (
                <>
                  <HDRow label="Diabetes" value={patient.health_declaration.has_diabetes} />
                  <HDRow label="Fumante" value={patient.health_declaration.is_smoker} />
                  <HDRow label="Histórico cardíaco" value={patient.health_declaration.has_cardiac_history} />
                  <HDRow label="Cirurgias" value={patient.health_declaration.has_surgeries} />
                  <HDRow label="Outras condições" value={patient.health_declaration.has_other_conditions} />
                  {patient.health_declaration.has_other_conditions && patient.health_declaration.other_conditions_comment && (
                    <InfoRow label="Detalhe" value={patient.health_declaration.other_conditions_comment} />
                  )}
                  {patient.health_declaration.comment && <InfoRow label="Observações" value={patient.health_declaration.comment} />}
                  <InfoRow label="Data" value={patient.health_declaration.declaration_date ? dayjs(patient.health_declaration.declaration_date).format('DD/MM/YYYY') : '-'} />
                </>
              ) : <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Sem declaração de saúde</p>}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fas fa-paperclip" style={{ color: 'var(--blue)', marginRight: 8 }} />Arquivos</span>
                <button className="btn btn-outline btn-sm" onClick={() => fileRef.current.click()}><i className="fas fa-upload" /> Anexar</button>
              </div>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
              {(patient.attachments || []).length === 0 ? <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Nenhum arquivo</p> : (
                patient.attachments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span style={{ fontSize: 13 }}><i className="fas fa-file" style={{ marginRight: 8, color: 'var(--gray-400)' }} />{a.original_name}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"><i className="fas fa-eye" /></a>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAttachment(a.id)}><i className="fas fa-trash" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fas fa-clock-rotate-left" style={{ color: 'var(--orange)', marginRight: 8 }} />Histórico de Atendimentos</span></div>
            {records.length === 0 ? <div className="empty-state"><i className="fas fa-file-medical" /><p>Sem registros</p></div> : (
              records.map(r => (
                <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }} onClick={() => navigate(`/records/${r.id}/view`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{dayjs(r.consultation_date).format('DD/MM/YYYY')}</span>
                    <span className={`badge ${r.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>{r.type === 'medico' ? 'Médico' : 'Odonto'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{r.professional_name}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginTop: 4 }}>R$ {Number(r.total_value).toFixed(2)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Modal open={editOpen && !isNew} onClose={() => setEditOpen(false)} title="Editar Paciente" size="modal-xl"
        footer={<><button className="btn btn-outline" onClick={() => setEditOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit}>Salvar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <PatientForm form={form} setForm={setForm} setHD={setHD} HDField={HDField} onSubmit={handleSubmit} />
      </Modal>
    </div>
  );
}

function PatientForm({ form, setForm, setHD, HDField, onSubmit, onCancel }) {
  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });
  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--gray-700)' }}><i className="fas fa-user" style={{ marginRight: 8 }} />Dados Pessoais</h3>
          <div className="form-group"><label className="form-label">Nome <span className="required">*</span></label><input className="form-control" {...f('name')} required /></div>
          <div className="form-group"><label className="form-label">CPF <span className="required">*</span></label><input className="form-control" {...f('cpf')} placeholder="000.000.000-00" required /></div>
          <div className="form-group"><label className="form-label">Data de Nascimento <span className="required">*</span></label><input className="form-control" type="date" {...f('birthdate')} required /></div>
          <div className="form-group"><label className="form-label">Telefone</label><input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" {...f('email')} /></div>
          {onCancel && <div style={{ display: 'flex', gap: 10 }}><button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar Paciente</button></div>}
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--gray-700)' }}><i className="fas fa-heart-pulse" style={{ marginRight: 8 }} />Declaração de Saúde</h3>
          <HDField field="has_diabetes" label="Tem diabetes?" />
          <HDField field="is_smoker" label="Fumante?" />
          <HDField field="has_cardiac_history" label="Histórico de doença cardíaca?" />
          <HDField field="has_surgeries" label="Tem cirurgias?" />
          <HDField field="has_other_conditions" label="Outras condições médicas?" />
          {form.health_declaration?.has_other_conditions && (
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">Descreva as condições</label>
              <textarea className="form-control" rows={2} value={form.health_declaration.other_conditions_comment || ''} onChange={e => setHD('other_conditions_comment', e.target.value)} />
            </div>
          )}
          <div className="form-group" style={{ marginTop: 10 }}>
            <label className="form-label">Observações gerais</label>
            <textarea className="form-control" rows={2} value={form.health_declaration.comment || ''} onChange={e => setHD('comment', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Data da declaração</label>
            <input className="form-control" type="date" value={form.health_declaration.declaration_date || ''} onChange={e => setHD('declaration_date', e.target.value)} />
          </div>
        </div>
      </div>
    </form>
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

function HDRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
      <span style={{ color: 'var(--gray-500)' }}>{label}</span>
      <span className={`badge ${value ? 'badge-red' : 'badge-green'}`}>{value ? 'Sim' : 'Não'}</span>
    </div>
  );
}
