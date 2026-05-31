import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import dayjs from 'dayjs';

// ── SVG Face ─────────────────────────────────────────────────────────────────
const FaceSVG = () => (
  <g>
    <defs>
      <radialGradient id="skinGrad" cx="50%" cy="38%" r="58%">
        <stop offset="0%"   stopColor="#FDEBD0"/>
        <stop offset="55%"  stopColor="#F5CBA7"/>
        <stop offset="100%" stopColor="#D4956A"/>
      </radialGradient>
      <radialGradient id="skinNeck" cx="50%" cy="30%" r="70%">
        <stop offset="0%"   stopColor="#F5CBA7"/>
        <stop offset="100%" stopColor="#C8926A"/>
      </radialGradient>
      <radialGradient id="cheekL" cx="25%" cy="58%" r="38%">
        <stop offset="0%"  stopColor="#F1948A" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#F5CBA7" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="cheekR" cx="75%" cy="58%" r="38%">
        <stop offset="0%"  stopColor="#F1948A" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#F5CBA7" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="irisGrad" cx="35%" cy="35%" r="65%">
        <stop offset="0%"   stopColor="#A9770E"/>
        <stop offset="55%"  stopColor="#6E4C0C"/>
        <stop offset="100%" stopColor="#3B2506"/>
      </radialGradient>
      <linearGradient id="hairGrad" x1="0%" y1="0%" x2="20%" y2="100%">
        <stop offset="0%"   stopColor="#C49A2A"/>
        <stop offset="40%"  stopColor="#9A7D0A"/>
        <stop offset="100%" stopColor="#5C4208"/>
      </linearGradient>
      <linearGradient id="lipTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#B03060"/>
        <stop offset="100%" stopColor="#8B1A40"/>
      </linearGradient>
      <linearGradient id="lipBotGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#D04070"/>
        <stop offset="60%"  stopColor="#B03060"/>
        <stop offset="100%" stopColor="#8B1A40"/>
      </linearGradient>
      <clipPath id="eyeL">
        <path d="M126,200 Q152,181 178,200 Q152,219 126,200Z"/>
      </clipPath>
      <clipPath id="eyeR">
        <path d="M222,200 Q248,181 274,200 Q248,219 222,200Z"/>
      </clipPath>
    </defs>

    {/* ── Pescoço ── */}
    <path d="M176,390 Q168,418 162,448 L238,448 Q232,418 224,390Z"
          fill="url(#skinNeck)" stroke="#C8A882" strokeWidth="1.2"/>
    <path d="M176,390 Q172,418 170,448 L180,448 Q178,418 182,390Z"
          fill="rgba(0,0,0,0.06)"/>

    {/* ── Cabeça ── */}
    <path d="M200,40
             C136,40 62,96 57,192
             C52,268 68,334 105,368
             C136,398 168,412 200,414
             C232,412 264,398 295,368
             C332,334 348,268 343,192
             C338,96 264,40 200,40Z"
          fill="url(#skinGrad)" stroke="#C8A882" strokeWidth="1.5"/>

    {/* ── Sombra lateral face ── */}
    <path d="M57,192 C52,268 68,334 105,368 C80,320 72,268 76,200Z"
          fill="rgba(0,0,0,0.05)"/>
    <path d="M343,192 C348,268 332,334 295,368 C320,320 328,268 324,200Z"
          fill="rgba(0,0,0,0.05)"/>

    {/* ── Orelhas ── */}
    <ellipse cx="57" cy="246" rx="18" ry="27" fill="#F0C095" stroke="#C8A882" strokeWidth="1.5"/>
    <path d="M61,231 Q67,246 61,261" stroke="#B08060" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <ellipse cx="343" cy="246" rx="18" ry="27" fill="#F0C095" stroke="#C8A882" strokeWidth="1.5"/>
    <path d="M339,231 Q333,246 339,261" stroke="#B08060" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

    {/* ── Cabelo ── */}
    <path d="M57,192
             C57,124 82,58 144,42
             C168,35 186,38 200,40
             C214,38 232,35 256,42
             C318,58 343,124 343,192
             C330,148 312,72 278,58
             C254,48 228,50 200,50
             C172,50 146,48 122,58
             C88,72 70,148 57,192Z"
          fill="url(#hairGrad)" stroke="#7A5C10" strokeWidth="1"/>
    {/* Têmporas */}
    <path d="M57,192 C49,218 47,255 54,288 C62,270 66,242 57,192Z" fill="url(#hairGrad)"/>
    <path d="M343,192 C351,218 353,255 346,288 C338,270 334,242 343,192Z" fill="url(#hairGrad)"/>
    {/* Highlight cabelo */}
    <path d="M148,46 Q200,40 252,46 Q200,43 148,46Z"
          fill="rgba(255,230,130,0.35)"/>

    {/* ── Blush ── */}
    <ellipse cx="112" cy="298" rx="46" ry="28" fill="url(#cheekL)"/>
    <ellipse cx="288" cy="298" rx="46" ry="28" fill="url(#cheekR)"/>

    {/* ── Linhas anatômicas guia ── */}
    <line x1="106" y1="118" x2="294" y2="118" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="4,4"/>
    <line x1="92"  y1="143" x2="308" y2="143" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="4,4"/>
    <line x1="84"  y1="163" x2="316" y2="163" stroke="#E0C8A0" strokeWidth="0.8" strokeDasharray="4,4"/>
    <line x1="185" y1="167" x2="185" y2="190" stroke="#E0C8A0" strokeWidth="0.7" strokeDasharray="2,2"/>
    <line x1="215" y1="167" x2="215" y2="190" stroke="#E0C8A0" strokeWidth="0.7" strokeDasharray="2,2"/>
    {/* Pés de galinha */}
    <path d="M176,196 L156,181 M176,202 L153,202 M176,210 L157,220" stroke="#E0C8A0" strokeWidth="0.8" fill="none"/>
    <path d="M224,196 L244,181 M224,202 L247,202 M224,210 L243,220" stroke="#E0C8A0" strokeWidth="0.8" fill="none"/>
    {/* Sulcos nasogenianos */}
    <path d="M167,280 Q156,302 164,324" stroke="#D8C0A0" strokeWidth="1.1" strokeDasharray="3,2" fill="none"/>
    <path d="M233,280 Q244,302 236,324" stroke="#D8C0A0" strokeWidth="1.1" strokeDasharray="3,2" fill="none"/>
    {/* Mandíbula */}
    <path d="M72,272 Q88,334 150,372 Q200,386 250,372 Q312,334 328,272"
          stroke="#E0C8A0" strokeWidth="0.8" fill="none" strokeDasharray="4,3"/>
    {/* Linha central */}
    <line x1="200" y1="76" x2="200" y2="394" stroke="#E8D8C0" strokeWidth="0.6" strokeDasharray="6,4"/>

    {/* ── Sobrancelhas ── */}
    <path d="M126,172 Q148,157 168,159 Q178,160 182,167"
          stroke="#5C3A08" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
    <path d="M126,173 Q148,159 168,161 Q178,162 182,168"
          stroke="#8B6520" strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.5"/>
    <path d="M218,167 Q222,160 232,159 Q252,157 274,172"
          stroke="#5C3A08" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
    <path d="M218,168 Q222,161 232,161 Q252,159 274,173"
          stroke="#8B6520" strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.5"/>

    {/* ── Olho esquerdo ── */}
    {/* Branco */}
    <path d="M126,200 Q152,181 178,200 Q152,219 126,200Z" fill="white" stroke="#B09878" strokeWidth="1"/>
    {/* Íris */}
    <circle cx="152" cy="200" r="11.5" fill="url(#irisGrad)" clipPath="url(#eyeL)"/>
    {/* Pupila */}
    <circle cx="152" cy="200" r="6.5" fill="#080808" clipPath="url(#eyeL)"/>
    {/* Reflexo principal */}
    <circle cx="155.5" cy="196.5" r="2.8" fill="white" clipPath="url(#eyeL)"/>
    {/* Reflexo secundário */}
    <circle cx="148" cy="204" r="1.2" fill="rgba(255,255,255,0.55)" clipPath="url(#eyeL)"/>
    {/* Pálpebra superior */}
    <path d="M126,200 Q152,181 178,200" stroke="#3A2008" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    {/* Prega palpebral */}
    <path d="M130,197 Q152,185 174,197" stroke="#C0906A" strokeWidth="0.9" fill="none"/>
    {/* Cílios */}
    <path d="M128,198 L124,192 M136,189 L133,183 M146,185 L146,178 M157,185 L159,178 M167,188 L170,182 M176,195 L181,190"
          stroke="#1A0A02" strokeWidth="1.3" strokeLinecap="round"/>

    {/* ── Olho direito ── */}
    <path d="M222,200 Q248,181 274,200 Q248,219 222,200Z" fill="white" stroke="#B09878" strokeWidth="1"/>
    <circle cx="248" cy="200" r="11.5" fill="url(#irisGrad)" clipPath="url(#eyeR)"/>
    <circle cx="248" cy="200" r="6.5" fill="#080808" clipPath="url(#eyeR)"/>
    <circle cx="251.5" cy="196.5" r="2.8" fill="white" clipPath="url(#eyeR)"/>
    <circle cx="244" cy="204" r="1.2" fill="rgba(255,255,255,0.55)" clipPath="url(#eyeR)"/>
    <path d="M222,200 Q248,181 274,200" stroke="#3A2008" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    <path d="M226,197 Q248,185 270,197" stroke="#C0906A" strokeWidth="0.9" fill="none"/>
    <path d="M224,198 L220,192 M232,189 L229,183 M242,185 L242,178 M253,185 L255,178 M263,188 L266,182 M272,195 L277,190"
          stroke="#1A0A02" strokeWidth="1.3" strokeLinecap="round"/>

    {/* ── Nariz ── */}
    {/* Ponte / dorso */}
    <path d="M196,182 Q192,220 188,250 Q185,262 183,272" stroke="#C8A882" strokeWidth="1" fill="none"/>
    <path d="M204,182 Q208,220 212,250 Q215,262 217,272" stroke="#C8A882" strokeWidth="1" fill="none"/>
    {/* Sombra lateral nariz */}
    <path d="M185,240 Q180,258 181,272 Q190,280 200,278" fill="rgba(0,0,0,0.07)" stroke="none"/>
    <path d="M215,240 Q220,258 219,272 Q210,280 200,278" fill="rgba(0,0,0,0.07)" stroke="none"/>
    {/* Asa nasal */}
    <path d="M183,272 Q178,284 175,282 Q182,270 200,270 Q218,270 225,282 Q222,284 217,272Z"
          fill="#EEC098" stroke="#C8A882" strokeWidth="1.2"/>
    {/* Narinas */}
    <path d="M177,276 Q174,283 178,287" stroke="#A07858" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <path d="M223,276 Q226,283 222,287" stroke="#A07858" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    {/* Highlight ponte */}
    <line x1="200" y1="186" x2="200" y2="265" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" strokeLinecap="round"/>

    {/* ── Lábios ── */}
    {/* Filtro labial */}
    <path d="M192,295 Q196,287 200,287 Q204,287 208,295" stroke="#C0A090" strokeWidth="0.9" fill="none"/>
    {/* Sombra acima */}
    <path d="M166,308 Q182,295 192,301 Q200,297 208,301 Q218,295 234,308 Q217,306 200,305 Q183,306 166,308Z"
          fill="rgba(0,0,0,0.07)"/>
    {/* Lábio superior */}
    <path d="M164,308 Q180,292 192,299 Q200,295 208,299 Q220,292 236,308 Q218,320 200,318 Q182,320 164,308Z"
          fill="url(#lipTopGrad)" stroke="#7B1A38" strokeWidth="1"/>
    {/* Linha arco de cupido */}
    <path d="M164,308 Q180,292 192,299 Q200,295 208,299 Q220,292 236,308"
          stroke="#6A1530" strokeWidth="0.9" fill="none"/>
    {/* Lábio inferior */}
    <path d="M164,308 Q178,344 200,348 Q222,344 236,308 Q218,320 200,318 Q182,320 164,308Z"
          fill="url(#lipBotGrad)" stroke="#7B1A38" strokeWidth="1"/>
    {/* Highlight lábio inferior */}
    <path d="M181,332 Q200,340 219,332" stroke="rgba(255,160,170,0.65)" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {/* Linha do meio */}
    <path d="M164,308 Q200,312 236,308" stroke="#7B1A38" strokeWidth="0.7" fill="none"/>
    {/* Comissuras */}
    <ellipse cx="164" cy="308" rx="2.5" ry="2" fill="#8B2040"/>
    <ellipse cx="236" cy="308" rx="2.5" ry="2" fill="#8B2040"/>

    {/* ── Queixo ── */}
    <path d="M172,374 Q200,394 228,374" stroke="#C8A882" strokeWidth="1" fill="none"/>
    <ellipse cx="200" cy="396" rx="20" ry="8" fill="rgba(0,0,0,0.04)"/>

    {/* ── Labels anatômicos ── */}
    <text x="200" y="102" textAnchor="middle" fontSize="9" fill="#C8A060" fontStyle="italic">Frontal</text>
    <text x="200" y="183" textAnchor="middle" fontSize="8" fill="#C8A060" fontStyle="italic">Glabela</text>
    <text x="98"  y="234" textAnchor="middle" fontSize="8" fill="#C8A060" fontStyle="italic" transform="rotate(-5,98,234)">Orbicular</text>
    <text x="302" y="234" textAnchor="middle" fontSize="8" fill="#C8A060" fontStyle="italic" transform="rotate(5,302,234)">Orbicular</text>
    <text x="106" y="292" textAnchor="middle" fontSize="8" fill="#C8A060" fontStyle="italic">Zigomático</text>
    <text x="294" y="292" textAnchor="middle" fontSize="8" fill="#C8A060" fontStyle="italic">Zigomático</text>
    <text x="200" y="386" textAnchor="middle" fontSize="8" fill="#C8A060" fontStyle="italic">Mentual</text>
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
const PointPopup = ({ point, onSave, onDelete, onClose, idx, t }) => {
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
          <span><i className="fas fa-syringe" style={{ marginRight: 8, color: '#4DB8E8' }}/>{isNew ? t('aesthetics.newPoint') : `${t('aesthetics.pointLabel')} ${idx+1}`}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 18 }}>×</button>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.medication')}</label>
          <input className="form-control" value={med} onChange={e => setMed(e.target.value)}
            placeholder={t('aesthetics.medicationPlaceholder')} autoFocus/>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.quantity')}</label>
            <input className="form-control" type="number" min="0" step="0.5" value={dose}
              onChange={e => setDose(e.target.value)} placeholder="Ex: 4"/>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.unit')}</label>
            <select className="form-control" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="UI">UI</option>
              <option value="ml">ml</option>
              <option value="mg">mg</option>
              <option value="U">U</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.observation')}</label>
          <input className="form-control" value={note} onChange={e => setNote(e.target.value)}
            placeholder={t('aesthetics.observationPlaceholder')}/>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {!isNew && (
            <button className="btn btn-danger btn-sm" onClick={onDelete} style={{ marginRight: 'auto' }}>
              <i className="fas fa-trash"/>
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose}>{t('aesthetics.back')}</button>
          <button className="btn btn-primary" onClick={() => onSave({ medication: med, dose: dose ? parseFloat(dose) : null, unit, note })}>
            {isNew ? t('aesthetics.add') : t('aesthetics.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────────────────────
export default function Aesthetics() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [form, setForm] = useState({ professional_id: '', treatment_date: dayjs().format('YYYY-MM-DD'), product_brand: '', product_lot: '', product_validity: '', total_units: '', observations: '', valor: '' });
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
    setForm({ professional_id: professionals[0]?.id || '', treatment_date: dayjs().format('YYYY-MM-DD'), product_brand: '', product_lot: '', product_validity: '', total_units: '', observations: '', valor: '' });
    setCurrent(null);
    setMode('new');
  };

  const openTreatment = (t) => {
    const pts = Array.isArray(t.points) ? t.points : (typeof t.points === 'string' ? JSON.parse(t.points) : []);
    setPoints(pts);
    setForm({ professional_id: t.professional_id || '', treatment_date: t.treatment_date?.split('T')[0] || '', product_brand: t.product_brand || '', product_lot: t.product_lot || '', product_validity: t.product_validity || '', total_units: t.total_units || '', observations: t.observations || '', valor: t.valor || '' });
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
      const payload = { ...form, patient_id: selectedPatient.id, points, total_units: form.total_units || null, valor: form.valor ? parseFloat(form.valor) : null };
      if (current) await api.put(`/aesthetics/${current.id}`, payload);
      else await api.post('/aesthetics', payload);
      await loadTreatments(selectedPatient.id);
      setMode('list');
    } catch (err) { alert(err.response?.data?.error || t('aesthetics.errorSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('aesthetics.deleteMapping'))) return;
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
            {t('aesthetics.title')}
          </h1>
          <p className="page-subtitle">{t('aesthetics.subtitle')}</p>
        </div>
      </div>

      {/* Seletor de paciente */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.patient')}</label>
            <input className="form-control" placeholder={t('aesthetics.searchPatient')}
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
              <i className="fas fa-plus" style={{ marginRight: 6 }}/>{t('aesthetics.newMapping')}
            </button>
          )}
          {(mode === 'new' || mode === 'view') && (
            <button className="btn btn-outline" onClick={() => setMode('list')}>
              <i className="fas fa-arrow-left" style={{ marginRight: 6 }}/>{t('aesthetics.back')}
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
              <p>{t('aesthetics.noMappings')} {selectedPatient.name}</p>
              <button className="btn btn-primary" onClick={startNew} style={{ marginTop: 12 }}>
                <i className="fas fa-plus" style={{ marginRight: 6 }}/>{t('aesthetics.createFirst')}
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>{t('aesthetics.date')}</th><th>{t('aesthetics.professional')}</th><th>{t('aesthetics.points')}</th><th>{t('aesthetics.product')}</th><th>{t('aesthetics.totalUnits')}</th><th>{t('aesthetics.chargedValue')}</th><th>{t('aesthetics.actions')}</th></tr>
                </thead>
                <tbody>
                  {treatments.map((t, i) => {
                    const pts = Array.isArray(t.points) ? t.points : (typeof t.points === 'string' ? JSON.parse(t.points) : []);
                    return (
                      <tr key={t.id} style={{ background: i%2===0?'#f8f9fa':'white' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{dayjs(t.treatment_date).format('DD/MM/YYYY')}</td>
                        <td style={{ padding: '10px 16px' }}>{t.professional_name || '—'}</td>
                        <td style={{ padding: '10px 16px' }}><span className="badge badge-blue">{pts.length} {t('aesthetics.points')}</span></td>
                        <td style={{ padding: '10px 16px', fontSize: 12 }}>{t.product_brand || '—'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#e91e8c' }}>{t.total_units ? `${t.total_units}` : '—'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e8449' }}>{t.valor ? `R$ ${parseFloat(t.valor).toFixed(2).replace('.',',')}` : '—'}</td>
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
                  {t('aesthetics.facialMapping')} — {selectedPatient.name}
                </span>
                {canEdit && (
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                    {t('aesthetics.clickToAdd')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {mode === 'view' && current && (
                  <button className="btn btn-outline btn-sm" onClick={() => setMode('new')}>
                    <i className="fas fa-pen" style={{ marginRight: 4 }}/>{t('aesthetics.edit')}
                  </button>
                )}
                {canEdit && (
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    <i className="fas fa-save" style={{ marginRight: 4 }}/>{saving ? t('aesthetics.saving') : t('aesthetics.save')}
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
                  {t('aesthetics.markedPoints')}
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
                <i className="fas fa-user-doctor" style={{ marginRight: 6, color: '#4DB8E8' }}/>{t('aesthetics.sessionData')}
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.professional')}</label>
                <select className="form-control" value={form.professional_id} disabled={!canEdit}
                  onChange={e => setForm(p => ({ ...p, professional_id: e.target.value }))}>
                  <option value="">{t('aesthetics.searchPatient')}</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.procedureDate')}</label>
                <input className="form-control" type="date" value={form.treatment_date} disabled={!canEdit}
                  onChange={e => setForm(p => ({ ...p, treatment_date: e.target.value }))}/>
              </div>
            </div>

            {/* Produto */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--gray-700)' }}>
                <i className="fas fa-vial" style={{ marginRight: 6, color: '#e91e8c' }}/>{t('aesthetics.productUsed')}
              </div>
              {[['product_brand', t('aesthetics.productBrand'), t('aesthetics.productBrandPlaceholder')],['product_lot', t('aesthetics.productLot'), ''],['product_validity', t('aesthetics.productValidity'), ''],['total_units', t('aesthetics.totalUnitsLabel'), '']].map(([field, label, ph]) => (
                <div className="form-group" key={field} style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>{label}</label>
                  <input className="form-control" placeholder={ph} value={form[field]} disabled={!canEdit}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}/>
                </div>
              ))}
              {points.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                  {t('aesthetics.appliedUnits')}: <strong style={{ color: '#e91e8c' }}>
                    {points.reduce((s,p) => s + (parseFloat(p.dose)||0), 0).toFixed(1)} UI/ml
                  </strong> {t('aesthetics.inPoints').replace('(s)', '')} {points.length} {t('aesthetics.inPoints')}
                </div>
              )}
            </div>

            {/* Valor cobrado */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--gray-700)' }}>
                <i className="fas fa-circle-dollar-to-slot" style={{ marginRight: 6, color: '#1e8449' }}/>{t('aesthetics.chargedValueLabel')}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>{t('aesthetics.chargedValue')} (R$)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)', fontSize: 13, fontWeight: 600 }}>R$</span>
                  <input className="form-control" type="number" min="0" step="0.01"
                    style={{ paddingLeft: 30 }}
                    placeholder={t('aesthetics.valuePlaceholder')}
                    value={form.valor}
                    disabled={!canEdit}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}/>
                </div>
                {form.valor > 0 && (
                  <div style={{ fontSize: 11, color: '#1e8449', marginTop: 4, fontWeight: 600 }}>
                    <i className="fas fa-check-circle" style={{ marginRight: 4 }}/>
                    {t('aesthetics.includedInStatement')}
                  </div>
                )}
              </div>
            </div>

            {/* Observações */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--gray-700)' }}>
                <i className="fas fa-note-sticky" style={{ marginRight: 6, color: '#f59e0b' }}/>{t('aesthetics.observations')}
              </div>
              <textarea className="form-control" rows={4} value={form.observations} disabled={!canEdit}
                placeholder={t('aesthetics.observationsPlaceholder')}
                onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}/>
            </div>

            {/* Assinatura */}
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ borderTop: '2px solid var(--gray-200)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'center' }}>
                  {t('aesthetics.professionalSignature')}
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
            <p>{t('aesthetics.selectPatientHint')}</p>
          </div>
        </div>
      )}

      {/* Popup ponto */}
      {popup && (
        <PointPopup
          point={popup.point} idx={popup.idx}
          onSave={savePoint}
          onDelete={popup.isNew ? null : deletePoint}
          onClose={() => { setPopup(null); setPendingCoord(null); }}
          t={t}/>
      )}
    </div>
  );
}
