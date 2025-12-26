const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { calculateBurnoutScore, getWeekNumber } = require('../utils/burnoutCalculator');

const router = express.Router();

// Anonymous check-in submission (no authentication required)
router.post('/submit',
  [
    body('token').trim().notEmpty(),
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
      
      const { token, workload, stress, sleep, engagement, recovery } = req.body;
      
      // Verify token is valid and active
      const tokenResult = await pool.query(
        `SELECT tt.*, t.id as team_id, t.team_code
         FROM team_tokens tt
         JOIN teams t ON tt.team_id = t.id
         WHERE tt.token = $1 AND tt.is_active = true
         AND t.is_active = TRUE
         AND (tt.expires_at IS NULL OR tt.expires_at > CURRENT_TIMESTAMP)`,
        [token]
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
      
      // Get current date info
      const now = new Date();
      const weekNumber = getWeekNumber(now);
      const monthNumber = now.getMonth() + 1;
      const year = now.getFullYear();
      
      // Store check-in (ANONYMOUS - no IP, no user identification)
      const result = await pool.query(
        `INSERT INTO check_ins 
         (team_id, token_used, workload, stress, sleep, engagement, recovery, 
          burnout_score, risk_level, week_number, month_number, year)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, burnout_score, risk_level, submitted_at`,
        [
          tokenData.team_id,
          token, // Store token reference but not identifying user
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
      console.error('Check-in submission error:', error);
      
      if (error.message.includes('parameters must be numbers')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to submit check-in' });
    }
  }
);

// Verify token (for frontend to check if link is valid)
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await pool.query(
      `SELECT tt.*, t.team_code, t.team_name
       FROM team_tokens tt
       JOIN teams t ON tt.team_id = t.id
       WHERE tt.token = $1 AND tt.is_active = true
       AND t.is_active = TRUE
       AND (tt.expires_at IS NULL OR tt.expires_at > CURRENT_TIMESTAMP)`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }
    
    res.json({
      valid: true,
      team: {
        code: result.rows[0].team_code,
        name: result.rows[0].team_name
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

module.exports = router;

