import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

// ── Numeração FDI — arcada superior e inferior ────────────────────────────────
const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

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
  const [teeth,    setTeeth]    = useState({});   // { '11': { status, procedure_name, procedure_value, notes }, ... }
  const [selected, setSelected] = useState(null); // tooth number (string)
  const [form,     setForm]     = useState({ status: '', procedure_name: '', procedure_value: '', notes: '' });
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);

  const load = async () => {
    const [p, t] = await Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/odontogram?patient_id=${patientId}`),
    ]);
    setPatient(p.data);
    const map = {};
    t.data.forEach(row => { map[row.tooth_number] = row; });
    setTeeth(map);
  };

  useEffect(() => { load(); }, [patientId]);

  // ── Selecionar dente ─────────────────────────────────────────────────────────
  const selectTooth = (n) => {
    const key  = String(n);
    const data = teeth[key] || {};
    setSelected(key);
    setForm({
      status:          data.status          || '',
      procedure_name:  data.procedure_name  || '',
      procedure_value: data.procedure_value != null ? String(data.procedure_value) : '',
      notes:           data.notes           || '',
    });
    setDirty(false);
  };

  // ── Salvar dente ─────────────────────────────────────────────────────────────
  const saveTooth = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.put(`/odontogram/${patientId}/${selected}`, {
        status:          form.status          || null,
        procedure_name:  form.procedure_name  || null,
        procedure_value: form.procedure_value ? parseFloat(form.procedure_value) : null,
        notes:           form.notes           || null,
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
      setForm({ status: '', procedure_name: '', procedure_value: '', notes: '' });
      setDirty(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao limpar.');
    }
  };

  // ── Plano de tratamento ──────────────────────────────────────────────────────
  const treatmentPlan = Object.entries(teeth)
    .filter(([, t]) => t.procedure_name)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  const total = treatmentPlan.reduce((sum, [, t]) => sum + (parseFloat(t.procedure_value) || 0), 0);

  if (!patient) return <div className="loading"><div className="spinner" /></div>;

  // ── Render dente ─────────────────────────────────────────────────────────────
  const ToothBtn = ({ n }) => {
    const key  = String(n);
    const data = teeth[key] || {};
    const st   = getStatus(data.status);
    const isSel = selected === key;
    const hasProc = !!data.procedure_name;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {/* Número FDI */}
        <span style={{ fontSize: 9, color: isSel ? '#E8841A' : '#9ca3af', fontWeight: isSel ? 700 : 400 }}>{n}</span>
        {/* Dente */}
        <button
          onClick={() => selectTooth(n)}
          title={`Dente ${n}${data.status ? ` — ${st.label}` : ''}${data.procedure_name ? ` | ${data.procedure_name}` : ''}`}
          style={{
            width: toothWidth(n), height: 36,
            borderRadius: n > 30 ? '4px 4px 10px 10px' : '10px 10px 4px 4px', // raíz em cima p/ superior
            border: `2px solid ${isSel ? '#E8841A' : st.border}`,
            background: st.color,
            cursor: 'pointer',
            position: 'relative',
            boxShadow: isSel ? '0 0 0 2px #E8841A44' : '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'all 0.15s',
            outline: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {/* Ponto indicando procedimento planejado */}
          {hasProc && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8841A', boxShadow: '0 0 0 1px #fff' }} />
          )}
          {/* X para ausente */}
          {data.status === 'ausente' && (
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 700 }}>×</span>
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
              {treatmentPlan.length > 0 && (
                <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                  Total: R$ {total.toFixed(2)}
                </span>
              )}
            </div>

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
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatmentPlan.map(([tooth, data]) => {
                      const st = getStatus(data.status);
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
                          <td style={{ fontWeight: 600, color: '#22c55e' }}>
                            {data.procedure_value ? `R$ ${parseFloat(data.procedure_value).toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--gray-50)', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '10px 16px', fontSize: 13 }}>Total do plano</td>
                      <td style={{ padding: '10px 16px', fontSize: 14, color: '#22c55e' }}>
                        R$ {total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna direita: painel de edição ── */}
        <div className="card" style={{ position: 'sticky', top: 80 }}>
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

              {/* Ações */}
              <div style={{ display: 'flex', gap: 8 }}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
