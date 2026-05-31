import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export default function BeforeAfter() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [patient, setPatient] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ photo_type: 'before', procedure_name: '', photo_date: new Date().toISOString().slice(0,10), notes: '' });
  const [compareMode, setCompareMode] = useState(false);
  const [selectedBefore, setSelectedBefore] = useState(null);
  const [selectedAfter, setSelectedAfter] = useState(null);
  const [filter, setFilter] = useState('');
  const fileRef = useRef();

  const load = async () => {
    const [p, ph] = await Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/before-after?patient_id=${patientId}`),
    ]);
    setPatient(p.data);
    setPhotos(ph.data);
  };

  useEffect(() => { load(); }, [patientId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('patient_id', patientId);
      fd.append('photo_type', form.photo_type);
      fd.append('procedure_name', form.procedure_name);
      fd.append('photo_date', form.photo_date);
      fd.append('notes', form.notes);
      await api.post('/before-after', fd);
      fileRef.current.value = '';
      load();
    } catch (err) {
      alert(err.response?.data?.error || t('beforeAfter.upload'));
    } finally { setUploading(false); }
  };

  const handleDelete = async (photoId) => {
    if (!confirm(t('beforeAfter.delete'))) return;
    await api.delete(`/before-after/${photoId}`);
    load();
  };

  const photoUrl = (filename) => `${API_URL}/uploads/before_after/${filename}`;

  const procedures = [...new Set(photos.map(p => p.procedure_name).filter(Boolean))];
  const filtered = filter ? photos.filter(p => p.procedure_name === filter) : photos;
  const beforePhotos = filtered.filter(p => p.photo_type === 'before');
  const afterPhotos  = filtered.filter(p => p.photo_type === 'after');

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${patientId}`)}>
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title"><i className="fas fa-images" style={{ marginRight: 8, color: 'var(--blue)' }} />{t('beforeAfter.title')}</h1>
            {patient && <p className="page-subtitle">{patient.name}</p>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => fileRef.current.click()} disabled={uploading}>
          <i className="fas fa-upload" /> {uploading ? t('common.loading') : t('beforeAfter.newRecord')}
        </button>
      </div>

      {/* Formulário de upload */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">{t('beforeAfter.upload')}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('beforeAfter.photoType')}</label>
            <select className="form-control" value={form.photo_type} onChange={e => setForm(p => ({ ...p, photo_type: e.target.value }))}>
              <option value="before">{t('beforeAfter.before')}</option>
              <option value="after">{t('beforeAfter.after')}</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('beforeAfter.procedure')}</label>
            <input className="form-control" placeholder="Ex: Harmonização facial" value={form.procedure_name}
              onChange={e => setForm(p => ({ ...p, procedure_name: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('beforeAfter.date')}</label>
            <input className="form-control" type="date" value={form.photo_date}
              onChange={e => setForm(p => ({ ...p, photo_date: e.target.value }))} />
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => fileRef.current.click()} disabled={uploading}>
              <i className="fas fa-camera" /> {t('beforeAfter.upload')}
            </button>
          </div>
        </div>
      </div>

      {/* Filtros e comparação */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-control" style={{ width: 220 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">{t('beforeAfter.allProcedures')}</option>
          {procedures.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          className={`btn ${compareMode ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setCompareMode(v => !v); setSelectedBefore(null); setSelectedAfter(null); }}
        >
          <i className="fas fa-columns" /> {compareMode ? t('beforeAfter.exitCompare') : t('beforeAfter.compareMode')}
        </button>
        <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>
          {beforePhotos.length} {t('beforeAfter.before')} · {afterPhotos.length} {t('beforeAfter.after')}
        </span>
      </div>

      {/* Modo comparação lado a lado */}
      {compareMode && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">{t('beforeAfter.sideBySide')}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--orange)' }}>⬅ {t('beforeAfter.before')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                {beforePhotos.map(p => (
                  <img key={p.id} src={photoUrl(p.filename)} alt="antes"
                    onClick={() => setSelectedBefore(p)}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, cursor: 'pointer',
                      border: selectedBefore?.id === p.id ? '3px solid var(--orange)' : '3px solid transparent', transition: 'border 0.2s' }} />
                ))}
              </div>
              {selectedBefore && (
                <img src={photoUrl(selectedBefore.filename)} alt="antes selecionado"
                  style={{ width: '100%', borderRadius: 12, maxHeight: 400, objectFit: 'contain', background: '#f0f0f0' }} />
              )}
            </div>
            <div>
              <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--blue)' }}>{t('beforeAfter.after')} ➡</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                {afterPhotos.map(p => (
                  <img key={p.id} src={photoUrl(p.filename)} alt="depois"
                    onClick={() => setSelectedAfter(p)}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, cursor: 'pointer',
                      border: selectedAfter?.id === p.id ? '3px solid var(--blue)' : '3px solid transparent', transition: 'border 0.2s' }} />
                ))}
              </div>
              {selectedAfter && (
                <img src={photoUrl(selectedAfter.filename)} alt="depois selecionado"
                  style={{ width: '100%', borderRadius: 12, maxHeight: 400, objectFit: 'contain', background: '#f0f0f0' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grade de fotos */}
      {[{ label: t('beforeAfter.before'), type: 'before', color: 'var(--orange)', list: beforePhotos },
        { label: t('beforeAfter.after'), type: 'after', color: 'var(--blue)', list: afterPhotos }].map(({ label, color, list }) => (
        <div key={label} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 12 }}>
            <i className="fas fa-image" style={{ marginRight: 8 }} />{label} ({list.length})
          </h3>
          {list.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <i className="fas fa-image" />
              <p>{t('beforeAfter.noRecords')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {list.map(photo => (
                <div key={photo.id} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                  <img src={photoUrl(photo.filename)} alt={photo.original_name}
                    style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '10px 12px' }}>
                    {photo.procedure_name && <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{photo.procedure_name}</p>}
                    <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      {new Date(photo.photo_date).toLocaleDateString('pt-BR')}
                    </p>
                    {photo.notes && <p style={{ fontSize: 11, color: 'var(--gray-600)', marginTop: 4 }}>{photo.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(photo.id)}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(220,53,69,0.85)', border: 'none',
                      borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 12 }}>
                    <i className="fas fa-trash" />
                  </button>
                  <a href={photoUrl(photo.filename)} target="_blank" rel="noreferrer"
                    style={{ position: 'absolute', top: 8, right: 44, background: 'rgba(0,0,0,0.6)', border: 'none',
                      borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                    <i className="fas fa-expand" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
