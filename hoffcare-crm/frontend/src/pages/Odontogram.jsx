import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

// ── Numeração FDI — arcada superior e inferior ────────────────────────────────
const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

// ── Status de pagamento ───────────────────────────────────────────────────────
const PAYMENT_STATUSES = [
  { value: 'pendente', label: 'Pendente', color: '#fff7ed', border: '#fdba74', text: '#7c2d12', badge: 'badge-orange' },
  { value: 'parcial',  label: 'Parcial',  color: '#eff6ff', border: '#93c5fd', text: '#1e40af', badge: 'badge-blue'   },
  { value: 'pago',     label: 'Pago',     color: '#f0fdf4', border: '#86efac', text: '#166534', badge: 'badge-green'  },
];
function getPaymentStatus(val) {
  return PAYMENT_STATUSES.find(p => p.value === (val || 'pendente')) || PAYMENT_STATUSES[0];
}

// ── Status disponíveis ────────────────────────────────────────────────────────
const STATUSES = [
  { value: '',          label: 'Hígido',              color: '#f0fdf4', border: '#86efac', text: '#166534', dot: '#22c55e' },
  { value: 'cariado',   label: 'Cariado',              color: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444' },
  { value: 'restaurado',label: 'Restaurado',           color: '#eff6ff', border: '#93c5fd', text: '#1e40af', dot: '#3b82f6' },
  { value: 'canal',     label: 'Canal / Endodontia',   color: '#faf5ff', border: '#c4b5fd', text: '#5b21b6', dot: '#8b5cf6' },
  { value: 'coroa',     label: 'Coroa / Prótese',      color: '#fefce8', border: '#fde047', text: '#713f12', dot: '#eab308' },
  { value: 'implante',  label: 'Implante',             color: '#ecfdf5', border: '#6ee7b7', text: '#065f46', dot: '#10b981' },
  { value: 'extracao',  label: 'Indicado extração',    color: '#fff7ed', border: '#fdba74', text: '#7c2d12', dot: '#f97316' },
  { value: 'ausente',   label: 'Ausente',              color: '#f9fafb', border: '#d1d5db', text: '#6b7280', dot: '#9ca3af' },
  { value: 'fraturado', label: 'Fraturado',            color: '#fefce8', border: '#fcd34d', text: '#92400e', dot: '#f59e0b' },
];

function getStatus(val) {
  return STATUSES.find(s => s.value === (val || '')) || STATUSES[0];
}

// ── Status de tratamento ─────────────────────────────────────────────────────
const TREATMENT_STATUSES = [
  { value: 'nao_iniciado',          label: 'Não iniciado',              color: '#f9fafb', border: '#d1d5db', text: '#6b7280', dot: '#9ca3af' },
  { value: 'orcamento_apresentado', label: 'Orçamento apresentado',     color: '#faf5ff', border: '#c4b5fd', text: '#5b21b6', dot: '#8b5cf6' },
  { value: 'iniciado',              label: 'Iniciado',                  color: '#eff6ff', border: '#93c5fd', text: '#1e40af', dot: '#3b82f6' },
  { value: 'concluido',             label: 'Concluído',                 color: '#f0fdf4', border: '#86efac', text: '#166534', dot: '#22c55e' },
  { value: 'interrompido',          label: 'Interrompido pelo paciente',color: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444' },
];
function getTreatmentStatus(val) {
  return TREATMENT_STATUSES.find(s => s.value === (val || 'nao_iniciado')) || TREATMENT_STATUSES[0];
}

// ── Status de faces ───────────────────────────────────────────────────────────
const FACE_STATUSES = [
  { value: '',          label: 'Hígida',    bg: '#f9fafb', border: '#e5e7eb' },
  { value: 'cariado',   label: 'Cariado',   bg: '#ef4444', border: '#dc2626' },
  { value: 'restaurado',label: 'Restaurado',bg: '#3b82f6', border: '#2563eb' },
  { value: 'selado',    label: 'Selado',    bg: '#eab308', border: '#ca8a04' },
  { value: 'fraturado', label: 'Fraturado', bg: '#f97316', border: '#ea580c' },
  { value: 'manchado',  label: 'Manchado',  bg: '#a855f7', border: '#9333ea' },
];
function faceColor(val) {
  return FACE_STATUSES.find(f => f.value === (val || '')) || FACE_STATUSES[0];
}

// ── Faces de um dente — diagrama em cruz ─────────────────────────────────────
// Layout:      V
//           M [O] D
//              L
function FaceDiagram({ tooth, facesMap, onFaceClick }) {
  const isMolar = (tooth % 10) >= 4;
  const centerLabel = isMolar ? 'O' : 'I';
  const faces = ['V', 'M', 'O', 'D', 'L'];

  const faceCell = (face) => {
    const fc = faceColor(facesMap[face]);
    const isCenter = face === 'O';
    const size = isCenter ? 32 : 26;
    return (
      <button key={face} onClick={() => onFaceClick(face)}
        title={`Face ${face}${facesMap[face] ? ' — ' + faceColor(facesMap[face]).label : ''}`}
        style={{
          width: size, height: size,
          background: fc.bg, border: `2px solid ${fc.border}`,
          borderRadius: isCenter ? 6 : 4,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, color: facesMap[face] ? '#fff' : '#9ca3af',
          transition: 'all 0.1s',
        }}>
        {face === 'O' ? centerLabel : face}
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '26px 32px 26px', gridTemplateRows: '26px 32px 26px', gap: 3, width: 'fit-content', margin: '0 auto' }}>
      {/* Row 0: V centered */}
      <div />
      {faceCell('V')}
      <div />
      {/* Row 1: M, O, D */}
      {faceCell('M')}
      {faceCell('O')}
      {faceCell('D')}
      {/* Row 2: L centered */}
      <div />
      {faceCell('L')}
      <div />
    </div>
  );
}

// Largura relativa por tipo de dente (incisivos menores, molares maiores)
function toothWidth(n) {
  const d = n % 10;
  if (d === 1 || d === 2) return 28; // incisivos centrais/laterais
  if (d === 3)            return 26; // caninos
  if (d === 4 || d === 5) return 28; // pré-molares
  return 34;                         // molares
}

export default function Odontogram() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();

  const [patient,  setPatient]  = useState(null);
  const [teeth,    setTeeth]    = useState({});
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState({ status: '', procedure_name: '', procedure_value: '', notes: '', payment_status: 'pendente', amount_paid: '', treatment_status: 'nao_iniciado', treatment_date: '' });
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);

  // ── Faces ─────────────────────────────────────────────────────────────────────
  // allFaces: { '11': { V: 'cariado', M: '', ... }, '21': {...}, ... }
  const [allFaces,      setAllFaces]      = useState({});
  const [selectedFace,  setSelectedFace]  = useState(null); // face key clicked
  const [savingFaces,   setSavingFaces]   = useState(false);
  const [pendingFaces,  setPendingFaces]  = useState({}); // local edits before save

  // ── Histórico por dente ───────────────────────────────────────────────────────
  const [history,       setHistory]       = useState([]); // entries for selected tooth
  const [historyForm,   setHistoryForm]   = useState({ procedure_name: '', procedure_date: dayjs().format('YYYY-MM-DD'), professional_name: '', notes: '' });
  const [addingHistory, setAddingHistory] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);

  const load = async () => {
    const [p, t, f] = await Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/odontogram?patient_id=${patientId}`),
      api.get(`/odontogram/${patientId}/faces`).catch(() => ({ data: [] })),
    ]);
    setPatient(p.data);
    const map = {};
    t.data.forEach(row => { map[row.tooth_number] = row; });
    setTeeth(map);
    // organiza faces por dente
    const fmap = {};
    f.data.forEach(row => {
      if (!fmap[row.tooth_number]) fmap[row.tooth_number] = {};
      fmap[row.tooth_number][row.face] = row.status;
    });
    setAllFaces(fmap);
  };

  useEffect(() => { load(); }, [patientId]);

  // ── Selecionar dente ─────────────────────────────────────────────────────────
  const selectTooth = async (n) => {
    const key  = String(n);
    const data = teeth[key] || {};
    setSelected(key);
    setForm({
      status:           data.status           || '',
      procedure_name:   data.procedure_name   || '',
      procedure_value:  data.procedure_value  != null ? String(data.procedure_value) : '',
      notes:            data.notes            || '',
      payment_status:   data.payment_status   || 'pendente',
      amount_paid:      data.amount_paid      != null ? String(data.amount_paid) : '',
      treatment_status: data.treatment_status || 'nao_iniciado',
      treatment_date:   data.treatment_date   ? String(data.treatment_date).slice(0, 10) : '',
    });
    setPendingFaces({ ...(allFaces[key] || {}) });
    setSelectedFace(null);
    setAddingHistory(false);
    setHistoryForm({ procedure_name: '', procedure_date: dayjs().format('YYYY-MM-DD'), professional_name: '', notes: '' });
    setDirty(false);
    // Carrega histórico do dente
    try {
      const res = await api.get(`/odontogram/${patientId}/${key}/history`);
      setHistory(res.data);
    } catch { setHistory([]); }
  };

  // ── Face: clicar para editar ──────────────────────────────────────────────────
  const handleFaceClick = (face) => {
    setSelectedFace(prev => prev === face ? null : face);
  };

  const setFaceStatus = (face, status) => {
    setPendingFaces(prev => ({ ...prev, [face]: status }));
    setDirty(true);
  };

  const saveFaces = async () => {
    if (!selected) return;
    setSavingFaces(true);
    try {
      await api.put(`/odontogram/${patientId}/${selected}/faces`, { faces: pendingFaces });
      setAllFaces(prev => ({ ...prev, [selected]: { ...pendingFaces } }));
      setSelectedFace(null);
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar faces.'); }
    finally { setSavingFaces(false); }
  };

  // ── Histórico: adicionar entrada ──────────────────────────────────────────────
  const handleAddHistory = async (e) => {
    e.preventDefault();
    if (!historyForm.procedure_name.trim()) return;
    setSavingHistory(true);
    try {
      const res = await api.post(`/odontogram/${patientId}/${selected}/history`, historyForm);
      setHistory(prev => [res.data, ...prev]);
      setHistoryForm({ procedure_name: '', procedure_date: dayjs().format('YYYY-MM-DD'), professional_name: '', notes: '' });
      setAddingHistory(false);
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar.'); }
    finally { setSavingHistory(false); }
  };

  const handleDeleteHistory = async (entryId) => {
    if (!confirm('Remover este registro do histórico?')) return;
    try {
      await api.delete(`/odontogram/${patientId}/${selected}/history/${entryId}`);
      setHistory(prev => prev.filter(h => h.id !== entryId));
    } catch { alert('Erro ao excluir.'); }
  };

  // ── Salvar dente ─────────────────────────────────────────────────────────────
  const saveTooth = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.put(`/odontogram/${patientId}/${selected}`, {
        status:           form.status           || null,
        procedure_name:   form.procedure_name   || null,
        procedure_value:  form.procedure_value  ? parseFloat(form.procedure_value) : null,
        notes:            form.notes            || null,
        payment_status:   form.payment_status   || 'pendente',
        amount_paid:      form.amount_paid      ? parseFloat(form.amount_paid) : 0,
        treatment_status: form.treatment_status || 'nao_iniciado',
        treatment_date:   form.treatment_date   || null,
      });
      setTeeth(prev => ({ ...prev, [selected]: res.data }));
      setDirty(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  // ── Limpar dente ─────────────────────────────────────────────────────────────
  const clearTooth = async () => {
    if (!selected) return;
    if (!confirm('Limpar todos os dados deste dente?')) return;
    try {
      await api.delete(`/odontogram/${patientId}/${selected}`);
      setTeeth(prev => { const n = { ...prev }; delete n[selected]; return n; });
      setForm({ status: '', procedure_name: '', procedure_value: '', notes: '', payment_status: 'pendente', amount_paid: '', treatment_status: 'nao_iniciado', treatment_date: '' });
      setDirty(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao limpar.');
    }
  };

  // ── Plano de tratamento + resumo financeiro ──────────────────────────────────
  const treatmentPlan = Object.entries(teeth)
    .filter(([, t]) => t.procedure_name)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  const totalPlano = treatmentPlan.reduce((sum, [, t]) => sum + (parseFloat(t.procedure_value) || 0), 0);
  const totalPago  = treatmentPlan.reduce((sum, [, t]) => {
    if (t.payment_status === 'pago')    return sum + (parseFloat(t.procedure_value) || 0);
    if (t.payment_status === 'parcial') return sum + (parseFloat(t.amount_paid) || 0);
    return sum;
  }, 0);
  const totalPendente = totalPlano - totalPago;

  if (!patient) return <div className="loading"><div className="spinner" /></div>;

  // ── Render dente ─────────────────────────────────────────────────────────────
  const ToothBtn = ({ n }) => {
    const key     = String(n);
    const data    = teeth[key] || {};
    const st      = getStatus(data.status);
    const isSel   = selected === key;
    const hasProc = !!data.procedure_name;
    const tFaces  = allFaces[key] || {};
    const hasFaces = Object.values(tFaces).some(v => v);
    const isUpper  = n < 30;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 9, color: isSel ? '#E8841A' : '#9ca3af', fontWeight: isSel ? 700 : 400 }}>{n}</span>
        <button onClick={() => selectTooth(n)}
          title={`Dente ${n}${data.status ? ` — ${st.label}` : ''}${data.procedure_name ? ` | ${data.procedure_name}` : ''}`}
          style={{
            width: toothWidth(n), height: 36,
            borderRadius: isUpper ? '10px 10px 4px 4px' : '4px 4px 10px 10px',
            border: `2px solid ${isSel ? '#E8841A' : st.border}`,
            background: st.color,
            cursor: 'pointer', position: 'relative',
            boxShadow: isSel ? '0 0 0 2px #E8841A44' : '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'all 0.15s', outline: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {hasProc && !data.status && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8841A', boxShadow: '0 0 0 1px #fff' }} />
          )}
          {data.status === 'ausente' && (
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 700 }}>×</span>
          )}
          {/* Indicador de faces marcadas */}
          {hasFaces && (
            <div style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6' }} />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="page" style={{ padding: '0 0 40px' }}>

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${patientId}`)}>
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">
              <i className="fas fa-tooth" style={{ marginRight: 8, color: '#4DB8E8' }} />
              Odontograma
            </h1>
            <p className="page-subtitle">{patient.name}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* ── Coluna esquerda: diagrama + plano ── */}
        <div>

          {/* Diagrama */}
          <div className="card" style={{ padding: '24px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-600)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-tooth" style={{ color: '#4DB8E8' }} /> Diagrama dental — clique em um dente para editar
            </div>

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {STATUSES.map(s => (
                <span key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gray-600)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  {s.label}
                </span>
              ))}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gray-600)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8841A', flexShrink: 0 }} />
                Procedimento planejado
              </span>
            </div>

            {/* Linha central */}
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: '#9ca3af', width: 40, textAlign: 'right' }}>Direito</span>
                <div style={{ height: 1, width: 100, background: '#e5e7eb' }} />
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>Superior</span>
                <div style={{ height: 1, width: 100, background: '#e5e7eb' }} />
                <span style={{ fontSize: 10, color: '#9ca3af', width: 40 }}>Esquerdo</span>
              </div>
            </div>

            {/* Arcada superior */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 8 }}>
              {UPPER.map(n => <ToothBtn key={n} n={n} />)}
            </div>

            {/* Divisor central */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', justifyContent: 'center' }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb', maxWidth: 280 }} />
              <span style={{ fontSize: 10, color: '#d1d5db', fontWeight: 600 }}>────</span>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb', maxWidth: 280 }} />
            </div>

            {/* Arcada inferior */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 8 }}>
              {LOWER.map(n => <ToothBtn key={n} n={n} />)}
            </div>

            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: '#9ca3af', width: 40, textAlign: 'right' }}>Direito</span>
                <div style={{ height: 1, width: 100, background: '#e5e7eb' }} />
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>Inferior</span>
                <div style={{ height: 1, width: 100, background: '#e5e7eb' }} />
                <span style={{ fontSize: 10, color: '#9ca3af', width: 40 }}>Esquerdo</span>
              </div>
            </div>
          </div>

          {/* Plano de tratamento */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <span className="card-title">
                <i className="fas fa-file-invoice-dollar" style={{ color: '#E8841A', marginRight: 8 }} />
                Plano de Tratamento
              </span>
            </div>

            {/* Resumo financeiro */}
            {treatmentPlan.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, padding: '12px 16px', background: '#f8f9fa', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Total do plano</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)' }}>R$ {totalPlano.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac' }}>
                  <div style={{ fontSize: 11, color: '#166534', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Pago</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>R$ {totalPago.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '12px 16px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fdba74' }}>
                  <div style={{ fontSize: 11, color: '#7c2d12', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Pendente</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ea580c' }}>R$ {totalPendente.toFixed(2)}</div>
                </div>
              </div>
            )}

            {treatmentPlan.length === 0 ? (
              <p style={{ color: 'var(--gray-400)', fontSize: 13, padding: '12px 0' }}>
                Nenhum procedimento planejado. Clique em um dente e adicione um procedimento.
              </p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dente</th>
                      <th>Situação</th>
                      <th>Procedimento</th>
                      <th>Status Trat.</th>
                      <th>Data Trat.</th>
                      <th>Valor</th>
                      <th>Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatmentPlan.map(([tooth, data]) => {
                      const st = getStatus(data.status);
                      const ps = getPaymentStatus(data.payment_status);
                      const ts = getTreatmentStatus(data.treatment_status);
                      return (
                        <tr key={tooth} style={{ cursor: 'pointer' }} onClick={() => selectTooth(parseInt(tooth))}>
                          <td>
                            <span style={{ fontWeight: 700, color: selected === tooth ? '#E8841A' : 'inherit' }}>
                              {tooth}
                            </span>
                          </td>
                          <td>
                            {data.status && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot }} />
                                {st.label}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 13 }}>{data.procedure_name}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ts.color, color: ts.text, border: `1px solid ${ts.border}` }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ts.dot, flexShrink: 0 }} />
                              {ts.label}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                            {data.treatment_date ? dayjs(data.treatment_date).format('DD/MM/YYYY') : '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#22c55e' }}>
                            {data.procedure_value ? `R$ ${parseFloat(data.procedure_value).toFixed(2)}` : '—'}
                          </td>
                          <td>
                            <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ps.color, color: ps.text, border: `1px solid ${ps.border}` }}>
                              {ps.label}
                              {data.payment_status === 'parcial' && data.amount_paid > 0 && (
                                <span style={{ marginLeft: 4, opacity: 0.8 }}>R$ {parseFloat(data.amount_paid).toFixed(2)}</span>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--gray-50)', fontWeight: 700 }}>
                      <td colSpan={6} style={{ padding: '10px 16px', fontSize: 13 }}>Total do plano</td>
                      <td style={{ padding: '10px 16px', fontSize: 14, color: '#22c55e' }}>
                        R$ {totalPlano.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna direita: painel de edição ── */}
        <div className="card" style={{ position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-400)' }}>
              <i className="fas fa-tooth" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
              <p style={{ fontSize: 13 }}>Clique em um dente no diagrama para editar</p>
            </div>
          ) : (
            <div>
              {/* Cabeçalho */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#E8841A' }}>#{selected}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>
                    {(() => {
                      const q = Math.floor(parseInt(selected) / 10);
                      return q === 1 ? 'Superior direito' : q === 2 ? 'Superior esquerdo' : q === 3 ? 'Inferior esquerdo' : 'Inferior direito';
                    })()}
                  </span>
                </div>
                {dirty && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>● não salvo</span>}
              </div>

              {/* Status */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>
                  Situação do dente
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {STATUSES.map(s => (
                    <label key={s.value} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      borderRadius: 8, cursor: 'pointer', border: `1px solid ${form.status === s.value ? s.border : 'transparent'}`,
                      background: form.status === s.value ? s.color : 'transparent',
                      transition: 'all 0.12s',
                    }}>
                      <input type="radio" name="status" value={s.value} checked={form.status === s.value}
                        onChange={() => { setForm(p => ({ ...p, status: s.value })); setDirty(true); }}
                        style={{ display: 'none' }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: s.text, fontWeight: form.status === s.value ? 600 : 400 }}>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Procedimento */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                  Procedimento planejado
                </label>
                <input type="text" className="form-control"
                  placeholder="Ex: Restauração, Canal, Extração..."
                  value={form.procedure_name}
                  onChange={e => { setForm(p => ({ ...p, procedure_name: e.target.value })); setDirty(true); }}
                />
              </div>

              {/* Valor */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                  Valor estimado (R$)
                </label>
                <input type="number" className="form-control" min="0" step="0.01"
                  placeholder="0,00"
                  value={form.procedure_value}
                  onChange={e => { setForm(p => ({ ...p, procedure_value: e.target.value })); setDirty(true); }}
                />
              </div>

              {/* Observação */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                  Observação
                </label>
                <textarea className="form-control" rows={3}
                  placeholder="Observações clínicas livres..."
                  value={form.notes}
                  onChange={e => { setForm(p => ({ ...p, notes: e.target.value })); setDirty(true); }}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Status de tratamento */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>
                  Status do tratamento
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {TREATMENT_STATUSES.map(s => (
                    <label key={s.value} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${form.treatment_status === s.value ? s.border : 'transparent'}`,
                      background: form.treatment_status === s.value ? s.color : 'transparent',
                      transition: 'all 0.12s',
                    }}>
                      <input type="radio" name="treatment_status" value={s.value}
                        checked={form.treatment_status === s.value}
                        onChange={() => { setForm(p => ({ ...p, treatment_status: s.value })); setDirty(true); }}
                        style={{ display: 'none' }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: s.text, fontWeight: form.treatment_status === s.value ? 600 : 400 }}>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Data do tratamento */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                  Data de realização
                </label>
                <input type="date" className="form-control"
                  value={form.treatment_date}
                  onChange={e => { setForm(p => ({ ...p, treatment_date: e.target.value })); setDirty(true); }}
                />
              </div>

              {/* Pagamento — só aparece se há procedimento */}
              {form.procedure_name && (
                <div style={{ marginBottom: 16, padding: '14px', background: '#f8f9fa', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fas fa-dollar-sign" style={{ color: '#22c55e' }} /> Pagamento
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {PAYMENT_STATUSES.map(ps => (
                      <button key={ps.value} type="button"
                        onClick={() => { setForm(p => ({ ...p, payment_status: ps.value })); setDirty(true); }}
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, border: `1px solid ${form.payment_status === ps.value ? ps.border : 'var(--gray-200)'}`,
                          background: form.payment_status === ps.value ? ps.color : '#fff',
                          color: form.payment_status === ps.value ? ps.text : 'var(--gray-500)',
                          fontSize: 11, fontWeight: form.payment_status === ps.value ? 700 : 400,
                          cursor: 'pointer',
                        }}>
                        {ps.label}
                      </button>
                    ))}
                  </div>
                  {form.payment_status === 'parcial' && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Valor já pago (R$)</label>
                      <input type="number" className="form-control" min="0" step="0.01"
                        placeholder="0,00"
                        value={form.amount_paid}
                        onChange={e => { setForm(p => ({ ...p, amount_paid: e.target.value })); setDirty(true); }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Ações do dente */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button className="btn btn-primary" style={{ flex: 1 }}
                  disabled={saving || !dirty} onClick={saveTooth}>
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={clearTooth}
                  title="Limpar dados deste dente" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
                  <i className="fas fa-trash" />
                </button>
              </div>

              {/* ── Faces do dente ── */}
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)' }}>
                    <i className="fas fa-border-all" style={{ marginRight: 6, color: '#8b5cf6' }} />Faces do dente
                  </span>
                  <button className="btn btn-primary btn-sm"
                    disabled={savingFaces} onClick={saveFaces}
                    style={{ fontSize: 11, padding: '3px 10px' }}>
                    {savingFaces ? '...' : 'Salvar faces'}
                  </button>
                </div>

                <FaceDiagram
                  tooth={parseInt(selected)}
                  facesMap={pendingFaces}
                  onFaceClick={handleFaceClick}
                />

                {/* Seletor de status da face clicada */}
                {selectedFace && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>
                      Face {selectedFace} — selecione o status:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {FACE_STATUSES.map(fs => (
                        <button key={fs.value} onClick={() => setFaceStatus(selectedFace, fs.value)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                            border: `1px solid ${fs.border}`,
                            background: pendingFaces[selectedFace] === fs.value ? fs.bg : '#fff',
                            color: pendingFaces[selectedFace] === fs.value && fs.value ? '#fff' : 'var(--gray-700)',
                            fontWeight: pendingFaces[selectedFace] === fs.value ? 700 : 400,
                          }}>
                          {fs.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legenda */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {FACE_STATUSES.filter(f => f.value).map(fs => (
                    <span key={fs.value} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--gray-500)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: fs.bg, border: `1px solid ${fs.border}`, display: 'inline-block' }} />
                      {fs.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Histórico de procedimentos ── */}
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)' }}>
                    <i className="fas fa-clock-rotate-left" style={{ marginRight: 6, color: '#E8841A' }} />Histórico
                  </span>
                  <button onClick={() => setAddingHistory(o => !o)}
                    style={{ padding: '3px 10px', border: '1px solid #E8841A', borderRadius: 6, background: '#fff7ed', color: '#92400e', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {addingHistory ? 'Cancelar' : '+ Adicionar'}
                  </button>
                </div>

                {/* Formulário de novo registro */}
                {addingHistory && (
                  <form onSubmit={handleAddHistory} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="form-control" style={{ fontSize: 12 }}
                      placeholder="Procedimento realizado *"
                      value={historyForm.procedure_name}
                      onChange={e => setHistoryForm(p => ({ ...p, procedure_name: e.target.value }))}
                      required />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input type="date" className="form-control" style={{ fontSize: 12 }}
                        value={historyForm.procedure_date}
                        onChange={e => setHistoryForm(p => ({ ...p, procedure_date: e.target.value }))} />
                      <input className="form-control" style={{ fontSize: 12 }}
                        placeholder="Profissional"
                        value={historyForm.professional_name}
                        onChange={e => setHistoryForm(p => ({ ...p, professional_name: e.target.value }))} />
                    </div>
                    <textarea className="form-control" rows={2} style={{ fontSize: 12, resize: 'vertical' }}
                      placeholder="Observações (opcional)"
                      value={historyForm.notes}
                      onChange={e => setHistoryForm(p => ({ ...p, notes: e.target.value }))} />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={savingHistory}>
                      {savingHistory ? 'Salvando...' : 'Salvar no histórico'}
                    </button>
                  </form>
                )}

                {/* Lista de histórico */}
                {history.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>Nenhum procedimento registrado neste dente.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.map(h => (
                      <div key={h.id} style={{ padding: '8px 10px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray-800)' }}>{h.procedure_name}</span>
                          <button onClick={() => handleDeleteHistory(h.id)}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                          {dayjs(h.procedure_date).format('DD/MM/YYYY')}
                          {h.professional_name && ` · ${h.professional_name}`}
                        </div>
                        {h.notes && <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{h.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
