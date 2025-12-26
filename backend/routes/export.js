const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Export CSV
router.get('/team/:teamId/csv', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Verify team access
    let teamQuery = 'SELECT id, team_code, team_name FROM teams WHERE id = $1 AND is_active = TRUE';
    let teamParams = [teamId];
    
    if (req.user.role === 'manager') {
      teamQuery += ' AND manager_id = $2';
      teamParams.push(req.user.id);
    }
    
    const teamResult = await pool.query(teamQuery, teamParams);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }
    
    // Build date filter
    let dateFilter = '';
    let params = [teamId];
    let paramCount = 2;
    
    if (startDate && endDate) {
      dateFilter = `AND submitted_at >= $${paramCount++} AND submitted_at <= $${paramCount++}`;
      params.push(startDate, endDate);
    }
    
    // Get check-in data
    const checkinsQuery = `
      SELECT 
        submitted_at,
        workload,
        stress,
        sleep,
        engagement,
        recovery,
        burnout_score,
        risk_level
      FROM check_ins
      WHERE team_id = $1 ${dateFilter}
      ORDER BY submitted_at DESC
    `;
    
    const checkinsResult = await pool.query(checkinsQuery, params);
    
    // Generate CSV
    const headers = [
      'Date',
      'Workload',
      'Stress',
      'Sleep',
      'Engagement',
      'Recovery',
      'Burnout Score',
      'Risk Level'
    ];
    
    const rows = checkinsResult.rows.map(row => [
      row.submitted_at.toISOString().split('T')[0],
      row.workload,
      row.stress,
      row.sleep,
      row.engagement,
      row.recovery,
      row.burnout_score,
      row.risk_level
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="burnout_data_${teamResult.rows[0].team_code}_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Export Excel
router.get('/team/:teamId/excel', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Verify team access
    let teamQuery = 'SELECT id, team_code, team_name FROM teams WHERE id = $1 AND is_active = TRUE';
    let teamParams = [teamId];
    
    if (req.user.role === 'manager') {
      teamQuery += ' AND manager_id = $2';
      teamParams.push(req.user.id);
    }
    
    const teamResult = await pool.query(teamQuery, teamParams);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }
    
    const team = teamResult.rows[0];
    
    // Build date filter
    let dateFilter = '';
    let params = [teamId];
    let paramCount = 2;
    
    if (startDate && endDate) {
      dateFilter = `AND submitted_at >= $${paramCount++} AND submitted_at <= $${paramCount++}`;
      params.push(startDate, endDate);
    }
    
    // Get check-in data
    const checkinsQuery = `
      SELECT 
        submitted_at,
        workload,
        stress,
        sleep,
        engagement,
        recovery,
        burnout_score,
        risk_level
      FROM check_ins
      WHERE team_id = $1 ${dateFilter}
      ORDER BY submitted_at DESC
    `;
    
    const checkinsResult = await pool.query(checkinsQuery, params);
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        AVG(burnout_score) as avg_burnout,
        COUNT(*) as total_checkins,
        COUNT(DISTINCT DATE(submitted_at)) as active_days,
        SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN risk_level = 'moderate' THEN 1 ELSE 0 END) as moderate_count,
        SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_count
      FROM check_ins
      WHERE team_id = $1 ${dateFilter}
    `;
    
    const summaryResult = await pool.query(summaryQuery, params);
    const summary = summaryResult.rows[0];
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Team Wellbeing Report']);
    summarySheet.addRow(['Team Code:', team.team_code]);
    summarySheet.addRow(['Team Name:', team.team_name]);
    summarySheet.addRow(['Generated:', new Date().toISOString()]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Statistics']);
    summarySheet.addRow(['Average Burnout Score:', parseFloat(summary.avg_burnout || 0).toFixed(2)]);
    summarySheet.addRow(['Total Check-ins:', summary.total_checkins]);
    summarySheet.addRow(['Active Days:', summary.active_days]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Risk Level Distribution']);
    summarySheet.addRow(['Critical:', summary.critical_count]);
    summarySheet.addRow(['High:', summary.high_count]);
    summarySheet.addRow(['Moderate:', summary.moderate_count]);
    summarySheet.addRow(['Low:', summary.low_count]);
    
    // Data sheet
    const dataSheet = workbook.addWorksheet('Check-in Data');
    dataSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Workload', key: 'workload', width: 10 },
      { header: 'Stress', key: 'stress', width: 10 },
      { header: 'Sleep', key: 'sleep', width: 10 },
      { header: 'Engagement', key: 'engagement', width: 12 },
      { header: 'Recovery', key: 'recovery', width: 10 },
      { header: 'Burnout Score', key: 'burnout_score', width: 15 },
      { header: 'Risk Level', key: 'risk_level', width: 15 }
    ];
    
    checkinsResult.rows.forEach(row => {
      dataSheet.addRow({
        date: row.submitted_at.toISOString().split('T')[0],
        workload: row.workload,
        stress: row.stress,
        sleep: row.sleep,
        engagement: row.engagement,
        recovery: row.recovery,
        burnout_score: parseFloat(row.burnout_score).toFixed(2),
        risk_level: row.risk_level
      });
    });
    
    // Style header row
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="wellbeing_report_${team.team_code}_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

// Export PDF (simplified - generates HTML and converts to PDF)
router.get('/team/:teamId/pdf', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Verify team access
    let teamQuery = 'SELECT id, team_code, team_name FROM teams WHERE id = $1 AND is_active = TRUE';
    let teamParams = [teamId];
    
    if (req.user.role === 'manager') {
      teamQuery += ' AND manager_id = $2';
      teamParams.push(req.user.id);
    }
    
    const teamResult = await pool.query(teamQuery, teamParams);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }
    
    const team = teamResult.rows[0];
    
    // Build date filter
    let dateFilter = '';
    let params = [teamId];
    let paramCount = 2;
    
    if (startDate && endDate) {
      dateFilter = `AND submitted_at >= $${paramCount++} AND submitted_at <= $${paramCount++}`;
      params.push(startDate, endDate);
    }
    
    // Get summary data
    const summaryQuery = `
      SELECT 
        AVG(burnout_score) as avg_burnout,
        COUNT(*) as total_checkins,
        COUNT(DISTINCT DATE(submitted_at)) as active_days,
        SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN risk_level = 'moderate' THEN 1 ELSE 0 END) as moderate_count,
        SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_count
      FROM check_ins
      WHERE team_id = $1 ${dateFilter}
    `;
    
    const summaryResult = await pool.query(summaryQuery, params);
    const summary = summaryResult.rows[0];
    
    // Generate HTML report
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Wellbeing Report - ${team.team_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .stat { margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Employee Wellbeing Report</h1>
        <div class="summary">
          <h2>Team Information</h2>
          <p><strong>Team Code:</strong> ${team.team_code}</p>
          <p><strong>Team Name:</strong> ${team.team_name}</p>
          <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div class="summary">
          <h2>Summary Statistics</h2>
          <div class="stat"><strong>Average Burnout Score:</strong> ${parseFloat(summary.avg_burnout || 0).toFixed(2)}/100</div>
          <div class="stat"><strong>Total Check-ins:</strong> ${summary.total_checkins}</div>
          <div class="stat"><strong>Active Days:</strong> ${summary.active_days}</div>
        </div>
        <div class="summary">
          <h2>Risk Level Distribution</h2>
          <div class="stat"><strong>Critical:</strong> ${summary.critical_count}</div>
          <div class="stat"><strong>High:</strong> ${summary.high_count}</div>
          <div class="stat"><strong>Moderate:</strong> ${summary.moderate_count}</div>
          <div class="stat"><strong>Low:</strong> ${summary.low_count}</div>
        </div>
        <div class="footer">
          <p>This report contains aggregated, anonymous data. No individual employee information is included.</p>
          <p>Generated by Employee Wellbeing & Burnout Monitoring Platform</p>
        </div>
      </body>
      </html>
    `;
    
    /**
     * Render containers usually require --no-sandbox flags for Chromium.
     * Lazy-load puppeteer so the service can still boot even if PDF export
     * dependencies are unavailable in some environments.
     */
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      return res.status(501).json({
        error: 'PDF export is not available in this environment (puppeteer not installed)'
      });
    }

    // Convert HTML to PDF using Puppeteer (Render-safe defaults)
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wellbeing_report_${team.team_code}_${Date.now()}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;

