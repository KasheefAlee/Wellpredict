const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateRecommendations, getRiskLevelLabel } = require('../utils/recommendations');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('manager', 'admin'));

function formatTimeAgo(date) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

// Burnout recommendations for a manager's team
router.get('/recommendations/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { period = 'week', startDate, endDate } = req.query;

    // Verify team access for managers
    let teamQuery = 'SELECT id, team_code, team_name FROM teams WHERE id = $1 AND is_active = TRUE';
    const params = [teamId];

    if (req.user.role === 'manager') {
      teamQuery += ' AND manager_id = $2';
      params.push(req.user.id);
    }

    const teamResult = await pool.query(teamQuery, params);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }

    // Match the dashboard semantics: use a period average score for recommendations
    let dateFilter = '';
    const scoreParams = [teamId];
    let paramCount = 2;

    if (startDate && endDate) {
      dateFilter = `AND submitted_at >= $${paramCount++} AND submitted_at <= $${paramCount++}`;
      scoreParams.push(startDate, endDate);
    } else if (period === 'week') {
      dateFilter = `AND submitted_at >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateFilter = `AND submitted_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    const avgRes = await pool.query(
      `SELECT AVG(burnout_score) as avg_burnout, COUNT(*) as total_checkins
       FROM check_ins
       WHERE team_id = $1 ${dateFilter}`,
      scoreParams
    );

    const latestRes = await pool.query(
      `SELECT submitted_at
       FROM check_ins
       WHERE team_id = $1
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [teamId]
    );

    const score = parseFloat(avgRes.rows[0].avg_burnout || 0);
    const risk = getRiskLevelLabel(score);
    const lastCheckinAt = latestRes.rows.length > 0 ? latestRes.rows[0].submitted_at : null;

    res.json({
      team: teamResult.rows[0],
      burnout_score: Math.round(score * 10) / 10,
      risk,
      last_checkin: lastCheckinAt ? formatTimeAgo(lastCheckinAt) : 'No check-ins',
      last_checkin_at: lastCheckinAt,
      recommendations: generateRecommendations(score),
      basis: {
        type: 'average',
        period,
        total_checkins: parseInt(avgRes.rows[0].total_checkins || 0, 10)
      }
    });
  } catch (error) {
    console.error('Manager recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Recent attendance upload activity for the manager (derived from attendance rows)
router.get('/attendance/uploads/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);

    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Only managers can view recent uploads' });
    }

    const recentQuery = `
      SELECT
        t.id as team_id,
        t.team_name,
        t.team_code,
        MAX(a.created_at) as last_uploaded_at,
        COUNT(*) as records_uploaded
      FROM attendance a
      JOIN teams t ON t.id = a.team_id
      WHERE a.uploaded_by = $1 AND t.is_active = TRUE
      GROUP BY t.id, t.team_name, t.team_code
      ORDER BY last_uploaded_at DESC NULLS LAST
      LIMIT $2
    `;

    const result = await pool.query(recentQuery, [req.user.id, limit]);
    res.json({ uploads: result.rows });
  } catch (error) {
    console.error('Recent uploads error:', error);
    res.status(500).json({ error: 'Failed to fetch recent uploads' });
  }
});

// List attendance records for a team (manager portal)
router.get('/attendance/team/:teamId/records', async (req, res) => {
  try {
    const { teamId } = req.params;
    const {
      startDate,
      endDate,
      employee_id,
      limit: limitRaw,
      offset: offsetRaw,
    } = req.query;

    const limit = Math.min(parseInt(limitRaw || '100', 10), 500);
    const offset = Math.max(parseInt(offsetRaw || '0', 10), 0);

    // Verify team access
    let teamQuery = 'SELECT id, team_name, team_code FROM teams WHERE id = $1 AND is_active = TRUE';
    const teamParams = [teamId];

    if (req.user.role === 'manager') {
      teamQuery += ' AND manager_id = $2';
      teamParams.push(req.user.id);
    }

    const teamResult = await pool.query(teamQuery, teamParams);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }

    // Build filters
    const where = ['a.team_id = $1'];
    const params = [teamId];
    let paramCount = 2;

    if (employee_id && String(employee_id).trim() !== '') {
      where.push(`a.employee_id = $${paramCount++}`);
      params.push(String(employee_id).trim());
    }

    if (startDate && endDate) {
      where.push(`a.date >= $${paramCount++} AND a.date <= $${paramCount++}`);
      params.push(startDate, endDate);
    }

    // Total count for pagination
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM attendance a
       WHERE ${where.join(' AND ')}`,
      params
    );

    // Data query
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT
         a.id,
         a.employee_id,
         a.date,
         a.status,
         a.created_at,
         a.uploaded_by
       FROM attendance a
       WHERE ${where.join(' AND ')}
       ORDER BY a.date DESC, a.employee_id ASC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );

    res.json({
      team: teamResult.rows[0],
      total: countRes.rows[0]?.total || 0,
      limit,
      offset,
      records: dataRes.rows,
    });
  } catch (error) {
    console.error('Team attendance records error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// List attendance records across all teams for the manager (optionally filter by team_id)
router.get('/attendance/records', async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Only managers can view attendance records' });
    }

    const {
      startDate,
      endDate,
      team_id,
      limit: limitRaw,
      offset: offsetRaw,
    } = req.query;

    const limit = Math.min(parseInt(limitRaw || '100', 10), 500);
    const offset = Math.max(parseInt(offsetRaw || '0', 10), 0);

    const where = ['t.manager_id = $1', 't.is_active = TRUE'];
    const params = [req.user.id];
    let paramCount = 2;

    if (team_id) {
      where.push(`t.id = $${paramCount++}`);
      params.push(team_id);
    }

    if (startDate && endDate) {
      where.push(`a.date >= $${paramCount++} AND a.date <= $${paramCount++}`);
      params.push(startDate, endDate);
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM attendance a
       JOIN teams t ON t.id = a.team_id
       WHERE ${where.join(' AND ')}`,
      params
    );

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT
         a.id,
         a.employee_id,
         a.date,
         a.status,
         a.created_at,
         a.uploaded_by,
         t.id as team_id,
         t.team_name,
         t.team_code
       FROM attendance a
       JOIN teams t ON t.id = a.team_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.date DESC, t.team_name ASC, a.employee_id ASC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );

    res.json({
      total: countRes.rows[0]?.total || 0,
      limit,
      offset,
      records: dataRes.rows,
    });
  } catch (error) {
    console.error('All attendance records error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

module.exports = router;


