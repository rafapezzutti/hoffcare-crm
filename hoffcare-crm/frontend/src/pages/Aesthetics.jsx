import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

// ── SVG Face ─────────────────────────────────────────────────────────────────
const FaceSVG = () => (
  <g>
    {/* Pescoço */}
    <path d="M172,388 L160,440 L240,440 L228,388" fill="#F5DEB3" stroke="#C8A882" strokeWidth="1.5"/>
    {/* Cabeça */}
    <ellipse cx="200" cy="215" rx="148" ry="178" fill="#FEF0E0" stroke="#C8A882" strokeWidth="2"/>
    {/* Cabelo */}
    <path d="M52,215 C52,100 348,100 348,215 C348,150 320,52 200,52 C80,52 52,150 52,215Z"
          fill="#8B6914" stroke="#7A5C10" strokeWidth="1.5"/>
    {/* Têmporas cabelo */}
    <path d="M52,215 C45,245 48,280 55,295 C65,275 68,255 52,215Z" fill="#8B6914"/>
    <path d="M348,215 C355,245 352,280 345,295 C335,275 332,255 348,215Z" fill="#8B6914"/>
    {/* Orelhas */}
    <ellipse cx="52" cy="245" rx="16" ry="24" fill="#F5DEB3" stroke="#C8A882" strokeWidth="1.5"/>
    <path d="M56,232 Q60,245 56,258" stroke="#C8A882" strokeWidth="1" fill="none"/>
    <ellipse cx="348" cy="245" rx="16" ry="24" fill="#F5DEB3" stroke="#C8A882" strokeWidth="1.5"/>
    <path d="M344,232 Q340,245 344,258" stroke="#C8A882" strokeWidth="1" fill="none"/>

    {/* ── Zona guias (linhas anatômicas muito suaves) ── */}
    {/* Frontal - linhas horizontais */}
    <line x1="100" y1="120" x2="300" y2="120" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="4,4"/>
    <line x1="88"  y1="145" x2="312" y2="145" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="4,4"/>
    <line x1="80"  y1="165" x2="320" y2="165" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="4,4"/>
    {/* Linhas glabela */}
    <line x1="185" y1="168" x2="185" y2="190" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="2,2"/>
    <line x1="215" y1="168" x2="215" y2="190" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="2,2"/>
    {/* Pés de galinha */}
    <path d="M178,196 L158,182 M178,202 L155,202 M178,210 L158,220" stroke="#E8D5B5" strokeWidth="0.8" fill="none"/>
    <path d="M222,196 L242,182 M222,202 L245,202 M222,210 L242,220" stroke="#E8D5B5" strokeWidth="0.8" fill="none"/>
    {/* Sulcos nasogenianos */}
    <path d="M168,278 Q158,300 165,320" stroke="#E0C8A0" strokeWidth="1" strokeDasharray="3,2" fill="none"/>
    <path d="M232,278 Q242,300 235,320" stroke="#E0C8A0" strokeWidth="1" strokeDasharray="3,2" fill="none"/>
    {/* Linha mandíbula */}
    <path d="M68,270 Q82,330 148,368 Q200,380 252,368 Q318,330 332,270"
          stroke="#E0C8A0" strokeWidth="0.8" fill="none" strokeDasharray="4,3"/>

    {/* ── Sobrancelhas ── */}
    <path d="M130,172 Q153,158 178,164" stroke="#6B4510" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M222,164 Q247,158 270,172" stroke="#6B4510" strokeWidth="4" fill="none" strokeLinecap="round"/>

    {/* ── Olhos ── */}
    {/* Olho esquerdo */}
    <path d="M132,200 Q154,183 178,200 Q154,217 132,200Z" fill="white" stroke="#A0856A" strokeWidth="1.5"/>
    <circle cx="155" cy="200" r="10" fill="#5C3A1E"/>
    <circle cx="155" cy="200" r="5.5" fill="#1a1a1a"/>
    <circle cx="158" cy="196" r="2" fill="white"/>
    <path d="M132,200 Q154,183 178,200" stroke="#6B4510" strokeWidth="1.5" fill="none"/>
    {/* Olho direito */}
    <path d="M222,200 Q246,183 268,200 Q246,217 222,200Z" fill="white" stroke="#A0856A" strokeWidth="1.5"/>
    <circle cx="245" cy="200" r="10" fill="#5C3A1E"/>
    <circle cx="245" cy="200" r="5.5" fill="#1a1a1a"/>
    <circle cx="248" cy="196" r="2" fill="white"/>
    <path d="M222,200 Q246,183 268,200" stroke="#6B4510" strokeWidth="1.5" fill="none"/>

    {/* ── Nariz ── */}
    <path d="M200,182 L200,268" stroke="#C8A882" strokeWidth="1.2" fill="none"/>
    <path d="M200,268 Q188,282 175,278 Q185,272 200,268 Q215,272 225,278 Q212,282 200,268Z"
          fill="#F0D5B0" stroke="#C8A882" strokeWidth="1.2"/>
    <path d="M178,268 Q175,275 178,282" stroke="#C8A882" strokeWidth="1.2" fill="none"/>
    <path d="M222,268 Q225,275 222,282" stroke="#C8A882" strokeWidth="1.2" fill="none"/>

    {/* ── Lábios ── */}
    {/* Filtro */}
    <path d="M192,292 Q196,284 200,284 Q204,284 208,292" stroke="#C8A882" strokeWidth="1" fill="none"/>
    {/* Lábio superior */}
    <path d="M163,305 Q178,291 192,298 Q200,294 208,298 Q222,291 237,305
             Q220,316 200,314 Q180,316 163,305Z"
          fill="#D4858A" stroke="#B06070" strokeWidth="1.2"/>
    {/* Arco cupido */}
    <path d="M163,305 Q178,291 192,298 Q200,294 208,298 Q222,291 237,305"
          stroke="#B06070" strokeWidth="1.2" fill="none"/>
    {/* Lábio inferior */}
    <path d="M163,305 Q175,338 200,342 Q225,338 237,305 Q220,316 200,314 Q180,316 163,305Z"
          fill="#C87070" stroke="#B06070" strokeWidth="1.2"/>

    {/* ── Queixo ── */}
    <path d="M168,365 Q200,385 232,365" stroke="#C8A882" strokeWidth="1" fill="none"/>

    {/* Linha central */}
    <line x1="200" y1="80" x2="200" y2="390" stroke="#E8D8C0" strokeWidth="0.6" strokeDasharray="6,4"/>

    {/* ── Marcadores de zona (texto guia muito suave) ── */}
    <text x="200" y="105" textAnchor="middle" fontSize="9" fill="#D0B890" fontStyle="italic">Frontal</text>
    <text x="200" y="182" textAnchor="middle" fontSize="8" fill="#D0B890" fontStyle="italic">Glabela</text>
    <text x="102"  y="230" textAnchor="middle" fontSize="8" fill="#D0B890" fontStyle="italic" transform="rotate(-5,102,230)">Orbicular</text>
    <text x="298"  y="230" textAnchor="middle" fontSize="8" fill="#D0B890" fontStyle="italic" transform="rotate(5,298,230)">Orbicular</text>
    <text x="114"  y="290" textAnchor="middle" fontSize="8" fill="#D0B890" fontStyle="italic">Zigomático</text>
    <text x="286"  y="290" textAnchor="middle" fontSize="8" fill="#D0B890" fontStyle="italic">Zigomático</text>
    <text x="200" y="380" textAnchor="middle" fontSize="8" fill="#D0B890" fontStyle="italic">Mentual</text>
  </g>
);

// ── Marcador X ────────────────────────────────────────────────────────────────
const Marker = ({ point, idx, onClick, selected }) => {
  const cx = (point.x / 100) * 400;
  const cy = (point.y / 100) * 500;
  const color = selected ? '#FF4444' : '#1565C0';
  return (
    <g style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onClick(point, idx); }}>
      <circle cx={cx} cy={cy} r={12} fill="rgba(255,255,255,0.7)" stroke={color} strokeWidth={1.5}/>
      <line x1={cx-6} y1={cy-6} x2={cx+6} y2={cy+6} stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
      <line x1={cx+6} y1={cy-6} x2={cx-6} y2={cy+6} stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
      <text x={cx+9} y={cy-5} fontSize="10" fontWeight="700" fill={color}>{idx+1}</text>
      {point.dose && (
        <text x={cx+9} y={cy+8} fontSize="9" fill={color}>{point.dose}{point.unit||'UI'}</text>
      )}
    </g>
  );
};

// ── Popup de ponto ────────────────────────────────────────────────────────────
const PointPopup = ({ point, onSave, onDelete, onClose, idx }) => {
  const [med, setMed] = useState(point?.medication || '');
  const [dose, setDose] = useState(point?.dose || '');
  const [unit, setUnit] = useState(point?.unit || 'UI');
  const [note, setNote] = useState(point?.note || '');
  const isNew = !point?.medication;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, width: 320,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#1a2535', display: 'flex', justifyContent: 'space-between' }}>
          <span><i className="fas fa-syringe" style={{ marginRight: 8, color: '#4DB8E8' }}/>{isNew ? 'Novo Ponto' : `Ponto ${idx+1}`}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 18 }}>×</button>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: 12 }}>Medicamento / Produto</label>
          <input className="form-control" value={med} onChange={e => setMed(e.target.value)}
            placeholder="Ex: Botox, Dysport, Sculptra..." autoFocus/>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Quantidade</label>
            <input className="form-control" type="number" min="0" step="0.5" value={dose}
              onChange={e => setDose(e.target.value)} placeholder="Ex: 4"/>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Unidade</label>
            <select className="form-control" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="UI">UI</option>
              <option value="ml">ml</option>
              <option value="mg">mg</option>
              <option value="U">U</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: 12 }}>Observação (músculo / local)</label>
          <input className="form-control" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ex: Frontal esquerdo, Orbicular olho..."/>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {!isNew && (
            <button className="btn btn-danger btn-sm" onClick={onDelete} style={{ marginRight: 'auto' }}>
              <i className="fas fa-trash"/>
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave({ medication: med, dose: dose ? parseFloat(dose) : null, unit, note })}>
            {isNew ? 'Adicionar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────────────────────
export default function Aesthetics() {
  const navigate = useNavigate();
  const svgRef = useRef(null);

  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientList, setShowPatientList] = useState(false);

  // Tratamento atual (novo ou editando)
  const [mode, setMode] = useState('list'); // 'list' | 'new' | 'view'
  const [current, setCurrent] = useState(null);
  const [points, setPoints] = useState([]);
  const [form, setForm] = useState({ professional_id: '', treatment_date: dayjs().format('YYYY-MM-DD'), product_brand: '', product_lot: '', product_validity: '', total_units: '', observations: '' });
  const [saving, setSaving] = useState(false);

  // Popup de ponto
  const [popup, setPopup] = useState(null); // { point, idx, isNew, x, y }
  const [pendingCoord, setPendingCoord] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/patients'), api.get('/professionals')]).then(([p, pr]) => {
      setPatients(p.data);
      setProfessionals(pr.data.filter(p => ['medico','dentista'].includes(p.type)));
    });
  }, []);

  const loadTreatments = async (patientId) => {
    if (!patientId) return;
    const res = await api.get(`/aesthetics?patient_id=${patientId}`);
    setTreatments(res.data);
  };

  const selectPatient = (p) => {
    setSelectedPatient(p);
    setPatientSearch(p.name);
    setShowPatientList(false);
    loadTreatments(p.id);
    setMode('list');
  };

  const startNew = () => {
    setPoints([]);
    setForm({ professional_id: professionals[0]?.id || '', treatment_date: dayjs().format('YYYY-MM-DD'), product_brand: '', product_lot: '', product_validity: '', total_units: '', observations: '' });
    setCurrent(null);
    setMode('new');
  };

  const openTreatment = (t) => {
    const pts = Array.isArray(t.points) ? t.points : (typeof t.points === 'string' ? JSON.parse(t.points) : []);
    setPoints(pts);
    setForm({ professional_id: t.professional_id || '', treatment_date: t.treatment_date?.split('T')[0] || '', product_brand: t.product_brand || '', product_lot: t.product_lot || '', product_validity: t.product_validity || '', total_units: t.total_units || '', observations: t.observations || '' });
    setCurrent(t);
    setMode('view');
  };

  // Click no SVG → adicionar ponto
  const handleSvgClick = useCallback((e) => {
    if (mode === 'view') return; // read-only se não estiver editando
    if (popup) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    // Só aceita cliques dentro do rosto (oval aproximado)
    const cx = 50, cy = 43, rx = 37, ry = 35.6;
    const inside = ((x - cx) ** 2) / rx ** 2 + ((y - cy) ** 2) / ry ** 2 <= 1;
    if (!inside) return;
    setPendingCoord({ x, y });
    setPopup({ point: { x, y, medication: '', dose: '', unit: 'UI', note: '' }, idx: points.length, isNew: true });
  }, [mode, popup, points.length]);

  const handleMarkerClick = (point, idx) => {
    if (mode === 'view') {
      setPopup({ point, idx, isNew: false, readOnly: true });
    } else {
      setPopup({ point, idx, isNew: false });
    }
  };

  const savePoint = (data) => {
    if (popup.isNew) {
      setPoints(prev => [...prev, { ...pendingCoord, ...data, id: Date.now() }]);
    } else {
      setPoints(prev => prev.map((p, i) => i === popup.idx ? { ...p, ...data } : p));
    }
    setPopup(null); setPendingCoord(null);
  };

  const deletePoint = () => {
    setPoints(prev => prev.filter((_, i) => i !== popup.idx));
    setPopup(null);
  };

  const handleSave = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    try {
      const payload = { ...form, patient_id: selectedPatient.id, points, total_units: form.total_units || null };
      if (current) await api.put(`/aesthetics/${current.id}`, payload);
      else await api.post('/aesthetics', payload);
      await loadTreatments(selectedPatient.id);
      setMode('list');
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este tratamento?')) return;
    await api.delete(`/aesthetics/${id}`);
    loadTreatments(selectedPatient.id);
    setMode('list');
  };

  const filteredPatients = patients.filter(p =>
    patientSearch === '' || p.name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const totalUnitsCalc = points.reduce((s, p) => s + (parseFloat(p.dose) || 0), 0);
  const isEditing = mode === 'new' || (mode === 'view' && current);
  const canEdit = mode !== 'view';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-star-of-life" style={{ marginRight: 8, color: '#e91e8c' }}/>
            Estética Facial
          </h1>
          <p className="page-subtitle">Mapeamento de procedimentos estéticos e aplicações</p>
        </div>
      </div>

      {/* Seletor de paciente */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <label className="form-label" style={{ fontSize: 12 }}>Paciente</label>
            <input className="form-control" placeholder="Buscar paciente..."
              value={patientSearch}
              onChange={e => { setPatientSearch(e.target.value); setShowPatientList(true); }}
              onFocus={() => setShowPatientList(true)} />
            {showPatientList && patientSearch && (
              <div style={{ position: 'absolute', zIndex: 10, width: '100%', background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, maxHeight: 200, overflowY: 'auto', top: '100%' }}>
                {filteredPatients.slice(0,10).map(p => (
                  <div key={p.id} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--gray-100)' }}
                    onMouseDown={() => selectPatient(p)}>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedPatient && mode === 'list' && (
            <button className="btn btn-primary" onClick={startNew}>
              <i className="fas fa-plus" style={{ marginRight: 6 }}/>Novo Mapeamento
            </button>
          )}
          {(mode === 'new' || mode === 'view') && (
            <button className="btn btn-outline" onClick={() => setMode('list')}>
              <i className="fas fa-arrow-left" style={{ marginRight: 6 }}/>Voltar
            </button>
          )}
        </div>
      </div>

      {/* Lista de tratamentos */}
      {mode === 'list' && selectedPatient && (
        <div className="card">
          {treatments.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-star-of-life"/>
              <p>Nenhum mapeamento estético para {selectedPatient.name}</p>
              <button className="btn btn-primary" onClick={startNew} style={{ marginTop: 12 }}>
                <i className="fas fa-plus" style={{ marginRight: 6 }}/>Criar primeiro mapeamento
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Data</th><th>Profissional</th><th>Pontos</th><th>Produto</th><th>Total UI/ml</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {treatments.map((t, i) => {
                    const pts = Array.isArray(t.points) ? t.points : (typeof t.points === 'string' ? JSON.parse(t.points) : []);
                    return (
                      <tr key={t.id} style={{ background: i%2===0?'#f8f9fa':'white' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{dayjs(t.treatment_date).format('DD/MM/YYYY')}</td>
                        <td style={{ padding: '10px 16px' }}>{t.professional_name || '—'}</td>
                        <td style={{ padding: '10px 16px' }}><span className="badge badge-blue">{pts.length} pontos</span></td>
                        <td style={{ padding: '10px 16px', fontSize: 12 }}>{t.product_brand || '—'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#e91e8c' }}>{t.total_units ? `${t.total_units}` : '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <div className="table-actions">
                            <button className="btn btn-outline btn-sm" onClick={() => openTreatment(t)}><i className="fas fa-eye"/></button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}><i className="fas fa-trash"/></button>
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
      )}

      {/* Mapa facial (novo ou visualização) */}
      {(mode === 'new' || mode === 'view') && selectedPatient && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

          {/* Mapa */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--gray-100)', background: '#fdf0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  <i className="fas fa-map-pin" style={{ marginRight: 6, color: '#e91e8c' }}/>
                  Mapeamento Facial — {selectedPatient.name}
                </span>
                {canEdit && (
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                    Clique no rosto para adicionar um ponto de aplicação
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {mode === 'view' && current && (
                  <button className="btn btn-outline btn-sm" onClick={() => setMode('new')}>
                    <i className="fas fa-pen" style={{ marginRight: 4 }}/>Editar
                  </button>
                )}
                {canEdit && (
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    <i className="fas fa-save" style={{ marginRight: 4 }}/>{saving ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', padding: 20, background: '#fafafa' }}>
              <svg ref={svgRef} viewBox="0 0 400 500"
                style={{
                  width: '100%', maxWidth: 420, height: 'auto',
                  cursor: canEdit ? 'crosshair' : 'default',
                  filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.1))',
                  borderRadius: 8,
                }}
                onClick={handleSvgClick}>
                <FaceSVG />
                {points.map((pt, idx) => (
                  <Marker key={pt.id || idx} point={pt} idx={idx}
                    onClick={handleMarkerClick}
                    selected={popup?.idx === idx} />
                ))}
              </svg>
            </div>

            {/* Legenda */}
            {points.length > 0 && (
              <div style={{ borderTop: '1px solid var(--gray-100)', padding: '10px 18px', background: 'white' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Pontos marcados
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {points.map((pt, i) => (
                    <div key={i} style={{ fontSize: 11, background: '#EBF5FB', borderRadius: 6, padding: '3px 8px', border: '1px solid #AED6F1', cursor: 'pointer' }}
                      onClick={() => handleMarkerClick(pt, i)}>
                      <strong style={{ color: '#1565C0' }}>{i+1}</strong>
                      {pt.medication && ` · ${pt.medication}`}
                      {pt.dose && ` ${pt.dose}${pt.unit||'UI'}`}
                      {pt.note && ` (${pt.note})`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Painel lateral */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Infos do profissional e data */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--gray-700)' }}>
                <i className="fas fa-user-doctor" style={{ marginRight: 6, color: '#4DB8E8' }}/>Dados da Sessão
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Profissional</label>
                <select className="form-control" value={form.professional_id} disabled={!canEdit}
                  onChange={e => setForm(p => ({ ...p, professional_id: e.target.value }))}>
                  <option value="">Selecionar...</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Data do procedimento</label>
                <input className="form-control" type="date" value={form.treatment_date} disabled={!canEdit}
                  onChange={e => setForm(p => ({ ...p, treatment_date: e.target.value }))}/>
              </div>
            </div>

            {/* Produto */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--gray-700)' }}>
                <i className="fas fa-vial" style={{ marginRight: 6, color: '#e91e8c' }}/>Produto Utilizado
              </div>
              {[['product_brand','Marca / Produto','Ex: Botox Allergan'],['product_lot','Lote/Série',''],['product_validity','Validade',''],['total_units','Total UI/ml','']].map(([field, label, ph]) => (
                <div className="form-group" key={field} style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>{label}</label>
                  <input className="form-control" placeholder={ph} value={form[field]} disabled={!canEdit}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}/>
                </div>
              ))}
              {points.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                  Aplicado: <strong style={{ color: '#e91e8c' }}>
                    {points.reduce((s,p) => s + (parseFloat(p.dose)||0), 0).toFixed(1)} UI/ml
                  </strong> em {points.length} ponto(s)
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--gray-700)' }}>
                <i className="fas fa-note-sticky" style={{ marginRight: 6, color: '#f59e0b' }}/>Observações
              </div>
              <textarea className="form-control" rows={4} value={form.observations} disabled={!canEdit}
                placeholder="Reações, recomendações, próxima sessão..."
                onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}/>
            </div>

            {/* Assinatura */}
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ borderTop: '2px solid var(--gray-200)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'center' }}>
                  Assinatura do profissional
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedPatient && (
        <div className="card">
          <div className="empty-state">
            <i className="fas fa-star-of-life" style={{ color: '#e91e8c' }}/>
            <p>Selecione um paciente para iniciar o mapeamento estético</p>
          </div>
        </div>
      )}

      {/* Popup ponto */}
      {popup && (
        <PointPopup
          point={popup.point} idx={popup.idx}
          onSave={savePoint}
          onDelete={popup.isNew ? null : deletePoint}
          onClose={() => { setPopup(null); setPendingCoord(null); }}/>
      )}
    </div>
  );
}
