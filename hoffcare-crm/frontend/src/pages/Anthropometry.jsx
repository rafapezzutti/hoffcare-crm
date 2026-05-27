import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';

const empty = { eval_date: new Date().toISOString().slice(0,10), weight: '', height: '', body_fat_pct: '', notes: '' };

function imcLabel(imc) {
  if (!imc) return '';
  if (imc < 18.5) return { label: 'Abaixo do peso', color: '#3b82f6' };
  if (imc < 25)   return { label: 'Peso normal', color: '#22c55e' };
  if (imc < 30)   return { label: 'Sobrepeso', color: '#f59e0b' };
  return { label: 'Obesidade', color: '#ef4444' };
}

export default function Anthropometry() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [p, r] = await Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/anthropometry?patient_id=${patientId}`),
    ]);
    setPatient(p.data);
    setRecords(r.data);
  };

  useEffect(() => { load(); }, [patientId]);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item ? { ...item, eval_date: item.eval_date?.slice(0,10) } : empty);
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/anthropometry/${editing.id}`, { ...form, patient_id: patientId });
      else await api.post('/anthropometry', { ...form, patient_id: patientId });
      setOpen(false);
      load();
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover avaliação?')) return;
    await api.delete(`/anthropometry/${id}`);
    load();
  };

  const handleSendReport = async () => {
    setSending(true); setMsg('');
    try {
      const r = await api.post('/anthropometry/send-report', { patient_id: patientId });
      setMsg(r.data.message);
    } catch (err) { setMsg(err.response?.data?.error || 'Erro ao enviar'); }
    finally { setSending(false); }
  };

  const chartData = records.map(r => ({
    data: dayjs(r.eval_date).format('DD/MM'),
    Peso: parseFloat(r.weight) || null,
    IMC: parseFloat(r.imc) || null,
    '% Gordura': parseFloat(r.body_fat_pct) || null,
  }));

  const latest = records[records.length - 1];

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${patientId}`)}>
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title"><i className="fas fa-weight-scale" style={{ marginRight: 8, color: 'var(--blue)' }} />Antropometria</h1>
            {patient && <p className="page-subtitle">{patient.name}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {patient?.email && (
            <button className="btn btn-outline" onClick={handleSendReport} disabled={sending || records.length === 0}>
              <i className="fas fa-envelope" /> {sending ? 'Enviando...' : 'Enviar por E-mail'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => handleOpen()}>
            <i className="fas fa-plus" /> Nova Avaliação
          </button>
        </div>
      </div>

      {msg && <div className={`alert ${msg.includes('Erro') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>{msg}</div>}

      {/* Cards resumo */}
      {latest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Peso Atual', value: latest.weight ? `${latest.weight} kg` : '—', icon: 'fa-weight-scale', color: 'var(--blue)' },
            { label: 'Altura', value: latest.height ? `${latest.height} cm` : '—', icon: 'fa-ruler-vertical', color: 'var(--orange)' },
            { label: 'IMC', value: latest.imc || '—', sub: imcLabel(latest.imc)?.label, subColor: imcLabel(latest.imc)?.color, icon: 'fa-calculator', color: 'var(--success)' },
            { label: '% Gordura', value: latest.body_fat_pct ? `${latest.body_fat_pct}%` : '—', icon: 'fa-droplet', color: '#ef4444' },
          ].map(({ label, value, sub, subColor, icon, color }) => (
            <div key={label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <i className={`fas ${icon}`} style={{ fontSize: 24, color, marginBottom: 8 }} />
              <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{label}</div>
              {sub && <div style={{ fontSize: 11, color: subColor, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Gráficos */}
      {records.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Evolução do Peso (kg)</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="Peso" stroke="#4DB8E8" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">IMC e % Gordura</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="IMC" stroke="#E8841A" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="% Gordura" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela histórico */}
      <div className="card">
        <div className="card-header"><span className="card-title">Histórico de Avaliações</span></div>
        {records.length === 0 ? (
          <div className="empty-state"><i className="fas fa-weight-scale" /><p>Nenhuma avaliação registrada</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Data</th><th>Peso</th><th>Altura</th><th>IMC</th><th>% Gordura</th><th>Obs.</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {[...records].reverse().map(r => {
                  const imcInfo = imcLabel(r.imc);
                  return (
                    <tr key={r.id}>
                      <td>{dayjs(r.eval_date).format('DD/MM/YYYY')}</td>
                      <td>{r.weight ? `${r.weight} kg` : '—'}</td>
                      <td>{r.height ? `${r.height} cm` : '—'}</td>
                      <td>
                        {r.imc ? (
                          <span>
                            {r.imc}
                            {imcInfo && <span style={{ fontSize: 10, color: imcInfo.color, marginLeft: 4 }}>({imcInfo.label})</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{r.body_fat_pct ? `${r.body_fat_pct}%` : '—'}</td>
                      <td style={{ maxWidth: 160, fontSize: 12, color: 'var(--gray-500)' }}>{r.notes || '—'}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => handleOpen(r)}><i className="fas fa-pen" /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><i className="fas fa-trash" /></button>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar Avaliação' : 'Nova Avaliação'}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit}>Salvar</button></>}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label className="form-label">Data <span className="required">*</span></label>
              <input className="form-control" type="date" value={form.eval_date} onChange={e => setForm(p => ({ ...p, eval_date: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Peso (kg)</label>
              <input className="form-control" type="number" step="0.01" placeholder="Ex: 72.5" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Altura (cm)</label>
              <input className="form-control" type="number" step="0.1" placeholder="Ex: 170" value={form.height} onChange={e => setForm(p => ({ ...p, height: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">% Gordura (PGC)</label>
              <input className="form-control" type="number" step="0.1" placeholder="Ex: 22.5" value={form.body_fat_pct} onChange={e => setForm(p => ({ ...p, body_fat_pct: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Observações</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          {form.weight && form.height && (
            <div style={{ padding: '12px 16px', background: 'var(--blue-light, #f0f9ff)', borderRadius: 8, fontSize: 13 }}>
              IMC calculado: <strong>{(form.weight / ((form.height/100)**2)).toFixed(2)}</strong>
              {' · '}<span style={{ color: imcLabel((form.weight / ((form.height/100)**2)).toFixed(2))?.color }}>
                {imcLabel((form.weight / ((form.height/100)**2)).toFixed(2))?.label}
              </span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
