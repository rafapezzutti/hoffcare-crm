import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';

const CATEGORIES = [
  { value: 'medicamento',  label: 'Medicamento',  badgeClass: 'badge-orange' },
  { value: 'descartavel',  label: 'Descartável',   badgeClass: 'badge-blue' },
  { value: 'acessorio',    label: 'Acessório',     color: '#6f42c1' },
  { value: 'outro',        label: 'Outro',         color: 'var(--gray-500)' },
];

const MOVEMENT_TYPES = [
  { value: 'entrada', label: 'Entrada',  color: 'var(--success)' },
  { value: 'saida',   label: 'Saída',    color: 'var(--danger)' },
  { value: 'ajuste',  label: 'Ajuste',   color: 'var(--orange)' },
];

const emptyItem = {
  name: '', category: 'medicamento', unit: 'un',
  current_stock: '', min_stock: '', unit_cost: '', notes: '',
};
const emptyMovement = {
  item_id: '', type: 'entrada', quantity: '', unit_cost: '', notes: '',
};

function getCategoryBadge(cat) {
  const found = CATEGORIES.find(c => c.value === cat);
  return found || { label: cat, color: 'var(--gray-500)' };
}

function CategoryBadge({ category }) {
  const cat = getCategoryBadge(category);
  if (cat.badgeClass) {
    return <span className={`badge ${cat.badgeClass}`}>{cat.label}</span>;
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 12, fontWeight: 600,
      background: cat.color + '22', color: cat.color,
      border: `1px solid ${cat.color}44`,
    }}>{cat.label}</span>
  );
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Item modal
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [itemError, setItemError] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  // Movement modal
  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState(emptyMovement);
  const [movError, setMovError] = useState('');
  const [movSaving, setMovSaving] = useState(false);

  // History drawer
  const [historyItem, setHistoryItem] = useState(null);
  const [historyDrawer, setHistoryDrawer] = useState(false);
  const [movements, setMovements] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/items');
      setItems(res.data);
    } catch {
      setError('Erro ao carregar itens de estoque.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // --- Summary ---
  const totalItems = items.length;
  const totalValue = items.reduce((s, i) => s + (parseFloat(i.current_stock || 0) * parseFloat(i.unit_cost || 0)), 0);
  const belowMin = items.filter(i => parseFloat(i.current_stock) <= parseFloat(i.min_stock)).length;
  const activeCategories = new Set(items.map(i => i.category)).size;

  // --- Filtered items ---
  const filtered = categoryFilter
    ? items.filter(i => i.category === categoryFilter)
    : items;

  // --- Item modal ---
  const openItemModal = (item = null) => {
    setEditingItem(item);
    setItemForm(item ? {
      name: item.name, category: item.category, unit: item.unit || 'un',
      current_stock: item.current_stock, min_stock: item.min_stock,
      unit_cost: item.unit_cost, notes: item.notes || '',
    } : emptyItem);
    setItemError('');
    setItemModal(true);
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim()) { setItemError('Nome é obrigatório.'); return; }
    setItemSaving(true); setItemError('');
    try {
      if (editingItem) await api.put(`/inventory/items/${editingItem.id}`, itemForm);
      else await api.post('/inventory/items', itemForm);
      setItemModal(false);
      load();
    } catch (err) {
      setItemError(err.response?.data?.error || 'Erro ao salvar item.');
    } finally { setItemSaving(false); }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Desativar este item do estoque?')) return;
    try {
      await api.delete(`/inventory/items/${id}`);
      load();
    } catch {
      alert('Erro ao excluir item.');
    }
  };

  // --- Movement modal ---
  const openMovModal = (item = null) => {
    setMovForm({ ...emptyMovement, item_id: item ? item.id : '' });
    setMovError('');
    setMovModal(true);
  };

  const selectedMovItem = items.find(i => String(i.id) === String(movForm.item_id));

  const handleMovSubmit = async (e) => {
    e.preventDefault();
    if (!movForm.item_id) { setMovError('Selecione um item.'); return; }
    if (!movForm.quantity || parseFloat(movForm.quantity) <= 0) { setMovError('Quantidade deve ser maior que zero.'); return; }
    setMovSaving(true); setMovError('');
    try {
      await api.post('/inventory/movements', movForm);
      setMovModal(false);
      load();
    } catch (err) {
      setMovError(err.response?.data?.error || 'Erro ao registrar movimentação.');
    } finally { setMovSaving(false); }
  };

  // --- History drawer ---
  const openHistory = async (item) => {
    setHistoryItem(item);
    setHistoryDrawer(true);
    setHistLoading(true);
    try {
      const res = await api.get(`/inventory/movements?item_id=${item.id}&limit=20`);
      setMovements(res.data);
    } catch {
      setMovements([]);
    } finally { setHistLoading(false); }
  };

  const fi = (field) => ({
    value: itemForm[field] ?? '',
    onChange: e => setItemForm(p => ({ ...p, [field]: e.target.value })),
  });
  const fm = (field) => ({
    value: movForm[field] ?? '',
    onChange: e => setMovForm(p => ({ ...p, [field]: e.target.value })),
  });

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-boxes-stacked" style={{ marginRight: 10, color: 'var(--blue)' }} />
            Controle de Estoque
          </h1>
          <p className="page-subtitle">{items.length} itens cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => openMovModal()}>
            <i className="fas fa-arrow-right-arrow-left" /> Nova Movimentação
          </button>
          <button className="btn btn-primary" onClick={() => openItemModal()}>
            <i className="fas fa-plus" /> Novo Item
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon blue"><i className="fas fa-cubes" /></div>
          <div>
            <div className="stat-value">{totalItems}</div>
            <div className="stat-label">Total Itens</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><i className="fas fa-dollar-sign" /></div>
          <div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-label">Valor Total em Estoque</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: belowMin > 0 ? '#ffeaea' : '#e8f5e9' }}>
            <i className="fas fa-triangle-exclamation" style={{ color: belowMin > 0 ? 'var(--danger)' : 'var(--success)' }} />
          </div>
          <div>
            <div className="stat-value" style={{ color: belowMin > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {belowMin}
            </div>
            <div className="stat-label">Abaixo do Mínimo</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><i className="fas fa-tags" /></div>
          <div>
            <div className="stat-value">{activeCategories}</div>
            <div className="stat-label">Categorias Ativas</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--gray-200)', paddingBottom: 0 }}>
        {[{ value: '', label: 'Todos' }, ...CATEGORIES].map(tab => (
          <button
            key={tab.value}
            onClick={() => setCategoryFilter(tab.value)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: categoryFilter === tab.value ? 'var(--blue)' : 'var(--gray-500)',
              borderBottom: categoryFilter === tab.value ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 700,
              background: categoryFilter === tab.value ? 'var(--blue)' : 'var(--gray-200)',
              color: categoryFilter === tab.value ? 'white' : 'var(--gray-600)',
              borderRadius: 10, padding: '1px 6px',
            }}>
              {tab.value === '' ? items.length : items.filter(i => i.category === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Items table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Unidade</th>
                <th>Estoque Atual</th>
                <th>Mínimo</th>
                <th>Custo Unit.</th>
                <th>Valor Total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9}><div className="empty-state"><i className="fas fa-spinner fa-spin" /><p>Carregando...</p></div></td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9}>
                  <div className="empty-state">
                    <i className="fas fa-boxes-stacked" />
                    <p>Nenhum item encontrado</p>
                  </div>
                </td></tr>
              )}
              {!loading && filtered.map(item => {
                const isCritical = parseFloat(item.current_stock) <= parseFloat(item.min_stock);
                const rowTotal = parseFloat(item.current_stock || 0) * parseFloat(item.unit_cost || 0);
                return (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td><CategoryBadge category={item.category} /></td>
                    <td>{item.unit || 'un'}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: isCritical ? 'var(--danger)' : 'var(--gray-800)' }}>
                        {item.current_stock}
                      </span>
                    </td>
                    <td>{item.min_stock}</td>
                    <td>R$ {parseFloat(item.unit_cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>R$ {rowTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>
                      {isCritical ? (
                        <span style={{ background: '#ffeaea', color: 'var(--danger)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          ⚠️ Crítico
                        </span>
                      ) : (
                        <span style={{ background: '#e8f5e9', color: 'var(--success)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          OK
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm" title="Editar" onClick={() => openItemModal(item)}>
                          <i className="fas fa-pen" />
                        </button>
                        <button className="btn btn-outline btn-sm" title="Movimentações" onClick={() => openHistory(item)}
                          style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>
                          <i className="fas fa-eye" />
                        </button>
                        <button className="btn btn-danger btn-sm" title="Excluir" onClick={() => handleDeleteItem(item.id)}>
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Modal */}
      <Modal
        open={itemModal}
        onClose={() => setItemModal(false)}
        title={editingItem ? 'Editar Item' : 'Novo Item de Estoque'}
        size="modal-md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setItemModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleItemSubmit} disabled={itemSaving}>
              {itemSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {itemError && <div className="alert alert-error">{itemError}</div>}
        <form onSubmit={handleItemSubmit}>
          <div className="form-group">
            <label className="form-label">Nome <span className="required">*</span></label>
            <input className="form-control" {...fi('name')} required placeholder="Ex: Seringa 5ml" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-control" {...fi('category')}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unidade</label>
              <input className="form-control" {...fi('unit')} placeholder="un, cx, frasco..." />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Estoque Atual</label>
              <input className="form-control" type="number" min="0" step="0.01" {...fi('current_stock')} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Estoque Mínimo</label>
              <input className="form-control" type="number" min="0" step="0.01" {...fi('min_stock')} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Custo Unit. (R$)</label>
              <input className="form-control" type="number" min="0" step="0.01" {...fi('unit_cost')} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-control" rows={2} {...fi('notes')} />
          </div>
        </form>
      </Modal>

      {/* Movement Modal */}
      <Modal
        open={movModal}
        onClose={() => setMovModal(false)}
        title="Nova Movimentação de Estoque"
        size="modal-md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setMovModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleMovSubmit} disabled={movSaving}>
              {movSaving ? 'Registrando...' : 'Registrar'}
            </button>
          </>
        }
      >
        {movError && <div className="alert alert-error">{movError}</div>}
        <form onSubmit={handleMovSubmit}>
          <div className="form-group">
            <label className="form-label">Item <span className="required">*</span></label>
            <select className="form-control" {...fm('item_id')} required>
              <option value="">Selecione um item...</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name} — {i.unit || 'un'}</option>
              ))}
            </select>
            {selectedMovItem && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-500)' }}>
                Estoque atual: <strong style={{ color: 'var(--gray-700)' }}>{selectedMovItem.current_stock} {selectedMovItem.unit || 'un'}</strong>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-control" {...fm('type')}>
                {MOVEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantidade <span className="required">*</span></label>
              <input className="form-control" type="number" min="0.01" step="0.01" {...fm('quantity')} required placeholder="0" />
            </div>
          </div>
          {movForm.type === 'entrada' && (
            <div className="form-group">
              <label className="form-label">Custo Unitário (R$)</label>
              <input className="form-control" type="number" min="0" step="0.01" {...fm('unit_cost')} placeholder="0.00" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-control" rows={2} {...fm('notes')} placeholder="Ex: Compra NF 1234, Uso em procedimento..." />
          </div>
        </form>
      </Modal>

      {/* History Drawer */}
      {historyDrawer && (
        <div
          style={{
            position: 'fixed', top: 0, right: 0, width: 420, height: '100vh',
            background: 'white', boxShadow: 'var(--shadow-lg)', zIndex: 200,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--gray-200)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Histórico de Movimentações</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{historyItem?.name}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setHistoryDrawer(false)}>
              <i className="fas fa-xmark" />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {histLoading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
              </div>
            )}
            {!histLoading && movements.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                <i className="fas fa-inbox" style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                Nenhuma movimentação registrada
              </div>
            )}
            {!histLoading && movements.map((mov, idx) => {
              const mType = MOVEMENT_TYPES.find(t => t.value === mov.type) || { label: mov.type, color: 'var(--gray-500)' };
              return (
                <div key={mov.id || idx} style={{
                  padding: '12px 0', borderBottom: '1px solid var(--gray-100)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <span style={{
                    background: mType.color + '22', color: mType.color,
                    border: `1px solid ${mType.color}44`,
                    borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    {mType.label}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {mov.type === 'saida' ? '-' : '+'}{mov.quantity} {historyItem?.unit || 'un'}
                    </div>
                    {mov.notes && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>{mov.notes}</div>}
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                      {dayjs(mov.created_at).format('DD/MM/YYYY HH:mm')}
                      {mov.user_name && <span style={{ marginLeft: 8 }}>por {mov.user_name}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-200)' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => openMovModal(historyItem)}>
              <i className="fas fa-plus" /> Registrar Movimentação
            </button>
          </div>
        </div>
      )}
      {historyDrawer && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }}
          onClick={() => setHistoryDrawer(false)}
        />
      )}
    </div>
  );
}
