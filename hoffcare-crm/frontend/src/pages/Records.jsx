import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

export default function Records() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/records'); setRecords(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Remover registro?')) return;
    await api.delete(`/records/${id}`); load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Registros de Procedimento</h1><p className="page-subtitle">{records.length} registros</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/records/new')}><i className="fas fa-plus" /> Novo Registro</button>
      </div>

      <div className="card">
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Data</th><th>Tipo</th><th>Paciente</th><th>Profissional</th><th>Total</th><th>Ações</th></tr></thead>
              <tbody>
                {records.length === 0 && <tr><td colSpan={6}><div className="empty-state"><i className="fas fa-file-medical" /><p>Nenhum registro encontrado</p></div></td></tr>}
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{dayjs(r.consultation_date).format('DD/MM/YYYY')}</td>
                    <td><span className={`badge ${r.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>{r.type === 'medico' ? 'Médico' : 'Odonto'}</span></td>
                    <td><strong>{r.patient_name}</strong><div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.patient_cpf}</div></td>
                    <td>{r.professional_name}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>R$ {Number(r.total_value).toFixed(2)}</td>
                    <td><div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/records/${r.id}/view`)}><i className="fas fa-eye" /></button>
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/records/${r.id}/edit`)}><i className="fas fa-pen" /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><i className="fas fa-trash" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
