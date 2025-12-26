const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { calculateBurnoutScore, getWeekNumber } = require('../utils/burnoutCalculator');

const router = express.Router();

// GET /api/public/checkin/:teamToken - validate token and return minimal team info
router.get('/:teamToken', async (req, res) => {
  try {
    const { teamToken } = req.params;

    const result = await pool.query(
      `SELECT tt.token, t.id as team_id, t.team_code, t.team_name
       FROM team_tokens tt
       JOIN teams t ON tt.team_id = t.id
       WHERE tt.token = $1
         AND tt.is_active = true
         AND t.is_active = true
         AND (tt.expires_at IS NULL OR tt.expires_at > CURRENT_TIMESTAMP)`,
      [teamToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Invalid or expired token' });
    }

    const team = result.rows[0];
    res.json({
      valid: true,
      team: {
        id: team.team_id,
        code: team.team_code,
        name: team.team_name
      }
    });
  } catch (error) {
    console.error('Public check-in validate error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// GET /api/public/checkin/by-team/:teamCode - fetch latest active token for a team code
router.get('/by-team/:teamCode', async (req, res) => {
  try {
    const { teamCode } = req.params;
    const code = teamCode.toUpperCase();

    const result = await pool.query(
      `SELECT tt.token
       FROM team_tokens tt
       JOIN teams t ON tt.team_id = t.id
       WHERE t.team_code = $1
         AND t.is_active = TRUE
         AND tt.is_active = TRUE
         AND (tt.expires_at IS NULL OR tt.expires_at > CURRENT_TIMESTAMP)
       ORDER BY tt.created_at DESC
       LIMIT 1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active check-in link for this team' });
    }

    res.json({ token: result.rows[0].token, checkin_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkin/${result.rows[0].token}` });
  } catch (error) {
    console.error('Public check-in by team error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in link' });
  }
});

// POST /api/public/checkin/:teamToken - submit anonymous check-in
router.post(
  '/:teamToken',
  [
    body('workload').isInt({ min: 0, max: 4 }),
    body('stress').isInt({ min: 0, max: 4 }),
    body('sleep').isInt({ min: 0, max: 4 }),
    body('engagement').isInt({ min: 0, max: 4 }),
    body('recovery').isInt({ min: 0, max: 4 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { teamToken } = req.params;
      const { workload, stress, sleep, engagement, recovery } = req.body;

      // Validate token and get team
      const tokenResult = await pool.query(
        `SELECT tt.token, t.id as team_id, t.team_code
         FROM team_tokens tt
         JOIN teams t ON tt.team_id = t.id
         WHERE tt.token = $1
           AND tt.is_active = true
           AND t.is_active = true
           AND (tt.expires_at IS NULL OR tt.expires_at > CURRENT_TIMESTAMP)`,
        [teamToken]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const tokenData = tokenResult.rows[0];

      // Calculate burnout score
      const burnoutData = calculateBurnoutScore(
        parseInt(workload),
        parseInt(stress),
        parseInt(sleep),
        parseInt(engagement),
        parseInt(recovery)
      );

      // Date info
      const now = new Date();
      const weekNumber = getWeekNumber(now);
      const monthNumber = now.getMonth() + 1;
      const year = now.getFullYear();

      // Store anonymous check-in
      const result = await pool.query(
        `INSERT INTO check_ins 
         (team_id, token_used, workload, stress, sleep, engagement, recovery, 
          burnout_score, risk_level, week_number, month_number, year)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, burnout_score, risk_level, submitted_at`,
        [
          tokenData.team_id,
          teamToken,
          parseInt(workload),
          parseInt(stress),
          parseInt(sleep),
          parseInt(engagement),
          parseInt(recovery),
          burnoutData.score,
          burnoutData.riskLevel,
          weekNumber,
          monthNumber,
          year
        ]
      );

      res.status(201).json({
        message: 'Check-in submitted successfully',
        burnout_score: burnoutData.score,
        risk_level: burnoutData.riskLevel,
        submitted_at: result.rows[0].submitted_at
      });
    } catch (error) {
      console.error('Public check-in submit error:', error);
      res.status(500).json({ error: 'Failed to submit check-in' });
    }
  }
);

module.exports = router;

