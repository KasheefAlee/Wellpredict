const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);
// RBAC: dashboard analytics are intended for privileged roles (manager/admin/hr)
router.use(requireRole('manager', 'admin', 'hr'));

// Get team burnout overview
router.get('/team/:teamId/overview', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { period = 'week', startDate, endDate } = req.query;
    
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
    let dateParams = [teamId];
    let paramCount = 2;
    
    if (startDate && endDate) {
      dateFilter = `AND submitted_at >= $${paramCount++} AND submitted_at <= $${paramCount++}`;
      dateParams.push(startDate, endDate);
    } else if (period === 'week') {
      dateFilter = `AND submitted_at >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateFilter = `AND submitted_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    // Get average burnout score
    const avgResult = await pool.query(
      `SELECT 
        AVG(burnout_score) as avg_burnout,
        COUNT(*) as total_checkins,
        COUNT(DISTINCT DATE(submitted_at)) as active_days
       FROM check_ins
       WHERE team_id = $1 ${dateFilter}`,
      dateParams
    );
    
    // Get risk level distribution
    const riskResult = await pool.query(
      `SELECT 
        risk_level,
        COUNT(*)::int as count,
        AVG(burnout_score) as avg_score
       FROM check_ins
       WHERE team_id = $1 ${dateFilter}
       GROUP BY risk_level
       ORDER BY 
         CASE risk_level
           WHEN 'low' THEN 1
           WHEN 'moderate' THEN 2
           WHEN 'high' THEN 3
           WHEN 'critical' THEN 4
         END`,
      dateParams
    );
    
    // Get trend data (last 12 weeks/months)
    let trendQuery;
    if (period === 'week') {
      trendQuery = `
        SELECT 
          year,
          week_number,
          AVG(burnout_score) as avg_burnout,
          COUNT(*) as checkin_count
        FROM check_ins
        WHERE team_id = $1
        GROUP BY year, week_number
        ORDER BY year DESC, week_number DESC
        LIMIT 12
      `;
    } else {
      trendQuery = `
        SELECT 
          year,
          month_number,
          AVG(burnout_score) as avg_burnout,
          COUNT(*) as checkin_count
        FROM check_ins
        WHERE team_id = $1
        GROUP BY year, month_number
        ORDER BY year DESC, month_number DESC
        LIMIT 12
      `;
    }
    
    const trendResult = await pool.query(trendQuery, [teamId]);
    
    res.json({
      team: teamResult.rows[0],
      overview: {
        average_burnout: parseFloat(avgResult.rows[0].avg_burnout || 0).toFixed(2),
        total_checkins: parseInt(avgResult.rows[0].total_checkins || 0),
        active_days: parseInt(avgResult.rows[0].active_days || 0)
      },
      risk_distribution: riskResult.rows,
      trends: trendResult.rows.reverse() // Reverse to show chronological order
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get attendance vs burnout correlation
router.get('/team/:teamId/correlation', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Verify team access
    let teamQuery = 'SELECT id FROM teams WHERE id = $1 AND is_active = TRUE';
    let teamParams = [teamId];
    
    if (req.user.role === 'manager') {
      teamQuery += ' AND manager_id = $2';
      teamParams.push(req.user.id);
    }
    
    const teamResult = await pool.query(teamQuery, teamParams);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }
    
    // Build date filter (apply separately to attendance + check-ins)
    let attendanceDateFilter = '';
    let checkinDateFilter = '';
    let params = [teamId];
    let paramCount = 2;

    if (startDate && endDate) {
      attendanceDateFilter = `AND a.date >= $${paramCount++} AND a.date <= $${paramCount++}`;
      checkinDateFilter = `AND c.submitted_at >= $${paramCount++} AND c.submitted_at <= $${paramCount++}`;
      // Use same bounds for both
      params.push(startDate, endDate, startDate, endDate);
    } else {
      attendanceDateFilter = `AND a.date >= CURRENT_DATE - INTERVAL '30 days'`;
      checkinDateFilter = `AND c.submitted_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    // Weekly correlation: absence rate (per record) vs weekly burnout average
    const correlationQuery = `
      WITH att AS (
        SELECT
          DATE_TRUNC('week', a.date)::date AS week_start,
          COUNT(*) AS total_records,
          SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_records
        FROM attendance a
        WHERE a.team_id = $1 ${attendanceDateFilter}
        GROUP BY 1
      ),
      ci AS (
        SELECT
          DATE_TRUNC('week', c.submitted_at)::date AS week_start,
          AVG(c.burnout_score) AS avg_burnout,
          COUNT(*) AS checkin_count
        FROM check_ins c
        WHERE c.team_id = $1 ${checkinDateFilter}
        GROUP BY 1
      )
      SELECT
        att.week_start,
        att.total_records,
        att.absent_records,
        ROUND((((att.absent_records::numeric / NULLIF(att.total_records, 0)) * 100))::numeric, 1) AS absence_rate,
        ci.avg_burnout,
        COALESCE(ci.checkin_count, 0) AS checkin_count
      FROM att
      LEFT JOIN ci USING (week_start)
      ORDER BY att.week_start DESC
      LIMIT 12
    `;

    const correlationResult = await pool.query(correlationQuery, params);

    // Correlation coefficient (Pearson r) using only weeks that have BOTH attendance and check-ins
    const corrQuery = `
      WITH att AS (
        SELECT
          DATE_TRUNC('week', a.date)::date AS week_start,
          COUNT(*) AS total_records,
          SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_records
        FROM attendance a
        WHERE a.team_id = $1 ${attendanceDateFilter}
        GROUP BY 1
      ),
      ci AS (
        SELECT
          DATE_TRUNC('week', c.submitted_at)::date AS week_start,
          AVG(c.burnout_score) AS avg_burnout
        FROM check_ins c
        WHERE c.team_id = $1 ${checkinDateFilter}
        GROUP BY 1
      ),
      joined AS (
        SELECT
          att.week_start,
          ((att.absent_records::double precision / NULLIF(att.total_records, 0)) * 100.0) AS absence_rate,
          ci.avg_burnout::double precision AS avg_burnout
        FROM att
        JOIN ci USING (week_start)
        WHERE att.total_records > 0 AND ci.avg_burnout IS NOT NULL
      )
      SELECT
        corr(joined.avg_burnout, joined.absence_rate) AS r,
        COUNT(*)::int AS points
      FROM joined
    `;
    const corrRes = await pool.query(corrQuery, params);

    // Overall summary (same semantics)
    const overallQuery = `
      WITH att AS (
        SELECT
          COUNT(*) AS total_records,
          SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_records
        FROM attendance a
        WHERE a.team_id = $1 ${attendanceDateFilter}
      ),
      ci AS (
        SELECT AVG(c.burnout_score) AS avg_burnout
        FROM check_ins c
        WHERE c.team_id = $1 ${checkinDateFilter}
      )
      SELECT
        ROUND((att.absent_records::float / NULLIF(att.total_records, 0))::numeric, 4) AS absence_rate,
        ci.avg_burnout
      FROM att, ci
    `;

    const overallResult = await pool.query(overallQuery, params);
    
    res.json({
      weekly_correlation: correlationResult.rows,
      correlation: {
        r: corrRes.rows[0]?.r ?? null,
        points: corrRes.rows[0]?.points ?? 0
      },
      overall: {
        absence_rate: parseFloat(overallResult.rows[0].absence_rate || 0).toFixed(4),
        average_burnout: parseFloat(overallResult.rows[0].avg_burnout || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Correlation error:', error);
    res.status(500).json({ error: 'Failed to fetch correlation data' });
  }
});

// Get check-in activity heatmap
router.get('/team/:teamId/activity', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Verify team access
    let teamQuery = 'SELECT id FROM teams WHERE id = $1 AND is_active = TRUE';
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
      dateFilter = `AND DATE(submitted_at) >= $${paramCount++} AND DATE(submitted_at) <= $${paramCount++}`;
      params.push(startDate, endDate);
    } else {
      dateFilter = `AND submitted_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    // Get daily activity
    const activityQuery = `
      SELECT 
        DATE(submitted_at) as date,
        COUNT(*) as checkin_count,
        AVG(burnout_score) as avg_burnout
      FROM check_ins
      WHERE team_id = $1 ${dateFilter}
      GROUP BY DATE(submitted_at)
      ORDER BY date DESC
    `;
    
    const activityResult = await pool.query(activityQuery, params);
    
    res.json({
      activity: activityResult.rows
    });
  } catch (error) {
    console.error('Activity heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch activity data' });
  }
});

module.exports = router;

