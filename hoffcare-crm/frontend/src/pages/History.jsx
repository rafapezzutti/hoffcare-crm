import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

export default function History() {
  const [searchName, setSearchName] = useState('');
  const [searchCpf, setSearchCpf] = useState('');
  const [records, setRecords] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchName && !searchCpf) return;
    setLoading(true); setSearched(true);
    try {
      const params = {};
      if (searchName) params.patient_name = searchName;
      if (searchCpf) params.cpf = searchCpf;
      const res = await api.get('/records', { params });
      setRecords(res.data);
    } finally { setLoading(false); }
  };

  const groupByPatient = () => {
    const groups = {};
    records.forEach(r => {
      const key = r.patient_cpf;
      if (!groups[key]) groups[key] = { name: r.patient_name, cpf: r.patient_cpf, records: [] };
      groups[key].records.push(r);
    });
    return Object.values(groups);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Histórico de Paciente</h1><p className="page-subtitle">Consulta por nome ou CPF</p></div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label"><i className="fas fa-user" style={{ marginRight: 6 }} />Nome do Paciente</label>
              <input className="form-control" placeholder="Digite o nome..." value={searchName} onChange={e => setSearchName(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label"><i className="fas fa-id-card" style={{ marginRight: 6 }} />CPF do Paciente</label>
              <input className="form-control" placeholder="000.000.000-00" value={searchCpf} onChange={e => setSearchCpf(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Buscando...</> : <><i className="fas fa-search" /> Buscar</>}
            </button>
          </div>
        </form>
      </div>

      {!searched && (
        <div className="empty-state">
          <i className="fas fa-clock-rotate-left" />
          <h3>Busque um paciente</h3>
          <p>Digite o nome ou CPF para ver o histórico completo</p>
        </div>
      )}

      {searched && !loading && records.length === 0 && (
        <div className="empty-state">
          <i className="fas fa-file-circle-xmark" />
          <h3>Nenhum registro encontrado</h3>
          <p>Tente uma busca diferente</p>
        </div>
      )}

      {groupByPatient().map(group => (
        <div key={group.cpf} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{group.name}</h2>
              <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>CPF: {group.cpf} — {group.records.length} registro(s)</p>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
              Total: R$ {group.records.reduce((s, r) => s + Number(r.total_value), 0).toFixed(2)}
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead><tr><th>Data</th><th>Tipo</th><th>Profissional</th><th>Valor</th><th>Ações</th></tr></thead>
              <tbody>
                {group.records.map(r => (
                  <tr key={r.id}>
                    <td><strong>{dayjs(r.consultation_date).format('DD/MM/YYYY')}</strong></td>
                    <td><span className={`badge ${r.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>{r.type === 'medico' ? '🩺 Médico' : '🦷 Odonto'}</span></td>
                    <td>{r.professional_name}<div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.crm_cro}</div></td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>R$ {Number(r.total_value).toFixed(2)}</td>
                    <td><div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/records/${r.id}/view`)}><i className="fas fa-eye" /> Ver</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/records/${r.id}/view`)} title="Imprimir"><i className="fas fa-print" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
