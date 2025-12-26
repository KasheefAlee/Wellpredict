const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { calculateBurnoutScore } = require('../utils/burnoutCalculator');

const router = express.Router();

// All routes require admin auth
router.use(authenticate);
router.use(requireRole('admin'));

// Create manager
router.post(
  '/managers',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('full_name').trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, full_name } = req.body;

      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, email, full_name, role',
        [email, passwordHash, full_name, 'manager']
      );

      res.status(201).json({
        message: 'Manager created successfully',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Create manager error:', error);
      res.status(500).json({ error: 'Failed to create manager' });
    }
  }
);

// Create HR user
router.post(
  '/hr',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('full_name').trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, full_name } = req.body;

      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, email, full_name, role',
        [email, passwordHash, full_name, 'hr']
      );

      res.status(201).json({
        message: 'HR user created successfully',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Create HR error:', error);
      res.status(500).json({ error: 'Failed to create HR user' });
    }
  }
);

// List active managers
router.get('/managers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role
       FROM users
       WHERE role = 'manager' AND is_active = TRUE
       ORDER BY created_at DESC`
    );
    res.json({ managers: result.rows });
  } catch (error) {
    console.error('List managers error:', error);
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
});

// List active HR users
router.get('/hr', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role
       FROM users
       WHERE role = 'hr' AND is_active = TRUE
       ORDER BY created_at DESC`
    );
    res.json({ hr: result.rows });
  } catch (error) {
    console.error('List HR users error:', error);
    res.status(500).json({ error: 'Failed to fetch HR users' });
  }
});

// Deactivate manager (soft delete)
router.delete('/managers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users 
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND role = 'manager'
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // Unassign manager from teams
    await pool.query('UPDATE teams SET manager_id = NULL WHERE manager_id = $1', [id]);

    res.json({ message: 'Manager deactivated successfully' });
  } catch (error) {
    console.error('Deactivate manager error:', error);
    res.status(500).json({ error: 'Failed to deactivate manager' });
  }
});

// Deactivate HR user (soft delete)
router.delete('/hr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND role = 'hr'
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'HR user not found' });
    }

    res.json({ message: 'HR user deactivated successfully' });
  } catch (error) {
    console.error('Deactivate HR error:', error);
    res.status(500).json({ error: 'Failed to deactivate HR user' });
  }
});

// Hard delete a manager/HR user (permanent)
router.delete('/users/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Safety: don't allow deleting self from admin panel
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await client.query('BEGIN');

    const userRes = await client.query(
      `SELECT id, role
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const role = userRes.rows[0].role;
    if (role !== 'manager' && role !== 'hr') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only manager/HR users can be deleted' });
    }

    // Clean up references that would block deletion (FKs without ON DELETE behavior)
    await client.query('UPDATE teams SET manager_id = NULL WHERE manager_id = $1', [id]);
    await client.query('UPDATE team_tokens SET created_by = NULL WHERE created_by = $1', [id]);
    await client.query('UPDATE attendance SET uploaded_by = NULL WHERE uploaded_by = $1', [id]);

    const delRes = await client.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );

    await client.query('COMMIT');

    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// Assign/change manager for a team
router.put(
  '/teams/:teamId/manager',
  [body('manager_id').optional({ nullable: true }).isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { teamId } = req.params;
      const { manager_id } = req.body;

      // Validate team active
      const teamRes = await pool.query('SELECT id FROM teams WHERE id = $1 AND is_active = TRUE', [teamId]);
      if (teamRes.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found or inactive' });
      }

      let managerIdValue = null;
      if (manager_id !== undefined && manager_id !== null) {
        const mgrRes = await pool.query(
          `SELECT id FROM users WHERE id = $1 AND role = 'manager' AND is_active = TRUE`,
          [manager_id]
        );
        if (mgrRes.rows.length === 0) {
          return res.status(400).json({ error: 'Manager not found or inactive' });
        }
        managerIdValue = manager_id;
      }

      const updated = await pool.query(
        'UPDATE teams SET manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, team_code, team_name, manager_id',
        [managerIdValue, teamId]
      );

      res.json({
        message: 'Manager assignment updated',
        team: updated.rows[0]
      });
    } catch (error) {
      console.error('Assign manager error:', error);
      res.status(500).json({ error: 'Failed to assign manager' });
    }
  }
);

// Admin: list recent check-ins (for debugging/testing)
router.get('/checkins', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const teamId = req.query.team_id ? parseInt(req.query.team_id, 10) : null;

    const where = ['t.is_active = TRUE'];
    const params = [];
    let paramCount = 1;

    if (teamId) {
      where.push(`c.team_id = $${paramCount++}`);
      params.push(teamId);
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM check_ins c
       JOIN teams t ON t.id = c.team_id
       WHERE ${where.join(' AND ')}`,
      params
    );

    params.push(limit, offset);
    const rowsRes = await pool.query(
      `SELECT
         c.id,
         c.team_id,
         t.team_name,
         t.team_code,
         c.submitted_at,
         c.workload,
         c.stress,
         c.sleep,
         c.engagement,
         c.recovery,
         c.burnout_score,
         c.risk_level
       FROM check_ins c
       JOIN teams t ON t.id = c.team_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.submitted_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );

    res.json({
      total: countRes.rows[0]?.total || 0,
      limit,
      offset,
      checkins: rowsRes.rows,
    });
  } catch (error) {
    console.error('List check-ins error:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Admin: update a check-in (recomputes burnout score)
router.put(
  '/checkins/:id',
  [
    body('workload').isInt({ min: 0, max: 4 }),
    body('stress').isInt({ min: 0, max: 4 }),
    body('sleep').isInt({ min: 0, max: 4 }),
    body('engagement').isInt({ min: 0, max: 4 }),
    body('recovery').isInt({ min: 0, max: 4 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const workload = parseInt(req.body.workload, 10);
      const stress = parseInt(req.body.stress, 10);
      const sleep = parseInt(req.body.sleep, 10);
      const engagement = parseInt(req.body.engagement, 10);
      const recovery = parseInt(req.body.recovery, 10);

      const burnoutData = calculateBurnoutScore(workload, stress, sleep, engagement, recovery);

      const updated = await pool.query(
        `UPDATE check_ins
         SET workload = $1,
             stress = $2,
             sleep = $3,
             engagement = $4,
             recovery = $5,
             burnout_score = $6,
             risk_level = $7
         WHERE id = $8
         RETURNING id, burnout_score, risk_level`,
        [workload, stress, sleep, engagement, recovery, burnoutData.score, burnoutData.riskLevel, id]
      );

      if (updated.rows.length === 0) {
        return res.status(404).json({ error: 'Check-in not found' });
      }

      res.json({ message: 'Check-in updated', checkin: updated.rows[0] });
    } catch (error) {
      console.error('Update check-in error:', error);
      res.status(500).json({ error: 'Failed to update check-in' });
    }
  }
);

// Admin: delete a check-in
router.delete('/checkins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM check_ins WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Check-in not found' });
    }
    res.json({ message: 'Check-in deleted' });
  } catch (error) {
    console.error('Delete check-in error:', error);
    res.status(500).json({ error: 'Failed to delete check-in' });
  }
});

// Maintenance: Recalculate burnout_score + risk_level for all existing check-ins (admin only)
router.post('/maintenance/recalculate-burnout', async (req, res) => {
  try {
    const sql = `
      WITH computed AS (
        SELECT
          id,
          ROUND(((( (4 - workload) + stress + (4 - sleep) + (4 - engagement) + (4 - recovery) ) / 20.0) * 100)::numeric, 2) AS score
        FROM check_ins
      )
      UPDATE check_ins c
      SET
        burnout_score = computed.score,
        risk_level = CASE
          WHEN computed.score <= 30 THEN 'low'
          WHEN computed.score <= 60 THEN 'moderate'
          WHEN computed.score <= 80 THEN 'high'
          ELSE 'critical'
        END
      FROM computed
      WHERE c.id = computed.id
      RETURNING c.id;
    `;

    const result = await pool.query(sql);
    res.json({ message: 'Burnout scores recalculated', updated: result.rowCount });
  } catch (error) {
    console.error('Recalculate burnout error:', error);
    res.status(500).json({ error: 'Failed to recalculate burnout scores' });
  }
});

module.exports = router;

