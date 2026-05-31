import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete'];

export default function Permissions() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/permissions');
      setData(res.data);
      if (res.data.users?.length > 0 && !selectedUser) setSelectedUser(res.data.users[0].id);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const togglePerm = async (userId, module, action, current) => {
    const key = `${userId}_${module}_${action}`;
    setSaving(p => ({ ...p, [key]: true }));
    try {
      const user = data.users.find(u => u.id === userId);
      const mod  = user.modules.find(m => m.module === module);
      const newPerms = { ...mod, [action]: !current };
      await api.put(`/permissions/${userId}/${module}`, newPerms);
      // Update local state
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id !== userId ? u : {
          ...u,
          modules: u.modules.map(m => m.module !== module ? m : { ...m, [action]: !current, is_override: true })
        })
      }));
    } catch { alert(t('permissions.errorSave')); }
    finally { setSaving(p => { const n={...p}; delete n[key]; return n; }); }
  };

  const resetUser = async (userId, module) => {
    try {
      await api.delete(`/permissions/${userId}/${module}`);
      load();
    } catch { alert(t('permissions.errorReset')); }
  };

  if (!data) return <div className="page"><div className="empty-state"><div className="spinner" /></div></div>;

  const canManage = me?.role === 'admin' || me?.role === 'responsavel';
  if (!canManage) return (
    <div className="page">
      <div className="empty-state"><i className="fas fa-lock" /><p>{t('permissions.noAccess')}</p></div>
    </div>
  );

  const currentUser = data.users.find(u => u.id === selectedUser);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fas fa-shield-halved" style={{ marginRight: 8, color: 'var(--blue)' }} />{t('permissions.title')}</h1>
          <p className="page-subtitle">{t('permissions.subtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        {/* Lista de usuários */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gray-500)', borderBottom: '1px solid var(--gray-100)' }}>
            {t('permissions.users')}
          </div>
          {data.users.length === 0 && <div style={{ padding: 16, color: 'var(--gray-400)', fontSize: 13 }}>{t('permissions.noUsers')}</div>}
          {data.users.map(u => (
            <button key={u.id} onClick={() => setSelectedUser(u.id)} style={{
              width: '100%', padding: '12px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
              background: selectedUser === u.id ? '#EBF5FB' : 'white',
              borderLeft: selectedUser === u.id ? '3px solid #2E86C1' : '3px solid transparent',
              borderBottom: '1px solid var(--gray-100)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: selectedUser === u.id ? '#2E86C1' : 'var(--gray-800)' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{u.role} · {u.email}</div>
              {u.modules.some(m => m.is_override) && (
                <div style={{ fontSize: 10, color: '#e67e22', marginTop: 2, fontWeight: 600 }}>
                  <i className="fas fa-circle-dot" style={{ marginRight: 4 }} />{t('permissions.customized')}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Tabela de permissões */}
        <div className="card" style={{ padding: 0 }}>
          {!currentUser ? (
            <div className="empty-state"><i className="fas fa-user" /><p>{t('permissions.selectUser')}</p></div>
          ) : (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{currentUser.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('permissions.profile')}: <strong>{currentUser.role}</strong> · {currentUser.email}</div>
                </div>
                {currentUser.modules.some(m => m.is_override) && (
                  <button className="btn btn-outline btn-sm" style={{ fontSize: 11 }}
                    onClick={async () => {
                      if (!confirm(t('permissions.confirmReset'))) return;
                      for (const mod of currentUser.modules.filter(m => m.is_override)) {
                        await api.delete(`/permissions/${currentUser.id}/${mod.module}`).catch(() => {});
                      }
                      load();
                    }}>
                    <i className="fas fa-rotate-left" style={{ marginRight: 4 }} />{t('permissions.resetAll')}
                  </button>
                )}
              </div>

              <div className="table-container">
                <table className="table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', minWidth: 200 }}>{t('permissions.module')}</th>
                      {ACTIONS.map(a => <th key={a} style={{ textAlign: 'center', width: 80 }}>{t(`permissions.${a}`)}</th>)}
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentUser.modules.map((mod, i) => (
                      <tr key={mod.module} style={{ background: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                        <td style={{ padding: '8px 16px', fontWeight: mod.is_override ? 600 : 400 }}>
                          {mod.label}
                          {mod.is_override && <span style={{ marginLeft: 6, fontSize: 10, color: '#e67e22', fontWeight: 700 }}>CUSTOM</span>}
                        </td>
                        {ACTIONS.map(action => {
                          const val = mod[action];
                          const key = `${currentUser.id}_${mod.module}_${action}`;
                          return (
                            <td key={action} style={{ padding: '8px', textAlign: 'center' }}>
                              <button onClick={() => togglePerm(currentUser.id, mod.module, action, val)}
                                disabled={!!saving[key]}
                                style={{
                                  width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                  background: val ? '#d4edda' : '#f8d7da', color: val ? '#1e8449' : '#c0392b',
                                  fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  opacity: saving[key] ? 0.5 : 1,
                                }}>
                                {saving[key] ? '…' : val ? '✓' : '✗'}
                              </button>
                            </td>
                          );
                        })}
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {mod.is_override && (
                            <button className="btn btn-outline btn-sm" style={{ fontSize: 10, padding: '2px 8px' }}
                              onClick={() => resetUser(currentUser.id, mod.module)} title={t('permissions.resetToDefault')}>
                              <i className="fas fa-rotate-left" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
