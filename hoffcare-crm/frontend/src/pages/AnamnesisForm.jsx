import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

export default function AnamnesisForm() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [responses, setResponses] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/anamnesis/form/${token}`).then(r => {
      setData(r.data);
      if (r.data.completed) setSubmitted(true);
    }).catch(() => setError('Link inválido ou expirado.')).finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/anamnesis/form/${token}`, { responses });
      setSubmitted(true);
    } catch (err) { setError(err.response?.data?.error || 'Erro ao enviar'); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ maxWidth:640, width:'100%', background:'#fff', borderRadius:16, padding:40, boxShadow:'0 8px 32px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🏥</div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1a2535', marginBottom:4 }}>
            {data?.clinic_name || 'P. Soluções para Saúde'}
          </h1>
          <p style={{ color:'#64748b', fontSize:14 }}>Anamnese Digital</p>
        </div>

        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:16, color:'#dc2626', marginBottom:24 }}>
            <i className="fas fa-circle-exclamation" style={{ marginRight:8 }} />{error}
          </div>
        )}

        {submitted ? (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Anamnese enviada!</h2>
            <p style={{ color:'#64748b' }}>Obrigado, {data?.patient_name}. Suas respostas foram registradas com sucesso.</p>
          </div>
        ) : data && (
          <form onSubmit={handleSubmit}>
            <p style={{ marginBottom:24, color:'#475569', fontSize:14 }}>
              Olá, <strong>{data.patient_name}</strong>! Por favor, responda as perguntas abaixo antes da sua consulta.
            </p>

            {(data.custom_questions || []).map((q, i) => (
              <div key={i} style={{ marginBottom:20, padding:'16px 20px', border:'1px solid #e2e8f0', borderRadius:10 }}>
                <label style={{ display:'block', fontWeight:600, marginBottom:12, color:'#1e293b', fontSize:14 }}>
                  {i+1}. {q}
                </label>
                <div style={{ display:'flex', gap:16 }}>
                  {['Sim', 'Não', 'Não sei'].map(opt => (
                    <label key={opt} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:14 }}>
                      <input type="radio" name={`q_${i}`} value={opt}
                        checked={responses[i] === opt}
                        onChange={() => setResponses(p => ({ ...p, [i]: opt }))} />
                      {opt}
                    </label>
                  ))}
                </div>
                {(responses[i] === 'Sim') && (
                  <textarea placeholder="Descreva mais detalhes (opcional)..." rows={2}
                    style={{ width:'100%', marginTop:10, padding:'8px 12px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:13, resize:'vertical' }}
                    value={responses[`${i}_detail`] || ''}
                    onChange={e => setResponses(p => ({ ...p, [`${i}_detail`]: e.target.value }))} />
                )}
              </div>
            ))}

            <div style={{ marginTop:8, marginBottom:24 }}>
              <label style={{ display:'block', fontWeight:600, marginBottom:8, color:'#1e293b', fontSize:14 }}>
                Observações adicionais
              </label>
              <textarea placeholder="Alguma informação que queira compartilhar com o profissional?" rows={3}
                style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:14, resize:'vertical' }}
                value={responses['observacoes'] || ''}
                onChange={e => setResponses(p => ({ ...p, observacoes: e.target.value }))} />
            </div>

            <button type="submit" disabled={submitting}
              style={{ width:'100%', padding:'14px', background:'#4DB8E8', color:'#fff', border:'none', borderRadius:8,
                fontSize:16, fontWeight:700, cursor:'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Enviando...' : 'Enviar Anamnese'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
