import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import dayjs from 'dayjs';
import { getProfType } from '../config/professionalTypes';

export default function Records() {
  const { t } = useTranslation();
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
    if (!confirm(t('records.removeRecord'))) return;
    await api.delete(`/records/${id}`); load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">{t('records.title')}</h1><p className="page-subtitle">{records.length} {t('records.records')}</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/records/new')}><i className="fas fa-plus" /> {t('records.newRecord')}</button>
      </div>

      <div className="card">
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>{t('records.date')}</th><th>{t('records.type')}</th><th>{t('records.patient')}</th><th>{t('records.professional')}</th><th>{t('records.total')}</th><th>{t('records.actions')}</th></tr></thead>
              <tbody>
                {records.length === 0 && <tr><td colSpan={6}><div className="empty-state"><i className="fas fa-file-medical" /><p>{t('records.empty')}</p></div></td></tr>}
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{dayjs(r.consultation_date).format('DD/MM/YYYY')}</td>
                    <td><span className={`badge ${r.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>{getProfType(r.type).label}</span></td>
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
