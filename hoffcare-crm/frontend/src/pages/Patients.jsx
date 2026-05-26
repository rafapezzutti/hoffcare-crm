import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { formatPhone, formatCPF } from '../utils/format';

export default function Patients() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async (q = '') => {
    setLoading(true);
    try {
      const res = await api.get('/patients', { params: { search: q } });
      setItems(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    const v = e.target.value;
    setSearch(v);
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(() => load(v), 400);
  };

  const calcAge = (birthdate) => {
    if (!birthdate) return '-';
    const years = Math.floor((new Date() - new Date(birthdate)) / (365.25 * 24 * 60 * 60 * 1000));
    return `${years} ${t('patients.years')}`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">{t('patients.title')}</h1><p className="page-subtitle">{items.length} {t('patients.registered')}</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/patients/new')}><i className="fas fa-user-plus" /> {t('patients.newPatient')}</button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="fas fa-search" />
            <input className="form-control" placeholder={t('patients.searchPlaceholder')} value={search} onChange={handleSearch} />
          </div>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>{t('patients.name')}</th><th>{t('patients.cpf')}</th><th>{t('patients.age')}</th><th>{t('patients.phone')}</th><th>{t('patients.email')}</th><th>{t('patients.actions')}</th></tr></thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={6}><div className="empty-state"><i className="fas fa-user-injured" /><p>{t('patients.empty')}</p></div></td></tr>}
                {items.map(p => (
                  <tr key={p.id}>
                    <td><strong style={{ cursor: 'pointer', color: 'var(--blue-dark)' }} onClick={() => navigate(`/patients/${p.id}`)}>{p.name}</strong></td>
                    <td>{formatCPF(p.cpf)}</td>
                    <td>{calcAge(p.birthdate)}</td>
                    <td>{formatPhone(p.phone)}</td>
                    <td>{p.email || '-'}</td>
                    <td><div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${p.id}`)}><i className="fas fa-eye" /></button>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/records/new?patient_id=${p.id}`)}><i className="fas fa-file-medical" /></button>
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
