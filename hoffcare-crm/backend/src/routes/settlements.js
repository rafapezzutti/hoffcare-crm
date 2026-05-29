const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Listar acertos da clínica
router.get('/', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json([]);
  const { professional_id, month, year } = req.query;
  const params = [clinic_id];
  const conditions = ['s.clinic_id = $1'];

  if (professional_id) { conditions.push(`s.professional_id = $${params.length+1}`); params.push(professional_id); }
  if (year && month) {
    conditions.push(`EXTRACT(YEAR FROM s.date) = $${params.length+1}`); params.push(year);
    conditions.push(`EXTRACT(MONTH FROM s.date) = $${params.length+1}`); params.push(month);
  }

  try {
    const result = await pool.query(
      `SELECT s.*, p.name as professional_name
       FROM financial_settlements s
       LEFT JOIN professionals p ON s.professional_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.date DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar acerto
router.post('/', auth, async (req, res) => {
  const { professional_id, value, date, description, type, status } = req.body;
  if (!value || !date)
    return res.status(400).json({ error: 'Valor e data são obrigatórios' });

  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de cadastrar' });

  try {
    const result = await pool.query(
      `INSERT INTO financial_settlements (clinic_id, professional_id, value, date, description, type, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [clinic_id, professional_id || null, value, date, description || null,
       type || 'a_pagar', status || 'pendente']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar acerto
router.put('/:id', auth, async (req, res) => {
  const { professional_id, value, date, description, type, status } = req.body;
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      `UPDATE financial_settlements SET professional_id=$1, value=$2, date=$3,
       description=$4, type=$5, status=$6
       WHERE id=$7 AND clinic_id=$8 RETURNING *`,
      [professional_id || null, value, date, description || null,
       type || 'a_pagar', status || 'pendente', req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Acerto não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remover acerto
router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      'DELETE FROM financial_settlements WHERE id=$1 AND clinic_id=$2 RETURNING id',
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Acerto não encontrado' });
    res.json({ message: 'Acerto removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extrato mensal por profissional
router.get('/statement/:professional_id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { professional_id } = req.params;
  const y = parseInt(req.query.year) || new Date().getFullYear();
  const m = parseInt(req.query.month) || new Date().getMonth() + 1;

  try {
    const [profRes, recordsRes, settlementsRes, rentalsRes] = await Promise.all([
      // Dados do profissional
      pool.query(`SELECT p.*, c.name as clinic_name, c.email as clinic_email
                  FROM professionals p
                  LEFT JOIN clinics c ON c.id = $2
                  WHERE p.id = $1`, [professional_id, clinic_id]),

      // Registros/procedimentos do profissional no mês
      pool.query(`
        SELECT mr.consultation_date, mr.id as record_id,
               pat.name as patient_name,
               COALESCE(SUM(mrp.value), 0) as total_value,
               ARRAY_AGG(mrp.procedure_name ORDER BY mrp.id) FILTER (WHERE mrp.id IS NOT NULL) as procedures
        FROM medical_records mr
        LEFT JOIN patients pat ON pat.id = mr.patient_id
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id = $1 AND mr.professional_id = $2
          AND EXTRACT(YEAR FROM mr.consultation_date) = $3
          AND EXTRACT(MONTH FROM mr.consultation_date) = $4
        GROUP BY mr.id, mr.consultation_date, pat.name
        ORDER BY mr.consultation_date
      `, [clinic_id, professional_id, y, m]),

      // Acertos financeiros do mês
      pool.query(`
        SELECT * FROM financial_settlements
        WHERE clinic_id = $1 AND professional_id = $2
          AND EXTRACT(YEAR FROM date) = $3
          AND EXTRACT(MONTH FROM date) = $4
        ORDER BY date
      `, [clinic_id, professional_id, y, m]),

      // Aluguéis ativos no mês (proporcional)
      pool.query(`
        SELECT * FROM rentals
        WHERE clinic_id = $1 AND status = 'active'
          AND start_date <= $2::date
          AND (end_date IS NULL OR end_date >= $3::date)
        ORDER BY start_date
      `, [clinic_id, `${y}-${String(m).padStart(2,'0')}-28`, `${y}-${String(m).padStart(2,'0')}-01`]),
    ]);

    const professional = profRes.rows[0];
    if (!professional) return res.status(404).json({ error: 'Profissional não encontrado' });

    const records = recordsRes.rows;
    const settlements = settlementsRes.rows;
    const rentals = rentalsRes.rows;

    const totalRecordsGross = records.reduce((s, r) => s + parseFloat(r.total_value), 0);

    const repassePercent = professional.repasse_percentual != null
      ? parseFloat(professional.repasse_percentual)
      : 100; // sem repasse configurado = recebe 100%

    // a_pagar: clínica paga ao profissional → soma à base
    const totalSettlementsIn = settlements
      .filter(s => s.type === 'a_pagar')
      .reduce((s, r) => s + parseFloat(r.value), 0);

    // a_receber: profissional paga à clínica → subtrai da base
    const totalSettlementsOut = settlements
      .filter(s => s.type === 'a_receber')
      .reduce((s, r) => s + parseFloat(r.value), 0);

    const totalRentals = rentals.reduce((s, r) => s + parseFloat(r.value), 0);

    // Acertos entram ANTES do repasse %:
    // base = procedimentos + acertos da clínica − acertos do profissional
    // líquido = base × (repasse% / 100) − aluguéis
    const baseBeforeRepasse = totalRecordsGross + totalSettlementsIn - totalSettlementsOut;
    const totalAfterRepasse = baseBeforeRepasse * repassePercent / 100;
    const netTotal = totalAfterRepasse - totalRentals;

    res.json({
      professional,
      year: y,
      month: m,
      records,
      settlements,
      rentals,
      summary: {
        total_records_gross: totalRecordsGross,
        repasse_percent: repassePercent,
        total_settlements_in: totalSettlementsIn,
        total_settlements_out: totalSettlementsOut,
        base_before_repasse: baseBeforeRepasse,   // base antes de aplicar o %
        total_after_repasse: totalAfterRepasse,    // base × %
        total_records: totalAfterRepasse,          // alias para compatibilidade com o frontend
        total_rentals: totalRentals,
        net_total: netTotal,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settlements/bank-statement?year=&month=  — extrato estilo bancário (todos profissionais)
router.get('/bank-statement', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const y = parseInt(req.query.year)  || new Date().getFullYear();
  const m = parseInt(req.query.month) || new Date().getMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2,'0')}-01`;
  const monthEnd   = new Date(y, m, 0).toISOString().split('T')[0]; // last day

  try {
    const [profRes, recordsRes, settlementsRes, rentalsRes] = await Promise.all([
      // Profissionais ativos da clínica
      pool.query(
        `SELECT id, name, repasse_percentual FROM professionals WHERE clinic_id=$1 ORDER BY name`,
        [clinic_id]
      ),
      // Atendimentos agrupados por dia e profissional
      pool.query(`
        SELECT mr.professional_id, mr.consultation_date::date as day,
               COUNT(*) as count,
               COALESCE(SUM(mrp.value), 0) as gross
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id=$1
          AND mr.consultation_date::date BETWEEN $2 AND $3
        GROUP BY mr.professional_id, mr.consultation_date::date
        ORDER BY day
      `, [clinic_id, monthStart, monthEnd]),
      // Acertos financeiros do mês
      pool.query(`
        SELECT professional_id, date::date as day, type, SUM(value) as value
        FROM financial_settlements
        WHERE clinic_id=$1 AND date::date BETWEEN $2 AND $3
        GROUP BY professional_id, date::date, type
        ORDER BY day
      `, [clinic_id, monthStart, monthEnd]),
      // Aluguéis ativos no mês
      pool.query(`
        SELECT value, tenant_name FROM rentals
        WHERE clinic_id=$1 AND status='active'
          AND start_date <= $3 AND (end_date IS NULL OR end_date >= $2)
      `, [clinic_id, monthStart, monthEnd]),
    ]);

    const professionals = profRes.rows;
    const profMap = Object.fromEntries(professionals.map(p => [p.id, p]));

    // Monta mapa de dias únicos
    const daySet = new Set();
    recordsRes.rows.forEach(r => daySet.add(r.day));
    settlementsRes.rows.forEach(r => daySet.add(r.day));
    const days = Array.from(daySet).sort();

    const totalRentals = rentalsRes.rows.reduce((s, r) => s + parseFloat(r.value), 0);

    // Linha por dia
    const rows = days.map(day => {
      const dayRecords = recordsRes.rows.filter(r => String(r.day).slice(0,10) === String(day).slice(0,10));
      const daySettlements = settlementsRes.rows.filter(r => String(r.day).slice(0,10) === String(day).slice(0,10));

      const gross = dayRecords.reduce((s, r) => s + parseFloat(r.gross), 0);
      const settlementsIn  = daySettlements.filter(s => s.type === 'a_pagar').reduce((s,r) => s + parseFloat(r.value), 0);
      const settlementsOut = daySettlements.filter(s => s.type === 'a_receber').reduce((s,r) => s + parseFloat(r.value), 0);

      // Repasse ponderado por profissional
      let repasse = 0;
      dayRecords.forEach(r => {
        const prof = profMap[r.professional_id];
        const pct  = prof?.repasse_percentual != null ? parseFloat(prof.repasse_percentual) : 100;
        repasse += parseFloat(r.gross) * pct / 100;
      });

      const net = gross - repasse + settlementsIn - settlementsOut;

      const byProfessional = dayRecords.map(r => {
        const prof = profMap[r.professional_id];
        const pct  = prof?.repasse_percentual != null ? parseFloat(prof.repasse_percentual) : 100;
        const profGross = parseFloat(r.gross);
        return {
          professional_id: r.professional_id,
          professional_name: prof?.name || 'Desconhecido',
          count: parseInt(r.count),
          gross: profGross,
          repasse_percent: pct,
          repasse: profGross * pct / 100,
        };
      });

      return { day, gross, repasse, settlements_in: settlementsIn, settlements_out: settlementsOut, net, by_professional: byProfessional };
    });

    // Totais por profissional (para aba individual)
    const byProfessional = professionals.map(prof => {
      const profRecords = recordsRes.rows.filter(r => r.professional_id === prof.id);
      const profSettlements = settlementsRes.rows.filter(r => r.professional_id === prof.id);
      const gross = profRecords.reduce((s,r) => s + parseFloat(r.gross), 0);
      const pct = prof.repasse_percentual != null ? parseFloat(prof.repasse_percentual) : 100;
      const repasse = gross * pct / 100;
      const settlementsIn  = profSettlements.filter(s => s.type==='a_pagar').reduce((s,r)=>s+parseFloat(r.value),0);
      const settlementsOut = profSettlements.filter(s => s.type==='a_receber').reduce((s,r)=>s+parseFloat(r.value),0);
      const net = repasse + settlementsIn - settlementsOut;

      const dailyRows = days.map(day => {
        const dr = profRecords.filter(r => String(r.day).slice(0,10) === String(day).slice(0,10));
        const ds = profSettlements.filter(r => String(r.day).slice(0,10) === String(day).slice(0,10));
        const dg = dr.reduce((s,r)=>s+parseFloat(r.gross),0);
        const si = ds.filter(s=>s.type==='a_pagar').reduce((s,r)=>s+parseFloat(r.value),0);
        const so = ds.filter(s=>s.type==='a_receber').reduce((s,r)=>s+parseFloat(r.value),0);
        return { day, count: dr.reduce((s,r)=>s+parseInt(r.count),0), gross: dg, repasse: dg*pct/100, settlements_in: si, settlements_out: so, net: dg*pct/100 + si - so };
      }).filter(r => r.count > 0 || r.settlements_in > 0 || r.settlements_out > 0);

      return { professional_id: prof.id, professional_name: prof.name, repasse_percent: pct, gross, repasse, settlements_in: settlementsIn, settlements_out: settlementsOut, net, daily_rows: dailyRows };
    }).filter(p => p.gross > 0 || p.settlements_in > 0 || p.settlements_out > 0);

    const totals = {
      gross:          rows.reduce((s,r)=>s+r.gross, 0),
      repasse:        rows.reduce((s,r)=>s+r.repasse, 0),
      settlements_in: rows.reduce((s,r)=>s+r.settlements_in, 0),
      settlements_out:rows.reduce((s,r)=>s+r.settlements_out, 0),
      rentals:        totalRentals,
      net:            rows.reduce((s,r)=>s+r.net, 0) - totalRentals,
    };

    res.json({ year: y, month: m, days: rows, by_professional: byProfessional, totals, rentals: rentalsRes.rows });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/settlements/bank-statement/export?year=&month= — exporta XLSX
router.get('/bank-statement/export', auth, async (req, res) => {
  const ExcelJS = require('exceljs');
  const clinic_id = req.user.clinic_id;
  const y = parseInt(req.query.year)  || new Date().getFullYear();
  const m = parseInt(req.query.month) || new Date().getMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2,'0')}-01`;
  const monthEnd   = new Date(y, m, 0).toISOString().split('T')[0];
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  try {
    const clinicRes = await pool.query('SELECT name FROM clinics WHERE id=$1', [clinic_id]);
    const clinicName = clinicRes.rows[0]?.name || 'Clínica';

    const [profRes, recordsRes, settlementsRes, rentalsRes] = await Promise.all([
      pool.query(`SELECT id, name, repasse_percentual FROM professionals WHERE clinic_id=$1 ORDER BY name`, [clinic_id]),
      pool.query(`
        SELECT mr.professional_id, mr.consultation_date::date as day,
               COUNT(*) as count, COALESCE(SUM(mrp.value),0) as gross
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id=$1 AND mr.consultation_date::date BETWEEN $2 AND $3
        GROUP BY mr.professional_id, mr.consultation_date::date ORDER BY day
      `, [clinic_id, monthStart, monthEnd]),
      pool.query(`
        SELECT professional_id, date::date as day, type, SUM(value) as value
        FROM financial_settlements
        WHERE clinic_id=$1 AND date::date BETWEEN $2 AND $3
        GROUP BY professional_id, date::date, type ORDER BY day
      `, [clinic_id, monthStart, monthEnd]),
      pool.query(`SELECT value, tenant_name FROM rentals WHERE clinic_id=$1 AND status='active' AND start_date<=$3 AND (end_date IS NULL OR end_date>=$2)`, [clinic_id, monthStart, monthEnd]),
    ]);

    const professionals = profRes.rows;
    const profMap = Object.fromEntries(professionals.map(p => [p.id, p]));
    const totalRentals = rentalsRes.rows.reduce((s,r)=>s+parseFloat(r.value),0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'P. Soluções para Saúde';

    // ── Aba 1: Consolidado ────────────────────────────────────────────────────
    const ws1 = workbook.addWorksheet('Consolidado');
    const blue = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1A5276'} };
    const lightBlue = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD6EAF8'} };
    const lightGray = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F3F4'} };
    const green = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1E8449'} };

    ws1.mergeCells('A1:G1');
    const titleCell = ws1.getCell('A1');
    titleCell.value = `${clinicName} — Extrato Mensal Consolidado — ${monthNames[m-1]}/${y}`;
    titleCell.font = { bold:true, size:14, color:{argb:'FFFFFFFF'} };
    titleCell.fill = blue;
    titleCell.alignment = { horizontal:'center', vertical:'middle' };
    ws1.getRow(1).height = 30;

    ws1.getRow(3).values = ['Data','Atendimentos','Receita Bruta','Repasse Profissionais','Acertos Entrada','Acertos Saída','Líquido do Dia'];
    ws1.getRow(3).eachCell(cell => {
      cell.font = { bold:true, size:11, color:{argb:'FF1A2535'} };
      cell.fill = lightBlue;
      cell.border = { bottom:{style:'thin',color:{argb:'FFCCCCCC'}} };
      cell.alignment = { horizontal:'center' };
    });
    ws1.columns = [
      {key:'date', width:14},{key:'count',width:16},{key:'gross',width:18},
      {key:'repasse',width:24},{key:'si',width:18},{key:'so',width:16},{key:'net',width:18}
    ];

    const daySet = new Set();
    recordsRes.rows.forEach(r => daySet.add(String(r.day).slice(0,10)));
    settlementsRes.rows.forEach(r => daySet.add(String(r.day).slice(0,10)));
    const days = Array.from(daySet).sort();

    let rowIdx = 4;
    let totGross=0, totRepasse=0, totSI=0, totSO=0, totNet=0, totCount=0;
    days.forEach((day, i) => {
      const dr = recordsRes.rows.filter(r=>String(r.day).slice(0,10)===day);
      const ds = settlementsRes.rows.filter(r=>String(r.day).slice(0,10)===day);
      const gross = dr.reduce((s,r)=>s+parseFloat(r.gross),0);
      const si = ds.filter(s=>s.type==='a_pagar').reduce((s,r)=>s+parseFloat(r.value),0);
      const so = ds.filter(s=>s.type==='a_receber').reduce((s,r)=>s+parseFloat(r.value),0);
      const count = dr.reduce((s,r)=>s+parseInt(r.count),0);
      let repasse = 0;
      dr.forEach(r=>{ const p=profMap[r.professional_id]; const pct=p?.repasse_percentual!=null?parseFloat(p.repasse_percentual):100; repasse+=parseFloat(r.gross)*pct/100; });
      const net = gross - repasse + si - so;
      totGross+=gross; totRepasse+=repasse; totSI+=si; totSO+=so; totNet+=net; totCount+=count;

      const row = ws1.getRow(rowIdx++);
      row.values = [day, count, gross, repasse, si, so, net];
      if (i%2===0) row.eachCell(c=>c.fill=lightGray);
      row.getCell(3).numFmt = 'R$ #,##0.00';
      row.getCell(4).numFmt = 'R$ #,##0.00';
      row.getCell(5).numFmt = 'R$ #,##0.00';
      row.getCell(6).numFmt = 'R$ #,##0.00';
      row.getCell(7).numFmt = 'R$ #,##0.00';
    });

    // Linha de aluguéis
    if (totalRentals > 0) {
      const rRow = ws1.getRow(rowIdx++);
      rRow.values = ['Aluguéis', '', '', '', '', '', -totalRentals];
      rRow.eachCell(c=>{ c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF3CD'}}; c.font={italic:true}; });
      rRow.getCell(7).numFmt = 'R$ #,##0.00';
    }

    // Totais
    const totRow = ws1.getRow(rowIdx);
    totRow.values = ['TOTAL', totCount, totGross, totRepasse, totSI, totSO, totNet - totalRentals];
    totRow.eachCell(c=>{ c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill=green; });
    totRow.getCell(3).numFmt = 'R$ #,##0.00';
    totRow.getCell(4).numFmt = 'R$ #,##0.00';
    totRow.getCell(5).numFmt = 'R$ #,##0.00';
    totRow.getCell(6).numFmt = 'R$ #,##0.00';
    totRow.getCell(7).numFmt = 'R$ #,##0.00';

    // ── Aba por profissional ──────────────────────────────────────────────────
    professionals.forEach(prof => {
      const pr = recordsRes.rows.filter(r=>r.professional_id===prof.id);
      const ps = settlementsRes.rows.filter(r=>r.professional_id===prof.id);
      if (!pr.length && !ps.length) return;
      const pct = prof.repasse_percentual!=null?parseFloat(prof.repasse_percentual):100;

      const ws = workbook.addWorksheet(prof.name.slice(0,31));
      ws.mergeCells('A1:F1');
      const t = ws.getCell('A1');
      t.value = `${prof.name} — ${monthNames[m-1]}/${y} — Repasse: ${pct}%`;
      t.font={bold:true,size:13,color:{argb:'FFFFFFFF'}}; t.fill=blue; t.alignment={horizontal:'center',vertical:'middle'};
      ws.getRow(1).height=28;

      ws.getRow(3).values=['Data','Atendimentos','Receita Bruta','Repasse','Acertos Entrada','Acertos Saída','Líquido'];
      ws.getRow(3).eachCell(c=>{ c.font={bold:true}; c.fill=lightBlue; c.alignment={horizontal:'center'}; });
      ws.columns=[{key:'d',width:14},{key:'c',width:16},{key:'g',width:18},{key:'r',width:16},{key:'si',width:18},{key:'so',width:16},{key:'n',width:16}];

      let ri=4,tg=0,tr=0,tsi=0,tso=0,tn=0,tc=0;
      const profDays = new Set();
      pr.forEach(r=>profDays.add(String(r.day).slice(0,10)));
      ps.forEach(r=>profDays.add(String(r.day).slice(0,10)));

      Array.from(profDays).sort().forEach((day,i)=>{
        const dr=pr.filter(r=>String(r.day).slice(0,10)===day);
        const ds=ps.filter(r=>String(r.day).slice(0,10)===day);
        const g=dr.reduce((s,r)=>s+parseFloat(r.gross),0);
        const rep=g*pct/100;
        const si=ds.filter(s=>s.type==='a_pagar').reduce((s,r)=>s+parseFloat(r.value),0);
        const so=ds.filter(s=>s.type==='a_receber').reduce((s,r)=>s+parseFloat(r.value),0);
        const cnt=dr.reduce((s,r)=>s+parseInt(r.count),0);
        const n=rep+si-so;
        tg+=g; tr+=rep; tsi+=si; tso+=so; tn+=n; tc+=cnt;
        const row=ws.getRow(ri++);
        row.values=[day,cnt,g,rep,si,so,n];
        if(i%2===0)row.eachCell(c=>c.fill=lightGray);
        [3,4,5,6,7].forEach(ci=>row.getCell(ci).numFmt='R$ #,##0.00');
      });

      const tr2=ws.getRow(ri);
      tr2.values=['TOTAL',tc,tg,tr,tsi,tso,tn];
      tr2.eachCell(c=>{ c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill=green; });
      [3,4,5,6,7].forEach(ci=>tr2.getCell(ci).numFmt='R$ #,##0.00');
    });

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="extrato-${y}-${String(m).padStart(2,'0')}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch(err) {
    console.error('[Excel Export]', err);
    res.status(500).json({ error: err.message });
  }
});


// Enviar extrato por email
router.post('/statement/:professional_id/send-email', auth, async (req, res) => {
  const { html, year, month, professional_name, professional_email } = req.body;
  if (!professional_email) return res.status(400).json({ error: 'Profissional não tem email cadastrado' });

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  try {
    await resend.emails.send({
      from: 'P. Soluções para Saúde <noreply@psaude.ia.br>',
      to: professional_email,
      subject: `Extrato Financeiro — ${MONTHS[month - 1]}/${year}`,
      html,
    });
    res.json({ message: 'Email enviado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar email: ' + err.message });
  }
});

// GET /api/settlements/admin-report?year=&month= — relatório admin (todas as clínicas)
router.get('/admin-report', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin master' });
  const y = parseInt(req.query.year)  || new Date().getFullYear();
  const m = parseInt(req.query.month) || new Date().getMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2,'0')}-01`;
  const monthEnd   = new Date(y, m, 0).toISOString().split('T')[0];

  try {
    const [clinicsRes, recordsRes, settlementsRes, usersRes, trialsRes, msgRes] = await Promise.all([
      pool.query(`SELECT id, name FROM clinics ORDER BY name`),
      pool.query(`
        SELECT mr.clinic_id,
               COUNT(*) as appointments,
               COALESCE(SUM(mrp.value), 0) as gross
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.consultation_date::date BETWEEN $1 AND $2
        GROUP BY mr.clinic_id
      `, [monthStart, monthEnd]),
      pool.query(`
        SELECT clinic_id, type, SUM(value) as total
        FROM financial_settlements
        WHERE date::date BETWEEN $1 AND $2
        GROUP BY clinic_id, type
      `, [monthStart, monthEnd]),
      pool.query(`SELECT clinic_id, COUNT(*) as count FROM users WHERE is_trial=false GROUP BY clinic_id`),
      pool.query(`SELECT clinic_id, COUNT(*) as count, MAX(trial_starts_at) as last_trial,
                         SUM(CASE WHEN trial_blocked_at IS NOT NULL THEN 1 ELSE 0 END) as blocked
                  FROM users WHERE is_trial=true GROUP BY clinic_id`),
      pool.query(`
        SELECT clinic_id, channel, COUNT(*) as total
        FROM message_log
        WHERE EXTRACT(YEAR FROM sent_at)=$1 AND EXTRACT(MONTH FROM sent_at)=$2
        GROUP BY clinic_id, channel
      `, [y, m]),
    ]);

    const clinics = clinicsRes.rows;
    const recordMap = Object.fromEntries(recordsRes.rows.map(r => [r.clinic_id, r]));
    const settMap = {};
    settlementsRes.rows.forEach(r => {
      if (!settMap[r.clinic_id]) settMap[r.clinic_id] = {};
      settMap[r.clinic_id][r.type] = parseFloat(r.total);
    });
    const userMap = Object.fromEntries(usersRes.rows.map(r => [r.clinic_id, parseInt(r.count)]));
    const trialMap = Object.fromEntries(trialsRes.rows.map(r => [r.clinic_id, r]));
    const msgMap = {};
    msgRes.rows.forEach(r => {
      if (!msgMap[r.clinic_id]) msgMap[r.clinic_id] = {};
      msgMap[r.clinic_id][r.channel] = parseInt(r.total);
    });

    const rows = clinics.map(c => {
      const rec = recordMap[c.id] || { appointments: 0, gross: 0 };
      const sett = settMap[c.id] || {};
      const trial = trialMap[c.id];
      const msg = msgMap[c.id] || {};
      return {
        clinic_id: c.id,
        clinic_name: c.name,
        appointments: parseInt(rec.appointments) || 0,
        gross: parseFloat(rec.gross) || 0,
        settlements_in:  sett['a_pagar']    || 0,
        settlements_out: sett['a_receber']  || 0,
        active_users: userMap[c.id] || 0,
        trial_count: parseInt(trial?.count) || 0,
        trial_blocked: parseInt(trial?.blocked) || 0,
        emails_sent: msg['email'] || 0,
        whatsapp_sent: msg['whatsapp'] || 0,
      };
    }).filter(r => r.appointments > 0 || r.gross > 0 || r.active_users > 0 || r.trial_count > 0);

    const totals = rows.reduce((acc, r) => ({
      appointments:    acc.appointments    + r.appointments,
      gross:           acc.gross           + r.gross,
      settlements_in:  acc.settlements_in  + r.settlements_in,
      settlements_out: acc.settlements_out + r.settlements_out,
      active_users:    acc.active_users    + r.active_users,
      trial_count:     acc.trial_count     + r.trial_count,
      trial_blocked:   acc.trial_blocked   + r.trial_blocked,
      emails_sent:     acc.emails_sent     + r.emails_sent,
      whatsapp_sent:   acc.whatsapp_sent   + r.whatsapp_sent,
    }), { appointments:0, gross:0, settlements_in:0, settlements_out:0, active_users:0, trial_count:0, trial_blocked:0, emails_sent:0, whatsapp_sent:0 });

    res.json({ year: y, month: m, clinics: rows, totals });
  } catch(err) { res.status(500).json({ error: err.message }); }
});


module.exports = router;
