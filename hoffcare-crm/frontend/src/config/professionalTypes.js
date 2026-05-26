/**
 * Configuração central de tipos de profissionais de saúde.
 * Arquivo JS puro (sem JSX) — pode ser importado em qualquer componente.
 * labelKey: chave de tradução i18n. Use t(profType.labelKey) nos componentes.
 * label: fallback em português (usado onde não há contexto de tradução).
 */

export const PROF_TYPES = [
  { value: 'medico',                labelKey: 'profTypes.medico',                label: 'Médico',                short: 'Médico',    emoji: '🩺', color: '#E8841A', bg: 'rgba(232,132,26,0.12)',   border: '#E8841A', council: 'CRM' },
  { value: 'dentista',              labelKey: 'profTypes.dentista',              label: 'Dentista',              short: 'Dentista',  emoji: '🦷', color: '#4DB8E8', bg: 'rgba(77,184,232,0.12)',   border: '#4DB8E8', council: 'CRO' },
  { value: 'fisioterapeuta',        labelKey: 'profTypes.fisioterapeuta',        label: 'Fisioterapeuta',        short: 'Fisio.',    emoji: '🏃', color: '#28a745', bg: 'rgba(40,167,69,0.12)',    border: '#28a745', council: 'CREFITO' },
  { value: 'psicologo',             labelKey: 'profTypes.psicologo',             label: 'Psicólogo',             short: 'Psicol.',   emoji: '🧠', color: '#6f42c1', bg: 'rgba(111,66,193,0.12)',  border: '#6f42c1', council: 'CRP' },
  { value: 'nutricionista',         labelKey: 'profTypes.nutricionista',         label: 'Nutricionista',         short: 'Nutri.',    emoji: '🥗', color: '#20c997', bg: 'rgba(32,201,151,0.12)',  border: '#20c997', council: 'CRN' },
  { value: 'fonoaudiologo',         labelKey: 'profTypes.fonoaudiologo',         label: 'Fonoaudiólogo',         short: 'Fono.',     emoji: '🗣️', color: '#fd7e14', bg: 'rgba(253,126,20,0.12)',  border: '#fd7e14', council: 'CRFa' },
  { value: 'terapeuta_ocupacional', labelKey: 'profTypes.terapeuta_ocupacional', label: 'Terapeuta Ocupacional', short: 'T.O.',      emoji: '🖐️', color: '#17a2b8', bg: 'rgba(23,162,184,0.12)',  border: '#17a2b8', council: 'CREFITO' },
  { value: 'enfermeiro',            labelKey: 'profTypes.enfermeiro',            label: 'Enfermeiro',            short: 'Enf.',      emoji: '💉', color: '#dc3545', bg: 'rgba(220,53,69,0.12)',   border: '#dc3545', council: 'COREN' },
  { value: 'biomedico',             labelKey: 'profTypes.biomedico',             label: 'Biomédico',             short: 'Biomed.',   emoji: '🔬', color: '#6c757d', bg: 'rgba(108,117,125,0.12)', border: '#6c757d', council: 'CFBM' },
  { value: 'farmaceutico',          labelKey: 'profTypes.farmaceutico',          label: 'Farmacêutico',          short: 'Farm.',     emoji: '💊', color: '#0069d9', bg: 'rgba(0,105,217,0.12)',   border: '#0069d9', council: 'CRF' },
  { value: 'quiropraxista',            labelKey: 'profTypes.quiropraxista',            label: 'Quiropraxista',                short: 'Quiro.',    emoji: '🦴', color: '#795548', bg: 'rgba(121,85,72,0.12)',   border: '#795548', council: 'CRQ'  },
  { value: 'esteticista',              labelKey: 'profTypes.esteticista',              label: 'Esteticista',                  short: 'Estétic.',  emoji: '💆', color: '#e91e8c', bg: 'rgba(233,30,140,0.12)',  border: '#e91e8c', council: 'Reg.' },
  { value: 'professor_educacao_fisica', labelKey: 'profTypes.professor_educacao_fisica', label: 'Prof. Educação Física',       short: 'Ed. Fís.',  emoji: '🏋️', color: '#2e7d32', bg: 'rgba(46,125,50,0.12)',   border: '#2e7d32', council: 'CREF' },
  { value: 'professor_particular',      labelKey: 'profTypes.professor_particular',      label: 'Professor Particular',        short: 'Prof.',     emoji: '📚', color: '#1565c0', bg: 'rgba(21,101,192,0.12)',  border: '#1565c0', council: 'Reg.' },
];

// Lookup rápido por value: profTypeMap['medico'] → { label, color, ... }
export const profTypeMap = Object.fromEntries(PROF_TYPES.map(t => [t.value, t]));

// Alias legado: odontologico → dentista
profTypeMap['odontologico'] = profTypeMap['dentista'];

// Fallback seguro para tipos desconhecidos / legados
export const getProfType = (value) =>
  profTypeMap[value] || {
    value,
    labelKey: null,
    label: value,
    short: value,
    emoji: '👤',
    color: '#6c757d',
    bg: 'rgba(108,117,125,0.12)',
    border: '#6c757d',
    council: 'Reg.'
  };

// Helper para gerar o objeto de estilo do badge (use inline nos componentes)
export const profBadgeStyle = (type) => {
  const t = getProfType(type);
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    background: t.bg,
    color: t.color,
    border: `1px solid ${t.border}33`,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
  };
};
