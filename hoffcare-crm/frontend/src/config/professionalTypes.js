/**
 * Configuração central de tipos de profissionais de saúde.
 * Importar este arquivo em qualquer componente que precise de tipos, labels, cores ou siglas de conselho.
 */

export const PROF_TYPES = [
  { value: 'medico',                label: 'Médico',                short: 'Médico',      emoji: '🩺', color: '#E8841A', bg: 'rgba(232,132,26,0.12)',   border: '#E8841A', council: 'CRM' },
  { value: 'dentista',              label: 'Dentista',              short: 'Dentista',    emoji: '🦷', color: '#4DB8E8', bg: 'rgba(77,184,232,0.12)',   border: '#4DB8E8', council: 'CRO' },
  { value: 'fisioterapeuta',        label: 'Fisioterapeuta',        short: 'Fisio.',      emoji: '🏃', color: '#28a745', bg: 'rgba(40,167,69,0.12)',    border: '#28a745', council: 'CREFITO' },
  { value: 'psicologo',             label: 'Psicólogo',             short: 'Psicol.',     emoji: '🧠', color: '#6f42c1', bg: 'rgba(111,66,193,0.12)',  border: '#6f42c1', council: 'CRP' },
  { value: 'nutricionista',         label: 'Nutricionista',         short: 'Nutri.',      emoji: '🥗', color: '#20c997', bg: 'rgba(32,201,151,0.12)',  border: '#20c997', council: 'CRN' },
  { value: 'fonoaudiologo',         label: 'Fonoaudiólogo',         short: 'Fono.',       emoji: '🗣️', color: '#fd7e14', bg: 'rgba(253,126,20,0.12)',  border: '#fd7e14', council: 'CRFa' },
  { value: 'terapeuta_ocupacional', label: 'Terapeuta Ocupacional', short: 'T.O.',        emoji: '🖐️', color: '#17a2b8', bg: 'rgba(23,162,184,0.12)',  border: '#17a2b8', council: 'CREFITO' },
  { value: 'enfermeiro',            label: 'Enfermeiro',            short: 'Enf.',        emoji: '💉', color: '#dc3545', bg: 'rgba(220,53,69,0.12)',   border: '#dc3545', council: 'COREN' },
  { value: 'biomedico',             label: 'Biomédico',             short: 'Biomed.',     emoji: '🔬', color: '#6c757d', bg: 'rgba(108,117,125,0.12)', border: '#6c757d', council: 'CFBM' },
  { value: 'farmaceutico',          label: 'Farmacêutico',          short: 'Farm.',       emoji: '💊', color: '#0069d9', bg: 'rgba(0,105,217,0.12)',   border: '#0069d9', council: 'CRF' },
  { value: 'quiropraxista',         label: 'Quiropraxista',         short: 'Quiro.',      emoji: '🦴', color: '#795548', bg: 'rgba(121,85,72,0.12)',   border: '#795548', council: 'CRQ' },
  { value: 'esteticista',           label: 'Esteticista',           short: 'Estétic.',    emoji: '💆', color: '#e91e8c', bg: 'rgba(233,30,140,0.12)',  border: '#e91e8c', council: 'Reg.' },
];

// Lookup rápido por value: profTypeMap['medico'] → { label, color, ... }
export const profTypeMap = Object.fromEntries(PROF_TYPES.map(t => [t.value, t]));

// Fallback seguro para tipos desconhecidos / legados
export const getProfType = (value) =>
  profTypeMap[value] ||
  profTypeMap['odontologico'] || // alias legado
  { value, label: value, short: value, emoji: '👤', color: '#6c757d', bg: 'rgba(108,117,125,0.12)', border: '#6c757d', council: 'Reg.' };

// Badge inline para usar em qualquer lugar
export function ProfBadge({ type, style }) {
  const t = getProfType(type);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: t.bg, color: t.color,
      border: `1px solid ${t.border}33`,
      borderRadius: 4, padding: '2px 8px',
      fontSize: 12, fontWeight: 600,
      ...style
    }}>
      {t.emoji} {t.label}
    </span>
  );
}

// Alias legado odontologico → dentista
profTypeMap['odontologico'] = profTypeMap['dentista'];
