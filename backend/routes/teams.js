const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all teams
router.get('/', async (req, res) => {
  try {
    let query;
    let params;
    
    // Managers can only see their own teams
    if (req.user.role === 'manager') {
      query = `
        SELECT t.*, u.full_name as manager_name
        FROM teams t
        LEFT JOIN users u ON t.manager_id = u.id
        WHERE t.manager_id = $1 AND t.is_active = TRUE
        ORDER BY t.created_at DESC
      `;
      params = [req.user.id];
    } else {
      // Admins see all active teams
      query = `
        SELECT t.*, u.full_name as manager_name
        FROM teams t
        LEFT JOIN users u ON t.manager_id = u.id
        WHERE t.is_active = TRUE
        ORDER BY t.created_at DESC
      `;
      params = [];
    }
    
    const result = await pool.query(query, params);
    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get single team
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = `
      SELECT t.*, u.full_name as manager_name
      FROM teams t
      LEFT JOIN users u ON t.manager_id = u.id
      WHERE t.id = $1 AND t.is_active = TRUE
    `;
    let params = [id];
    
    // Managers can only see their own teams
    if (req.user.role === 'manager') {
      query += ' AND t.manager_id = $2';
      params.push(req.user.id);
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Create team (admin only)
router.post('/',
  requireRole('admin'),
  [
    body('team_code').trim().notEmpty().matches(/^[A-Z0-9-_]+$/i),
    body('team_name').trim().notEmpty(),
    // Allow omitting manager_id; if present must be int
    body('manager_id').optional({ nullable: true }).isInt()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { team_code, team_name, manager_id } = req.body;
      
      // Check if team code exists
      const existing = await pool.query(
        'SELECT id FROM teams WHERE team_code = $1 AND is_active = TRUE',
        [team_code.toUpperCase()]
      );
      
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Team code already exists' });
      }
      
      // Validate manager if provided
      if (manager_id) {
        const manager = await pool.query(
          'SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE',
          [manager_id]
        );
        
        if (manager.rows.length === 0) {
          return res.status(400).json({ error: 'Manager not found' });
        }
        
        if (manager.rows[0].role !== 'manager') {
          return res.status(400).json({ error: 'User is not a manager' });
        }
      }
      
      const result = await pool.query(
        'INSERT INTO teams (team_code, team_name, manager_id) VALUES ($1, $2, $3) RETURNING *',
        [team_code.toUpperCase(), team_name, manager_id || null]
      );
      
      res.status(201).json({
        message: 'Team created successfully',
        team: result.rows[0]
      });
    } catch (error) {
      console.error('Create team error:', error);
      res.status(500).json({ error: 'Failed to create team' });
    }
  }
);

// Generate check-in token for team
router.post('/:id/token',
  requireRole('admin', 'manager'),
  [
    body('expires_at').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { expires_at } = req.body;
      
      // Verify team exists and user has access
      let query = 'SELECT id, team_code, team_name FROM teams WHERE id = $1 AND is_active = TRUE';
      let params = [id];
      
      if (req.user.role === 'manager') {
        query += ' AND manager_id = $2';
        params.push(req.user.id);
      }
      
      const teamResult = await pool.query(query, params);
      
      if (teamResult.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found or access denied' });
      }
      
      const team = teamResult.rows[0];
      
      // Generate unique token
      const token = uuidv4();
      
      // Calculate expiration (default 1 year)
      let expiresAt = null;
      if (expires_at) {
        expiresAt = new Date(expires_at);
      } else {
        expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }
      
      // Create token record
      const tokenResult = await pool.query(
        'INSERT INTO team_tokens (team_id, token, created_by, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, token, req.user.id, expiresAt]
      );
      
      // Generate check-in URL
      const checkinUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkin/${token}`;
      
      res.status(201).json({
        message: 'Token generated successfully',
        token: tokenResult.rows[0],
        checkin_url: checkinUrl
      });
    } catch (error) {
      console.error('Generate token error:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  }
);

// Get tokens for a team
router.get('/:id/tokens', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify team access
    let query = 'SELECT id FROM teams WHERE id = $1 AND is_active = TRUE';
    let params = [id];
    
    if (req.user.role === 'manager') {
      query += ' AND manager_id = $2';
      params.push(req.user.id);
    }
    
    const teamResult = await pool.query(query, params);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }
    
    // Get tokens
    const tokensResult = await pool.query(
      `SELECT id, token, is_active, expires_at, created_at,
       (SELECT COUNT(*) FROM check_ins WHERE token_used = team_tokens.token) as usage_count
       FROM team_tokens
       WHERE team_id = $1
       ORDER BY created_at DESC`,
      [id]
    );
    
    res.json({ tokens: tokensResult.rows });
  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Update team
router.put('/:id',
  requireRole('admin'),
  [
    body('team_name').optional().trim().notEmpty(),
    // Allow explicitly unassigning by sending null (frontend often does this)
    body('manager_id').optional({ nullable: true }).isInt()
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { team_name, manager_id } = req.body;
      
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (team_name) {
        updates.push(`team_name = $${paramCount++}`);
        values.push(team_name);
      }
      
      if (manager_id !== undefined) {
        if (manager_id) {
          // Validate manager
          const manager = await pool.query(
            'SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE',
            [manager_id]
          );
          
          if (manager.rows.length === 0 || manager.rows[0].role !== 'manager') {
            return res.status(400).json({ error: 'Invalid manager' });
          }
        }
        
        updates.push(`manager_id = $${paramCount++}`);
        values.push(manager_id);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      values.push(id);
      const query = `UPDATE teams SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} AND is_active = TRUE RETURNING *`;
      
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
      
      res.json({
        message: 'Team updated successfully',
        team: result.rows[0]
      });
    } catch (error) {
      console.error('Update team error:', error);
      res.status(500).json({ error: 'Failed to update team' });
    }
  }
);

// Delete team (admin only)
router.delete('/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        `UPDATE teams SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND is_active = TRUE RETURNING id`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
      
      // Optionally deactivate tokens
      await pool.query('UPDATE team_tokens SET is_active = FALSE WHERE team_id = $1', [id]);

      res.json({ message: 'Team archived successfully' });
    } catch (error) {
      console.error('Delete team error:', error);
      res.status(500).json({ error: 'Failed to delete team' });
    }
  }
);

module.exports = router;

