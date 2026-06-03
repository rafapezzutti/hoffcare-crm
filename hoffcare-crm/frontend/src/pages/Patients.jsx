import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { formatPhone, formatCPF } from '../utils/format';
import OcrBatchCapture from '../components/OcrBatchCapture';

export default function Patients() {
  const { t } = useTranslation();
  const [items, setItems]       = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [selected, setSelected] = useState(new Set()); // IDs selecionados
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const load = async (q = '') => {
    setLoading(true);
    setSelected(new Set());
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

  // ── Seleção ────────────────────────────────────────────────────────────────
  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(p => p.id)));
    }
  };

  const allChecked  = items.length > 0 && selected.size === items.length;
  const someChecked = selected.size > 0 && selected.size < items.length;

  // ── Delete único ───────────────────────────────────────────────────────────
  const handleDelete = async (p) => {
    if (!confirm(`Excluir "${p.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/patients/${p.id}`);
      load(search);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir paciente');
    }
  };

  // ── Delete em lote ─────────────────────────────────────────────────────────
  const handleDeleteSelected = async () => {
    const names = items.filter(p => selected.has(p.id)).map(p => p.name);
    if (!confirm(`Excluir ${selected.size} paciente${selected.size > 1 ? 's' : ''}?\n\n${names.slice(0, 5).join('\n')}${names.length > 5 ? `\n... e mais ${names.length - 5}` : ''}\n\nEsta ação não pode ser desfeita.`)) return;

    setDeleting(true);
    let errors = 0;
    for (const id of selected) {
      try { await api.delete(`/patients/${id}`); }
      catch { errors++; }
    }
    setDeleting(false);
    if (errors > 0) alert(`${errors} paciente(s) não puderam ser excluídos.`);
    load(search);
  };

  return (
    <div className="page">
      {showBatch && (
        <OcrBatchCapture
          onClose={() => setShowBatch(false)}
          onComplete={({ saved }) => { setShowBatch(false); if (saved > 0) load(); }}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">{t('patients.title')}</h1>
          <p className="page-subtitle">{items.length} {t('patients.registered')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={handleDeleteSelected} disabled={deleting}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-trash" />
              {deleting ? 'Excluindo...' : `Excluir ${selected.size} selecionado${selected.size > 1 ? 's' : ''}`}
            </button>
          )}
          <button className="btn btn-outline" onClick={() => setShowBatch(true)}
            style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontWeight: 600 }}>
            <i className="fas fa-camera" style={{ marginRight: 6 }} />Captura em Lote
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/patients/new')}>
            <i className="fas fa-user-plus" /> {t('patients.newPatient')}
          </button>
        </div>
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
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll} title={allChecked ? 'Desmarcar todos' : 'Selecionar todos'} />
                  </th>
                  <th>{t('patients.name')}</th>
                  <th>{t('patients.cpf')}</th>
                  <th>{t('patients.age')}</th>
                  <th>{t('patients.phone')}</th>
                  <th>{t('patients.email')}</th>
                  <th>{t('patients.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={7}>
                    <div className="empty-state"><i className="fas fa-user-injured" /><p>{t('patients.empty')}</p></div>
                  </td></tr>
                )}
                {items.map(p => (
                  <tr key={p.id} style={{ background: selected.has(p.id) ? 'rgba(220,53,69,0.04)' : undefined }}>
                    <td>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                    </td>
                    <td>
                      <strong style={{ cursor: 'pointer', color: 'var(--blue-dark)' }}
                        onClick={() => navigate(`/patients/${p.id}`)}>
                        {p.name}
                      </strong>
                    </td>
                    <td>{formatCPF(p.cpf)}</td>
                    <td>{calcAge(p.birthdate)}</td>
                    <td>{formatPhone(p.phone)}</td>
                    <td>{p.email || '-'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${p.id}`)}>
                          <i className="fas fa-eye" />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/records/new?patient_id=${p.id}`)}>
                          <i className="fas fa-file-medical" />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)} title="Excluir">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
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
