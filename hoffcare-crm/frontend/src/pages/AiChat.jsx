import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/**
 * AiChat — Talk to Me
 * Chat com Gemini: texto, imagens e áudio.
 * Rate limit: 20 chamadas/dia, 2 imagens/dia (reset meia-noite SP).
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const DISCLAIMER = `⚠️ Aviso Legal & LGPD — leia antes de usar este assistente.`;

const DISCLAIMER_FULL = `RESPONSABILIDADE: As respostas geradas por este assistente são meramente informativas e de responsabilidade exclusiva do profissional de saúde que as utiliza. A P. Soluções atua exclusivamente como intermediária tecnológica, não possui qualquer responsabilidade pelo conteúdo gerado, e não pratica medicina, odontologia ou qualquer atividade regulamentada pelo Conselho Federal de Medicina (CFM), CFO ou afins. As informações não substituem o julgamento clínico, a avaliação presencial nem o prontuário oficial do paciente.

FONTE DE DADOS: Este assistente utiliza o Google Gemini (Google LLC) como modelo de linguagem. O conteúdo das mensagens pode ser processado pelos servidores do Google conforme os Termos de Uso e a Política de Privacidade do Google Gemini. A P. Soluções não armazena o conteúdo das conversas.

LGPD (Lei 13.709/2018): Não insira neste chat dados pessoais sensíveis de pacientes, como nome completo, CPF, diagnósticos, resultados de exames ou qualquer informação que permita identificar individualmente um paciente. O profissional de saúde é o controlador dos dados de seus pacientes e é responsável pelo cumprimento da LGPD. A P. Soluções é operadora tecnológica e adota as medidas de segurança cabíveis, mas não pode garantir conformidade total quando dados são inseridos voluntariamente pelo usuário neste campo de texto livre.

Ao utilizar o Talk to Me, o profissional declara estar ciente e de acordo com os termos acima.`;

export default function AiChat() {
  const navigate  = useNavigate();
  const bottomRef = useRef();
  const fileRef   = useRef();
  const mediaRef  = useRef(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const [messages,  setMessages]  = useState([]);   // { role, text, images?, audio?, action?, error? }
  const [input,     setInput]     = useState('');
  const [images,    setImages]    = useState([]);   // [{ file, preview, mimeType, data }]
  const [loading,   setLoading]   = useState(false);
  const [recording, setRecording] = useState(false);
  const [usage,     setUsage]     = useState(null); // { call_count, calls_remaining, images_remaining, ... }
  const [error,     setError]     = useState(null);

  // ── Carrega uso do dia ao montar ─────────────────────────────────────────────
  useEffect(() => {
    api.get('/ai/usage').then(r => setUsage(r.data)).catch(() => {});
  }, []);

  // ── Scroll automático ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Imagens ──────────────────────────────────────────────────────────────────
  const handleImageFiles = async (files) => {
    setError(null);
    const remaining = usage?.images_remaining ?? 2;
    const toAdd = [...files].slice(0, remaining);

    if (toAdd.length === 0) {
      setError('Limite diário de imagens atingido (2/dia).');
      return;
    }

    const processed = await Promise.all(toAdd.map(async (file) => {
      if (file.size > MAX_IMAGE_SIZE) return null;
      const data = await fileToBase64(file);
      return { file, preview: URL.createObjectURL(file), mimeType: file.type, data };
    }));

    setImages(prev => [...prev, ...processed.filter(Boolean)].slice(0, 2));
  };

  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i));

  const fileToBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.readAsDataURL(file);
  });

  // ── Gravação de áudio via Web Speech API (funciona no Safari, Chrome, Edge) ──
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Seu browser não suporta reconhecimento de voz. Use Chrome ou Safari.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart  = () => setRecording(true);
    recognition.onend    = () => setRecording(false);
    recognition.onerror  = (e) => {
      setRecording(false);
      if (e.error !== 'no-speech') setError('Erro no reconhecimento de voz: ' + e.error);
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (transcript?.trim()) sendMessage({ text: transcript });
    };

    mediaRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const blobToBase64 = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });

  // ── Envio de mensagem ────────────────────────────────────────────────────────
  const sendMessage = async ({ text, audioData, audioMime } = {}) => {
    const msgText   = text ?? input.trim();
    const hasImages = images.length > 0;
    const hasAudio  = !!audioData;

    if (!msgText && !hasImages && !hasAudio) return;

    setError(null);
    setLoading(true);

    const userMsg = {
      role:   'user',
      text:   hasAudio ? '🎙️ [Áudio enviado]' : msgText,
      images: hasImages ? images.map(img => ({ mimeType: img.mimeType, data: img.data })) : undefined,
      audio:  hasAudio  ? { mimeType: audioMime, data: audioData } : undefined,
      previews: hasImages ? images.map(img => img.preview) : undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setImages([]);

    // Monta histórico para API (sem previews)
    const history = newMessages.map(m => ({
      role:   m.role,
      text:   m.role === 'user' && m.audio ? '' : (m.text || ''),
      images: m.images,
      audio:  m.audio,
    }));

    try {
      const res = await api.post('/ai/chat', { history });
      const { message, action, usage: updatedUsage } = res.data;

      setMessages(prev => [...prev, { role: 'model', text: message, action }]);
      if (updatedUsage) setUsage(updatedUsage);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao processar mensagem.';
      setMessages(prev => [...prev, { role: 'model', text: msg, error: true }]);
      if (err.response?.data?.usage) setUsage(err.response.data.usage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage({ text: input }); }
  };

  // ── Ação da IA ───────────────────────────────────────────────────────────────
  const handleAction = (action) => {
    if (!action) return;
    switch (action.type) {
      case 'patient_new': {
        const params = new URLSearchParams();
        if (action.prefill) {
          Object.entries(action.prefill).forEach(([k, v]) => { if (v) params.set(k, v); });
        }
        navigate(`/patients/new${params.toString() ? '?' + params.toString() : ''}`);
        break;
      }
      case 'patient_search':
        navigate(`/patients?search=${encodeURIComponent(action.query || '')}`);
        break;
      case 'record_new': {
        const params = action.patient_name ? `?patient_name=${encodeURIComponent(action.patient_name)}` : '';
        navigate(`/records/new${params}`);
        break;
      }
      case 'navigate':
        navigate(action.path || '/');
        break;
      default:
        break;
    }
  };

  // ── Estilos ───────────────────────────────────────────────────────────────────
  const callsLeft  = usage?.calls_remaining  ?? '—';
  const imagesLeft = usage?.images_remaining ?? '—';
  const limitReached = usage && usage.calls_remaining <= 0;

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', padding: 0 }}>

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #E8841A, #4DB8E8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🤖
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Talk to Me</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Assistente IA — HoffCare</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--gray-500)' }}>
          <span title="Usos restantes hoje">💬 {callsLeft} / 20 usos</span>
          <span title="Imagens restantes hoje">🖼️ {imagesLeft} / 2 imagens</span>
        </div>
      </div>

      {/* Banner de Disclaimer */}
      <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
              <strong>Aviso Legal & LGPD:</strong> As respostas são de responsabilidade exclusiva do profissional de saúde.
              A P. Soluções é intermediária tecnológica (Google Gemini) e não se responsabiliza pelo conteúdo gerado.
              <strong> Não insira dados pessoais de pacientes neste chat.</strong>
            </span>
            {' '}
            <button onClick={() => setDisclaimerOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: '#b45309', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              {disclaimerOpen ? 'Ver menos' : 'Ver completo'}
            </button>
          </div>
        </div>
        {disclaimerOpen && (
          <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#78350f', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {DISCLAIMER_FULL}
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, background: '#f8f9fa' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--gray-400)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Olá! Como posso ajudar?</div>
            <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Pergunte sobre procedimentos, peça para criar ou buscar um paciente, criar um prontuário, ou tire qualquer dúvida clínica e administrativa.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
              {['Criar novo paciente João Silva', 'Buscar paciente Maria', 'Novo prontuário', 'Ir para agenda'].map(q => (
                <button key={q} onClick={() => sendMessage({ text: q })}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--gray-200)', background: '#fff', fontSize: 12, cursor: 'pointer', color: 'var(--gray-600)' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
            {msg.role === 'model' && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #E8841A, #4DB8E8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                🤖
              </div>
            )}
            <div style={{ maxWidth: '70%' }}>
              {/* Imagens da mensagem do usuário */}
              {msg.previews?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, justifyContent: 'flex-end' }}>
                  {msg.previews.map((src, j) => (
                    <img key={j} src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
                  ))}
                </div>
              )}
              {/* Balão de texto */}
              <div style={{
                padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user' ? '#E8841A' : msg.error ? '#fff3cd' : '#fff',
                color: msg.role === 'user' ? '#fff' : msg.error ? '#856404' : 'var(--gray-800)',
                fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.text}
              </div>
              {/* Card de ação */}
              {msg.action && (
                <div style={{ marginTop: 8, background: '#fff', border: '1px solid #4DB8E844', borderRadius: 10, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Ação sugerida</div>
                  <button onClick={() => handleAction(msg.action)}
                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#4DB8E8', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{actionIcon(msg.action.type)}</span>
                    {msg.action.label || 'Executar ação'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #E8841A, #4DB8E8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '4px 16px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: 20, letterSpacing: 2 }}>
              <span style={{ animation: 'pulse 1.2s infinite' }}>•••</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Preview de imagens pendentes */}
      {images.length > 0 && (
        <div style={{ padding: '8px 24px', background: '#fff', borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 8 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={img.preview} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
              <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{ padding: '8px 24px', background: '#fff3cd', color: '#856404', fontSize: 13, borderTop: '1px solid #ffc107' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>

        {/* Imagem */}
        <button onClick={() => fileRef.current.click()} disabled={limitReached || (usage?.images_remaining <= 0)}
          title={`Enviar imagem (${imagesLeft} restante${imagesLeft !== 1 ? 's' : ''} hoje)`}
          style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--gray-200)', background: '#f8f9fa', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: usage?.images_remaining <= 0 ? 0.4 : 1 }}>
          🖼️
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImageFiles(e.target.files)} />

        {/* Áudio */}
        <button onClick={recording ? stopRecording : startRecording} disabled={limitReached}
          title={recording ? 'Parar gravação' : 'Gravar áudio'}
          style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${recording ? '#dc3545' : 'var(--gray-200)'}`, background: recording ? '#ffebee' : '#f8f9fa', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: recording ? 'pulse 1s infinite' : 'none' }}>
          {recording ? '⏹️' : '🎙️'}
        </button>

        {/* Textarea */}
        <textarea
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={limitReached || loading}
          placeholder={
            limitReached
              ? 'Limite diário atingido. Retorna amanhã! 🌅'
              : recording
              ? 'Gravando áudio... clique ⏹️ para enviar'
              : 'Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)'
          }
          style={{
            flex: 1, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 120, overflowY: 'auto',
            opacity: limitReached ? 0.5 : 1,
          }}
        />

        {/* Enviar */}
        <button onClick={() => sendMessage({ text: input })} disabled={(!input.trim() && images.length === 0) || limitReached || loading}
          style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: '#E8841A', color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (!input.trim() && images.length === 0) || limitReached || loading ? 0.4 : 1 }}>
          ➤
        </button>
      </div>
    </div>
  );
}

function actionIcon(type) {
  return { patient_new: '👤', patient_search: '🔍', record_new: '📋', navigate: '→' }[type] || '→';
}
