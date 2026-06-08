import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export default function Evolution() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();

  const [patient,    setPatient]    = useState(null);
  const [evolutions, setEvolutions] = useState([]);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState(null); // null = novo, obj = editar
  const [loading,    setLoading]    = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiError,    setAiError]    = useState('');
  const [lightbox,   setLightbox]   = useState(null); // { src }
  const fileRef = useRef();

  // ── Form state ───────────────────────────────────────────────────────────────
  const emptyForm = { note: '', evolution_date: dayjs().format('YYYY-MM-DD'), professional_name: '' };
  const [form,       setForm]       = useState(emptyForm);
  const [newImages,  setNewImages]  = useState([]);   // File[]
  const [keepImages, setKeepImages] = useState([]);   // filenames a manter (edição)
  const [previews,   setPreviews]   = useState([]);   // object URLs para preview

  const load = async () => {
    const [p, e] = await Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/evolution?patient_id=${patientId}`),
    ]);
    setPatient(p.data);
    setEvolutions(e.data);
  };

  useEffect(() => { load(); }, [patientId]);

  // ── Abrir modal ──────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setNewImages([]);
    setPreviews([]);
    setKeepImages([]);
    setAiError('');
    setModalOpen(true);
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      note:              ev.note,
      evolution_date:    dayjs(ev.evolution_date).format('YYYY-MM-DD'),
      professional_name: ev.professional_name || '',
    });
    setKeepImages((ev.images || []).map(i => i.filename));
    setNewImages([]);
    setPreviews([]);
    setAiError('');
    setModalOpen(true);
  };

  // ── Imagens ──────────────────────────────────────────────────────────────────
  const handleImageFiles = (files) => {
    const arr = [...files];
    setNewImages(prev => [...prev, ...arr]);
    setPreviews(prev => [...prev, ...arr.map(f => URL.createObjectURL(f))]);
  };

  const removeNewImage = (i) => {
    setNewImages(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const removeExistingImage = (filename) => {
    setKeepImages(prev => prev.filter(f => f !== filename));
  };

  // ── Salvar ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.note.trim()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('patient_id',       patientId);
      fd.append('note',             form.note.trim());
      fd.append('evolution_date',   form.evolution_date);
      fd.append('professional_name', form.professional_name.trim());
      newImages.forEach(img => fd.append('images', img));
      if (editing) keepImages.forEach(f => fd.append('keep_images', f));

      if (editing) {
        await api.put(`/evolution/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/evolution', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  // ── IA: estruturar anotação ─────────────────────────────────────────────────
  const handleAiStructure = async () => {
    if (!form.note.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const prompt = `Você é um assistente médico. Receba a seguinte anotação clínica bruta e reescreva como uma nota clínica estruturada profissional em português. Use seções como: Queixa Principal, Histórico, Exame Clínico, Hipótese Diagnóstica e Conduta/Plano — incluindo apenas as seções relevantes ao conteúdo fornecido. Preserve todas as informações originais sem adicionar dados inventados. Anotação bruta:\n\n${form.note.trim()}`;
      const res = await api.post('/ai/chat', { history: [{ role: 'user', text: prompt }] });
      const structured = res.data?.text || res.data?.response || '';
      if (structured) setForm(p => ({ ...p, note: structured }));
    } catch (err) {
      if (err.response?.status === 403) {
        setAiError('Permissão de IA não habilitada para este usuário.');
      } else {
        setAiError('Erro ao chamar a IA. Tente novamente.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  // ── Excluir ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Excluir este registro de evolução?')) return;
    setDeleting(id);
    try {
      await api.delete(`/evolution/${id}`);
      load();
    } finally { setDeleting(null); }
  };

  if (!patient) return <div className="loading"><div className="spinner" /></div>;

  // Agrupa por mês/ano para separadores na timeline
  const grouped = evolutions.reduce((acc, ev) => {
    const key = dayjs(ev.evolution_date).format('MMMM YYYY');
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${patientId}`)}>
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">
              <i className="fas fa-notes-medical" style={{ marginRight: 8, color: '#4DB8E8' }} />
              Evolução Clínica
            </h1>
            <p className="page-subtitle">{patient.name}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <i className="fas fa-plus" /> Nova Evolução
        </button>
      </div>

      {/* Timeline */}
      {evolutions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="fas fa-notes-medical" />
            <p>Nenhuma evolução clínica registrada.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNew}>
              <i className="fas fa-plus" /> Registrar primeira evolução
            </button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {Object.entries(grouped).map(([month, items]) => (
            <div key={month}>
              {/* Separador de mês */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                  {month}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
              </div>

              {items.map((ev, idx) => (
                <div key={ev.id} style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  {/* Linha vertical + bolinha */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#4DB8E8', border: '3px solid #fff', boxShadow: '0 0 0 2px #4DB8E8', marginTop: 6, flexShrink: 0 }} />
                    {idx < items.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: 'var(--gray-200)', marginTop: 6 }} />
                    )}
                  </div>

                  {/* Card */}
                  <div className="card" style={{ flex: 1, padding: '16px 20px', marginBottom: 0 }}>
                    {/* Cabeçalho do card */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-800)' }}>
                          {dayjs(ev.evolution_date).format('DD/MM/YYYY')}
                        </div>
                        {ev.professional_name && (
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            <i className="fas fa-user-doctor" style={{ marginRight: 4 }} />
                            {ev.professional_name}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(ev)}>
                          <i className="fas fa-pen" />
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={deleting === ev.id} onClick={() => handleDelete(ev.id)}>
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </div>

                    {/* Nota */}
                    <p style={{ fontSize: 14, color: 'var(--gray-800)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {ev.note}
                    </p>

                    {/* Fotos */}
                    {ev.images?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        {ev.images.map((img, j) => (
                          <img
                            key={j}
                            src={`${API_URL}/uploads/evolution/${img.filename}`}
                            alt={img.original_name}
                            onClick={() => setLightbox({ src: `${API_URL}/uploads/evolution/${img.filename}` })}
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)', cursor: 'zoom-in' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal criar/editar ────────────────────────────────────────────────── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>

            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>
                <i className="fas fa-notes-medical" style={{ marginRight: 8, color: '#4DB8E8' }} />
                {editing ? 'Editar Evolução' : 'Nova Evolução'}
              </span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--gray-400)' }}>×</button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Data</label>
                  <input type="date" className="form-control"
                    value={form.evolution_date}
                    onChange={e => setForm(p => ({ ...p, evolution_date: e.target.value }))}
                    required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Profissional</label>
                  <input type="text" className="form-control" placeholder="Nome do profissional (opcional)"
                    value={form.professional_name}
                    onChange={e => setForm(p => ({ ...p, professional_name: e.target.value }))} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', margin: 0 }}>
                    Anotação clínica <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button type="button"
                    onClick={handleAiStructure}
                    disabled={aiLoading || !form.note.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', border: '1px solid #8b5cf6', borderRadius: 6,
                      background: aiLoading ? '#f5f3ff' : '#fff', color: '#7c3aed',
                      fontSize: 11, fontWeight: 600, cursor: aiLoading || !form.note.trim() ? 'not-allowed' : 'pointer',
                      opacity: !form.note.trim() ? 0.5 : 1,
                    }}>
                    <i className={`fas ${aiLoading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} />
                    {aiLoading ? 'Estruturando...' : 'Estruturar com IA'}
                  </button>
                </div>
                {aiError && (
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12, marginBottom: 6 }}>
                    {aiError}
                  </div>
                )}
                <textarea className="form-control"
                  rows={6}
                  placeholder="Descreva a evolução do tratamento, observações clínicas, procedimentos realizados..."
                  value={form.note}
                  onChange={e => { setForm(p => ({ ...p, note: e.target.value })); setAiError(''); }}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Fotos existentes (edição) */}
              {editing && (editing.images || []).length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>
                    Fotos atuais — clique × para remover
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {editing.images.map((img) => {
                      const kept = keepImages.includes(img.filename);
                      return (
                        <div key={img.filename} style={{ position: 'relative', opacity: kept ? 1 : 0.3 }}>
                          <img src={`${API_URL}/uploads/evolution/${img.filename}`} alt=""
                            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                          <button type="button"
                            onClick={() => kept ? removeExistingImage(img.filename) : setKeepImages(p => [...p, img.filename])}
                            style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: kept ? '#dc2626' : '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {kept ? '×' : '+'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Novas fotos */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>
                  {editing ? 'Adicionar fotos' : 'Fotos (opcional)'}
                </label>
                {previews.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {previews.map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                        <button type="button" onClick={() => removeNewImage(i)}
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button"
                  onClick={() => fileRef.current.click()}
                  style={{ padding: '8px 16px', border: '1px dashed var(--gray-300)', borderRadius: 8, background: 'var(--gray-50)', color: 'var(--gray-600)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-camera" /> Selecionar fotos
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => handleImageFiles(e.target.files)} />
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--gray-100)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading || !form.note.trim()}>
                  <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />
                  {loading ? 'Salvando...' : editing ? 'Salvar alterações' : 'Registrar evolução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, cursor: 'zoom-out', padding: 24 }}>
          <img src={lightbox.src} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
        </div>
      )}
    </div>
  );
}
