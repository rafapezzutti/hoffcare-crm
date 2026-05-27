const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/reports/monthly-excel?month=2025-05
router.get('/monthly-excel', auth, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split('-');
  const clinicId = req.user.clinic_id;

  try {
    const clinicRes = await pool.query('SELECT name FROM clinics WHERE id=$1', [clinicId]);
    const clinicName = clinicRes.rows[0]?.name || 'Clínica';

    // Atendimentos do mês
    const records = await pool.query(
      `SELECT mr.id, mr.consultation_date, mr.total_value, mr.type,
              p.name as patient_name, p.cpf as patient_cpf,
              pr.name as professional_name
       FROM medical_records mr
       JOIN patients p ON mr.patient_id = p.id
       LEFT JOIN professionals pr ON mr.professional_id = pr.id
       WHERE mr.clinic_id=$1
         AND DATE_TRUNC('month', mr.consultation_date) = DATE_TRUNC('month', $2::date)
       ORDER BY mr.consultation_date, mr.id`,
      [clinicId, `${year}-${mon}-01`]
    );

    // Agendamentos do mês
    const appointments = await pool.query(
      `SELECT a.id, a.appointment_date, a.status, a.type,
              p.name as patient_name,
              pr.name as professional_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN professionals pr ON a.professional_id = pr.id
       WHERE a.clinic_id=$1
         AND DATE_TRUNC('month', a.appointment_date) = DATE_TRUNC('month', $2::date)
       ORDER BY a.appointment_date`,
      [clinicId, `${year}-${mon}-01`]
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'P. Soluções para Saúde';

    // ── Aba 1: Atendimentos ───────────────────────────────────────
    const wsRec = wb.addWorksheet('Atendimentos');
    wsRec.mergeCells('A1:G1');
    wsRec.getCell('A1').value = `${clinicName} — Atendimentos ${mon}/${year}`;
    wsRec.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF4DB8E8' } };
    wsRec.getCell('A1').alignment = { horizontal: 'center' };

    wsRec.getRow(2).values = ['#', 'Data', 'Paciente', 'CPF', 'Profissional', 'Tipo', 'Valor (R$)'];
    wsRec.getRow(2).font = { bold: true };
    wsRec.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4DB8E8' } };
    wsRec.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    let totalRec = 0;
    records.rows.forEach((r, i) => {
      wsRec.addRow([
        r.id,
        new Date(r.consultation_date).toLocaleDateString('pt-BR'),
        r.patient_name,
        r.patient_cpf || '—',
        r.professional_name || '—',
        r.type === 'medico' ? 'Médico' : 'Odonto',
        parseFloat(r.total_value) || 0,
      ]);
      totalRec += parseFloat(r.total_value) || 0;
      if (i % 2 === 0) wsRec.lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
    });

    const totalRowRec = wsRec.addRow(['', '', '', '', '', 'TOTAL', totalRec]);
    totalRowRec.font = { bold: true };
    totalRowRec.getCell(7).numFmt = 'R$ #,##0.00';

    wsRec.columns = [
      { width: 8 }, { width: 14 }, { width: 30 }, { width: 16 },
      { width: 24 }, { width: 12 }, { width: 14 },
    ];
    wsRec.getColumn(7).numFmt = 'R$ #,##0.00';

    // ── Aba 2: Agendamentos ───────────────────────────────────────
    const wsApp = wb.addWorksheet('Agendamentos');
    wsApp.mergeCells('A1:F1');
    wsApp.getCell('A1').value = `${clinicName} — Agendamentos ${mon}/${year}`;
    wsApp.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFE8841A' } };
    wsApp.getCell('A1').alignment = { horizontal: 'center' };

    wsApp.getRow(2).values = ['#', 'Data/Hora', 'Paciente', 'Profissional', 'Tipo', 'Status'];
    wsApp.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8841A' } };
    wsApp.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const statusMap = { scheduled: 'Agendado', completed: 'Realizado', cancelled: 'Cancelado' };
    appointments.rows.forEach((a, i) => {
      wsApp.addRow([
        a.id,
        new Date(a.appointment_date).toLocaleString('pt-BR'),
        a.patient_name,
        a.professional_name || '—',
        a.type === 'medico' ? 'Médico' : 'Odonto',
        statusMap[a.status] || a.status,
      ]);
      if (i % 2 === 0) wsApp.lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8F0' } };
    });

    wsApp.columns = [
      { width: 8 }, { width: 22 }, { width: 30 }, { width: 24 }, { width: 12 }, { width: 14 },
    ];

    // ── Aba 3: Resumo ─────────────────────────────────────────────
    const wsSum = wb.addWorksheet('Resumo');
    wsSum.getCell('A1').value = `Resumo — ${mon}/${year}`;
    wsSum.getCell('A1').font = { bold: true, size: 16 };
    wsSum.addRow([]);
    wsSum.addRow(['Clínica', clinicName]);
    wsSum.addRow(['Período', `${mon}/${year}`]);
    wsSum.addRow(['Total de Atendimentos', records.rows.length]);
    wsSum.addRow(['Receita Total', totalRec]);
    wsSum.getCell('B7').numFmt = 'R$ #,##0.00';
    wsSum.addRow(['Total de Agendamentos', appointments.rows.length]);
    wsSum.addRow(['Realizados', appointments.rows.filter(a => a.status === 'completed').length]);
    wsSum.addRow(['Cancelados', appointments.rows.filter(a => a.status === 'cancelled').length]);
    wsSum.columns = [{ width: 28 }, { width: 22 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio_${clinicName.replace(/\s/g,'_')}_${month}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Reports] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
