const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { getRiskLevelLabel } = require('../utils/recommendations');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('hr', 'admin'));

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

// HR dashboard: organizational burnout overview + team list + optional trend
router.get('/dashboard', async (req, res) => {
  try {
    const { period = 'week', startDate, endDate } = req.query;

    // Build date filter for check-ins (same semantics as Manager/Admin dashboard)
    let dateFilterSql = '';
    const dateFilterParams = [];

    if (startDate && endDate) {
      dateFilterSql = `AND c.submitted_at >= $1 AND c.submitted_at <= $2`;
      dateFilterParams.push(startDate, endDate);
    } else if (period === 'week') {
      dateFilterSql = `AND c.submitted_at >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateFilterSql = `AND c.submitted_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    // Per-team averages (within optional period range) + last check-in time
    const teamsQuery = `
      SELECT
        t.id,
        t.team_name,
        t.team_code,
        stats.avg_burnout,
        stats.checkin_count,
        stats.last_checkin_at
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT
          AVG(c.burnout_score) AS avg_burnout,
          COUNT(*)::int AS checkin_count,
          MAX(c.submitted_at) AS last_checkin_at
        FROM check_ins c
        WHERE c.team_id = t.id
          ${dateFilterSql}
      ) stats ON TRUE
      WHERE t.is_active = TRUE
      ORDER BY COALESCE(stats.avg_burnout, 0) DESC, t.team_name ASC
    `;

    const teamsResult = await pool.query(teamsQuery, dateFilterParams);

    const teams = teamsResult.rows.map((r) => {
      const score = r.avg_burnout !== null ? parseFloat(r.avg_burnout) : null;
      const rounded = score !== null ? Math.round(score * 10) / 10 : null;
      return {
        id: r.id,
        name: r.team_name,
        team_code: r.team_code,
        burnout_score: rounded,
        risk: rounded !== null ? getRiskLevelLabel(rounded) : 'No Data',
        last_checkin: r.last_checkin_at ? formatTimeAgo(r.last_checkin_at) : 'No check-ins',
        last_checkin_at: r.last_checkin_at,
        checkins: r.checkin_count || 0,
      };
    });

    const scoredTeams = teams.filter((t) => typeof t.burnout_score === 'number');
    const avgScore =
      scoredTeams.length > 0
        ? Math.round((scoredTeams.reduce((sum, t) => sum + t.burnout_score, 0) / scoredTeams.length) * 10) / 10
        : 0;

    const riskCounts = {
      low_risk: 0,
      moderate_risk: 0,
      high_risk: 0
    };

    for (const t of teams) {
      if (t.risk === 'Low') riskCounts.low_risk += 1;
      else if (t.risk === 'Moderate') riskCounts.moderate_risk += 1;
      else if (t.risk === 'High' || t.risk === 'Critical') riskCounts.high_risk += 1;
    }

    const atRiskTeams = teams.filter((t) => t.risk === 'High' || t.risk === 'Critical');

    // Summary cards (organization-wide)
    const totalTeamsRes = await pool.query(`SELECT COUNT(*)::int as total FROM teams WHERE is_active = TRUE`);

    const totalEmployeesRes = await pool.query(`
      SELECT COUNT(DISTINCT a.employee_id)::int as total
      FROM attendance a
      JOIN teams t ON t.id = a.team_id
      WHERE t.is_active = TRUE
        AND a.employee_id IS NOT NULL
        AND TRIM(a.employee_id) <> ''
    `);

    const weekCheckinsRes = await pool.query(`
      SELECT COUNT(*)::int as total
      FROM check_ins c
      JOIN teams t ON t.id = c.team_id
      WHERE t.is_active = TRUE
        AND c.submitted_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    const last6WeeksAvgRes = await pool.query(`
      SELECT AVG(c.burnout_score) as avg_burnout
      FROM check_ins c
      JOIN teams t ON t.id = c.team_id
      WHERE t.is_active = TRUE
        AND c.submitted_at >= CURRENT_DATE - INTERVAL '42 days'
    `);

    // Org overview series (daily average, last 14 days) + last activity within selected period
    const orgSeriesRes = await pool.query(`
      SELECT
        DATE(c.submitted_at) as day,
        AVG(c.burnout_score) as avg_burnout,
        COUNT(*)::int as checkins
      FROM check_ins c
      JOIN teams t ON t.id = c.team_id
      WHERE t.is_active = TRUE
        AND c.submitted_at >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const lastActivityRes = await pool.query(
      `SELECT MAX(c.submitted_at) as last_activity_at
       FROM check_ins c
       JOIN teams t ON t.id = c.team_id
       WHERE t.is_active = TRUE ${dateFilterSql}`,
      dateFilterParams
    );

    const totalCheckinsInPeriodRes = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM check_ins c
       JOIN teams t ON t.id = c.team_id
       WHERE t.is_active = TRUE ${dateFilterSql}`,
      dateFilterParams
    );

    // Organizational trend (last 12 periods) across all teams
    let trendQuery;
    if (period === 'week') {
      trendQuery = `
        SELECT
          year,
          week_number,
          AVG(burnout_score) as avg_burnout,
          COUNT(*) as checkin_count
        FROM check_ins c
        JOIN teams t ON t.id = c.team_id
        WHERE t.is_active = TRUE
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
        FROM check_ins c
        JOIN teams t ON t.id = c.team_id
        WHERE t.is_active = TRUE
        GROUP BY year, month_number
        ORDER BY year DESC, month_number DESC
        LIMIT 12
      `;
    }
    const trendResult = await pool.query(trendQuery);

    res.json({
      summary: {
        total_teams: totalTeamsRes.rows[0]?.total || 0,
        total_employees: totalEmployeesRes.rows[0]?.total || 0,
        this_week_checkins: weekCheckinsRes.rows[0]?.total || 0,
        last_6_weeks_avg: parseFloat(last6WeeksAvgRes.rows[0]?.avg_burnout || 0).toFixed(1),
      },
      organizational_burnout: {
        avg_score: avgScore,
        ...riskCounts
      },
      organizational_overview: {
        overall_average: avgScore,
        total_checkins_in_period: totalCheckinsInPeriodRes.rows[0]?.total || 0,
        last_activity_at: lastActivityRes.rows[0]?.last_activity_at || null,
        daily_series: orgSeriesRes.rows,
      },
      organizational_trend: trendResult.rows.reverse(),
      at_risk_teams: atRiskTeams,
      teams
    });
  } catch (error) {
    console.error('HR dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch HR dashboard data' });
  }
});

module.exports = router;


