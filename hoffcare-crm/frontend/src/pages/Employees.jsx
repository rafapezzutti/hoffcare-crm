import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmt(v) { return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function fmtDate(d) { return d ? new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR') : '—'; }
function pf(v) { return parseFloat(v)||0; }

// Cálculo INSS progressivo 2024
function calcINSS(sal) {
  const bands=[{l:1412,r:.075},{l:2666.68,r:.09},{l:4000.03,r:.12},{l:7786.02,r:.14}];
  let inss=0,prev=0;
  for(const b of bands){
    if(sal<=prev)break;
    inss+=(Math.min(sal,b.l)-prev)*b.r;
    prev=b.l;
  }
  return Math.min(Math.round(inss*100)/100, 908.86);
}

// Cálculo IRRF 2024
function calcIRRF(base) {
  if(base<=2259.20)return 0;
  if(base<=2826.65)return Math.max(0,base*.075-169.44);
  if(base<=3751.05)return Math.max(0,base*.15-381.44);
  if(base<=4664.68)return Math.max(0,base*.225-662.77);
  return Math.max(0,base*.275-896);
}

function useBreakdown(form) {
  return useMemo(()=>{
    const sal = pf(form.salary);
    if (!sal || form.contract_type==='PJ') return { net: sal, total: sal, pj: true };
    const inss  = calcINSS(sal);
    const irrf  = calcIRRF(sal - inss);
    const fgts  = Math.round(sal*.08*100)/100;
    const th13  = Math.round((sal/12)*100)/100;
    const vac   = Math.round((sal/12)*(4/3)*100)/100;
    const vr    = pf(form.vr_value);
    const vt    = pf(form.vt_value);
    const hp    = pf(form.health_plan);
    const oth   = pf(form.other_benefits);
    const net   = Math.round((sal-inss-irrf)*100)/100;
    const total = Math.round((sal+fgts+th13+vac+vr+vt+hp+oth)*100)/100;
    return { sal, inss, irrf, fgts, th13, vac, vr, vt, hp, oth, net, total };
  },[form.salary,form.contract_type,form.vr_value,form.vt_value,form.health_plan,form.other_benefits]);
}

const emptyEmp = {
  name:'', cpf:'', contract_type:'CLT', salary:'', hire_date:'',
  professional_id:'', vr_value:'', vt_value:'', health_plan:'',
  other_benefits:'', pj_cnpj:'', notes:'',
};

export default function Employees() {
  const now = new Date();
  const [employees,    setEmployees]    = useState([]);
  const [professionals,setProfessionals]= useState([]);
  const [empForm,      setEmpForm]      = useState(emptyEmp);
  const [editingEmp,   setEditingEmp]   = useState(null);
  const [empOpen,      setEmpOpen]      = useState(false);
  const [empError,     setEmpError]     = useState('');

  // Folha
  const [payrollEmp,   setPayrollEmp]   = useState(null);
  const [payrollOpen,  setPayrollOpen]  = useState(false);
  const [payrollList,  setPayrollList]  = useState([]);
  const [payMonth,     setPayMonth]     = useState(now.getMonth()+1);
  const [payYear,      setPayYear]      = useState(now.getFullYear());
  const [payNotes,     setPayNotes]     = useState('');
  const [payLoading,   setPayLoading]   = useState(false);

  const bd = useBreakdown(empForm);

  const load = async () => {
    const [e, pr] = await Promise.all([api.get('/employees'), api.get('/professionals')]);
    setEmployees(e.data);
    setProfessionals(pr.data);
  };
  useEffect(()=>{ load(); },[]);

  const openEmp = (item=null) => {
    setEditingEmp(item);
    setEmpForm(item ? { ...emptyEmp, ...item, salary: item.salary||'', hire_date: item.hire_date?.slice(0,10)||'' } : emptyEmp);
    setEmpError('');
    setEmpOpen(true);
  };

  const saveEmp = async (e) => {
    e.preventDefault(); setEmpError('');
    try {
      if (editingEmp) await api.put(`/employees/${editingEmp.id}`, empForm);
      else            await api.post('/employees', empForm);
      setEmpOpen(false); load();
    } catch(err){ setEmpError(err.response?.data?.error||'Erro ao salvar'); }
  };

  const deactivate = async (id) => {
    if(!confirm('Desativar funcionário?')) return;
    await api.delete(`/employees/${id}`); load();
  };

  // Folha
  const openPayroll = async (emp) => {
    setPayrollEmp(emp);
    setPayMonth(now.getMonth()+1);
    setPayYear(now.getFullYear());
    setPayNotes('');
    setPayLoading(true);
    const res = await api.get(`/employees/${emp.id}/payroll`);
    setPayrollList(res.data);
    setPayLoading(false);
    setPayrollOpen(true);
  };

  const generatePayroll = async () => {
    if(!payrollEmp) return;
    try {
      await api.post(`/employees/${payrollEmp.id}/payroll`, { month: payMonth, year: payYear, notes: payNotes });
      const res = await api.get(`/employees/${payrollEmp.id}/payroll`);
      setPayrollList(res.data);
    } catch(err){ alert(err.response?.data?.error||'Erro ao gerar folha'); }
  };

  const markPaid = async (p) => {
    const today = new Date().toISOString().slice(0,10);
    await api.put(`/employees/${payrollEmp.id}/payroll/${p.id}`, { status:'pago', paid_date: today });
    const res = await api.get(`/employees/${payrollEmp.id}/payroll`);
    setPayrollList(res.data);
  };

  const deletePayroll = async (p) => {
    if(!confirm('Remover folha?')) return;
    await api.delete(`/employees/${payrollEmp.id}/payroll/${p.id}`);
    const res = await api.get(`/employees/${payrollEmp.id}/payroll`);
    setPayrollList(res.data);
  };

  const ef = (field) => ({ value: empForm[field]||'', onChange: e => setEmpForm(p=>({...p,[field]:e.target.value})) });

  const ativos   = employees.filter(e=>e.status==='ativo');
  const totalCLT = ativos.filter(e=>e.contract_type==='CLT').reduce((s,e)=>s+pf(e.salary),0);
  const totalPJ  = ativos.filter(e=>e.contract_type==='PJ').reduce((s,e)=>s+pf(e.salary),0);

  const years = []; for(let y=now.getFullYear()-1;y<=now.getFullYear()+1;y++) years.push(y);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Funcionários</h1>
          <p className="page-subtitle">Gestão de equipe CLT e PJ</p>
        </div>
        <button className="btn btn-primary" onClick={()=>openEmp()}>
          <i className="fas fa-user-plus"/> Novo Funcionário
        </button>
      </div>

      {/* Cards resumo */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        {[
          {label:'Funcionários Ativos', value: ativos.length, icon:'fa-users', color:'#6366f1', isNum:true},
          {label:'CLT — Salário Total', value: fmt(totalCLT), icon:'fa-id-card', color:'#3b82f6'},
          {label:'PJ — Contrato Total', value: fmt(totalPJ), icon:'fa-file-contract', color:'#8b5cf6'},
          {label:'Custo Mensal Est.', value: fmt(totalCLT*1.35 + totalPJ), icon:'fa-wallet', color:'#f59e0b'},
        ].map(c=>(
          <div key={c.label} className="card" style={{padding:'16px 20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:36,height:36,borderRadius:8,background:c.color+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <i className={`fas ${c.icon}`} style={{color:c.color,fontSize:14}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'var(--gray-500)',marginBottom:2}}>{c.label}</div>
                <div style={{fontSize:c.isNum?20:15,fontWeight:700,color:c.color}}>{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Salário/Contrato</th><th>Admissão</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {employees.length===0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state"><i className="fas fa-users"/><p>Nenhum funcionário cadastrado</p></div>
                </td></tr>
              )}
              {employees.map(emp=>(
                <tr key={emp.id} style={{opacity:emp.status==='inativo'?.5:1}}>
                  <td>
                    <div style={{fontWeight:500}}>{emp.name}</div>
                    {emp.professional_name && <div style={{fontSize:11,color:'var(--gray-400)'}}>{emp.professional_name}</div>}
                  </td>
                  <td>
                    <span className={`badge ${emp.contract_type==='CLT'?'badge-blue':'badge-purple'}`}>
                      {emp.contract_type}
                    </span>
                  </td>
                  <td style={{fontWeight:600}}>{fmt(emp.salary)}</td>
                  <td style={{fontSize:13,color:'var(--gray-500)'}}>{fmtDate(emp.hire_date)}</td>
                  <td>
                    <span className={`badge ${emp.status==='ativo'?'badge-green':'badge-gray'}`}>
                      {emp.status==='ativo'?'Ativo':'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-outline btn-sm" title="Folha de pagamento" onClick={()=>openPayroll(emp)}>
                        <i className="fas fa-money-check-dollar"/>
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={()=>openEmp(emp)}><i className="fas fa-pen"/></button>
                      {emp.status==='ativo' && <button className="btn btn-danger btn-sm" onClick={()=>deactivate(emp.id)}><i className="fas fa-user-slash"/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal funcionário */}
      <Modal open={empOpen} onClose={()=>setEmpOpen(false)}
        title={editingEmp?'Editar Funcionário':'Novo Funcionário'}
        footer={<>
          <button className="btn btn-outline" onClick={()=>setEmpOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={saveEmp}>Salvar</button>
        </>}>
        {empError && <div className="alert alert-error"><i className="fas fa-circle-exclamation"/> {empError}</div>}
        <form onSubmit={saveEmp}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label className="form-label">Nome <span className="required">*</span></label>
              <input className="form-control" {...ef('name')} required/>
            </div>
            <div className="form-group">
              <label className="form-label">CPF</label>
              <input className="form-control" {...ef('cpf')} placeholder="000.000.000-00"/>
            </div>
            <div className="form-group">
              <label className="form-label">Data de Admissão <span className="required">*</span></label>
              <input className="form-control" type="date" {...ef('hire_date')} required/>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Contrato</label>
              <select className="form-control" {...ef('contract_type')}>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{empForm.contract_type==='CLT'?'Salário Base':'Valor Mensal (NF)'} (R$)</label>
              <input className="form-control" type="number" step="0.01" min="0" {...ef('salary')}/>
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label className="form-label">Profissional vinculado (opcional)</label>
              <select className="form-control" {...ef('professional_id')}>
                <option value="">— Nenhum —</option>
                {professionals.map(pr=><option key={pr.id} value={pr.id}>{pr.name} ({pr.type})</option>)}
              </select>
            </div>

            {empForm.contract_type==='PJ' && (
              <div className="form-group" style={{gridColumn:'1/-1'}}>
                <label className="form-label">CNPJ</label>
                <input className="form-control" {...ef('pj_cnpj')} placeholder="00.000.000/0000-00"/>
              </div>
            )}

            {empForm.contract_type==='CLT' && (<>
              <div style={{gridColumn:'1/-1',borderTop:'1px solid var(--gray-100)',paddingTop:12,marginTop:4,fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:.5}}>
                Benefícios mensais (custo empresa)
              </div>
              <div className="form-group">
                <label className="form-label">Vale Refeição (R$)</label>
                <input className="form-control" type="number" step="0.01" min="0" {...ef('vr_value')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Vale Transporte (R$)</label>
                <input className="form-control" type="number" step="0.01" min="0" {...ef('vt_value')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Plano de Saúde (R$)</label>
                <input className="form-control" type="number" step="0.01" min="0" {...ef('health_plan')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Outros benefícios (R$)</label>
                <input className="form-control" type="number" step="0.01" min="0" {...ef('other_benefits')}/>
              </div>
            </>)}

            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label className="form-label">Observações</label>
              <textarea className="form-control" rows={2} {...ef('notes')}/>
            </div>
          </div>

          {/* Preview encargos CLT */}
          {empForm.contract_type==='CLT' && pf(empForm.salary)>0 && (
            <div style={{marginTop:12,padding:'12px 16px',background:'#f8fafc',borderRadius:8,border:'1px solid var(--gray-100)'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>
                Estimativa de encargos
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[
                  ['Salário bruto',    fmt(bd.sal),   '#374151'],
                  ['INSS (funcionário)',`-${fmt(bd.inss)}`,'#ef4444'],
                  ['IRRF',             `-${fmt(bd.irrf)}`,'#ef4444'],
                  ['FGTS (empresa)',   fmt(bd.fgts),  '#f59e0b'],
                  ['Prov. 13º/mês',   fmt(bd.th13),  '#f59e0b'],
                  ['Prov. férias/mês',fmt(bd.vac),   '#f59e0b'],
                ].map(([l,v,c])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0',borderBottom:'1px solid var(--gray-100)'}}>
                    <span style={{color:'var(--gray-500)'}}>{l}</span>
                    <span style={{fontWeight:600,color:c}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
                <div style={{padding:'8px 12px',background:'#f0fdf4',borderRadius:6,border:'1px solid #86efac'}}>
                  <div style={{fontSize:10,color:'#16a34a'}}>Líquido funcionário</div>
                  <div style={{fontWeight:700,color:'#15803d',fontSize:15}}>{fmt(bd.net)}</div>
                </div>
                <div style={{padding:'8px 12px',background:'#fef9ec',borderRadius:6,border:'1px solid #fde68a'}}>
                  <div style={{fontSize:10,color:'#92400e'}}>Custo total empresa/mês</div>
                  <div style={{fontWeight:700,color:'#92400e',fontSize:15}}>{fmt(bd.total)}</div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal folha */}
      <Modal open={payrollOpen} onClose={()=>setPayrollOpen(false)}
        title={`Folha — ${payrollEmp?.name}`}
        footer={<button className="btn btn-outline" onClick={()=>setPayrollOpen(false)}>Fechar</button>}>

        <div style={{padding:'4px 0 16px',borderBottom:'1px solid var(--gray-100)',marginBottom:16}}>
          <div style={{fontSize:12,color:'var(--gray-500)',marginBottom:8,fontWeight:600}}>Gerar folha para:</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select className="form-control" style={{width:90}} value={payMonth} onChange={e=>setPayMonth(Number(e.target.value))}>
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="form-control" style={{width:80}} value={payYear} onChange={e=>setPayYear(Number(e.target.value))}>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <input className="form-control" placeholder="Observação (opcional)" style={{flex:1}}
              value={payNotes} onChange={e=>setPayNotes(e.target.value)}/>
            <button className="btn btn-primary" onClick={generatePayroll}>
              <i className="fas fa-plus"/> Gerar
            </button>
          </div>
        </div>

        {/* Histórico */}
        {payLoading ? (
          <div style={{textAlign:'center',padding:20}}><i className="fas fa-spinner fa-spin"/></div>
        ) : payrollList.length===0 ? (
          <div className="empty-state" style={{padding:'24px 0'}}>
            <i className="fas fa-money-check-dollar"/>
            <p>Nenhuma folha gerada ainda</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Mês/Ano</th><th>Salário Bruto</th><th>INSS</th><th>Líquido</th><th>Custo Total</th><th>Status</th><th/></tr>
            </thead>
            <tbody>
              {payrollList.map(pl=>(
                <tr key={pl.id}>
                  <td style={{fontWeight:500}}>{MONTHS[pl.month-1]}/{pl.year}</td>
                  <td>{fmt(pl.base_salary)}</td>
                  <td style={{color:'#ef4444',fontSize:12}}>-{fmt(pl.inss)}</td>
                  <td style={{fontWeight:600,color:'#22c55e'}}>{fmt(pl.net_salary)}</td>
                  <td style={{fontSize:12,color:'var(--gray-500)'}}>{fmt(pl.total_employer_cost)}</td>
                  <td>
                    {pl.status==='pago'
                      ? <span className="badge badge-green">Pago {fmtDate(pl.paid_date)}</span>
                      : <span className="badge badge-orange">Pendente</span>}
                  </td>
                  <td>
                    <div className="table-actions">
                      {pl.status!=='pago' && (
                        <button className="btn btn-outline btn-sm" title="Marcar como pago"
                          onClick={()=>markPaid(pl)} style={{color:'#22c55e',borderColor:'#22c55e'}}>
                          <i className="fas fa-check"/>
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={()=>deletePayroll(pl)}>
                        <i className="fas fa-trash"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
