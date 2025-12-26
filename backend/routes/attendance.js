const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists for multer storage
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// All routes require authentication
router.use(authenticate);

// Configure multer for file uploads
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.csv') || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Parse CSV file
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function isEmptyRecord(record) {
  if (!record || typeof record !== 'object') return true;
  const values = Object.values(record);
  if (values.length === 0) return true;
  return values.every((v) => v === null || v === undefined || String(v).trim() === '');
}

// Parse Excel file
function parseExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(worksheet);
}

// Validate attendance record
function validateAttendanceRecord(record, rowNum) {
  const errors = [];
  
  if (!record.employee_id || record.employee_id.trim() === '') {
    errors.push(`Row ${rowNum}: employee_id is required`);
  }
  
  if (!record.team_id || record.team_id.trim() === '') {
    errors.push(`Row ${rowNum}: team_id is required`);
  }
  
  if (!record.date) {
    errors.push(`Row ${rowNum}: date is required`);
  } else {
    const date = new Date(record.date);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${rowNum}: invalid date format`);
    }
  }
  
  if (!record.status) {
    errors.push(`Row ${rowNum}: status is required`);
  } else {
    const validStatuses = ['Present', 'Absent', 'Leave', 'Sick'];
    if (!validStatuses.includes(record.status.trim())) {
      errors.push(`Row ${rowNum}: status must be one of: ${validStatuses.join(', ')}`);
    }
  }
  
  return errors;
}

// Upload attendance file
router.post('/upload',
  requireRole('admin', 'manager'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    try {
      // Parse file
      let records;
      if (fileExtension === '.csv') {
        records = await parseCSV(filePath);
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        records = await parseExcel(filePath);
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Unsupported file format' });
      }
      
      if (records.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'File is empty' });
      }
      
      // Normalize column names (case-insensitive, handle spaces/underscores)
      records = records.map(record => {
        const normalized = {};
        for (const key in record) {
          const normalizedKey = key.toLowerCase().trim().replace(/[\s_]/g, '_');
          normalized[normalizedKey] = record[key];
        }
        return normalized;
      }).filter((record) => !isEmptyRecord(record));
      
      // Validate and process records
      const errors = [];
      const validRecords = [];
      const teamIds = new Set();
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 2; // +2 because Excel is 1-indexed and has header
        
        const recordErrors = validateAttendanceRecord(record, rowNum);
        if (recordErrors.length > 0) {
          errors.push(...recordErrors);
          continue;
        }
        
        // Normalize team_id
        const teamId = record.team_id.toString().trim().toUpperCase();
        teamIds.add(teamId);
        
        validRecords.push({
          employee_id: record.employee_id.toString().trim(),
          team_id: teamId,
          date: new Date(record.date),
          status: record.status.trim()
        });
      }
      
      // Verify teams exist and user has access
      const teamCodes = Array.from(teamIds);
      let teamQuery = 'SELECT id, team_code FROM teams WHERE team_code = ANY($1) AND is_active = TRUE';
      let teamParams = [teamCodes];
      
      if (req.user.role === 'manager') {
        teamQuery += ' AND manager_id = $2';
        teamParams.push(req.user.id);
      }
      
      const teamResult = await pool.query(teamQuery, teamParams);
      const validTeamCodes = new Set(teamResult.rows.map(t => t.team_code));
      const teamIdMap = {};
      teamResult.rows.forEach(t => {
        teamIdMap[t.team_code] = t.id;
      });
      
      // Check for invalid teams
      for (const code of teamCodes) {
        if (!validTeamCodes.has(code)) {
          errors.push(`Team ${code} not found or access denied`);
        }
      }
      
      if (errors.length > 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          error: 'Validation errors',
          errors
        });
      }
      
      // Insert records (use ON CONFLICT to handle duplicates)
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      
      for (const record of validRecords) {
        const teamId = teamIdMap[record.team_id];
        
        try {
          const result = await pool.query(
            `INSERT INTO attendance (team_id, employee_id, date, status, uploaded_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (team_id, employee_id, date)
             DO UPDATE SET status = EXCLUDED.status, uploaded_by = EXCLUDED.uploaded_by
             -- FIX: use system column xmax to detect insert vs update reliably in Postgres
             RETURNING (xmax = 0) AS inserted`,
            [teamId, record.employee_id, record.date, record.status, req.user.id]
          );
          
          if (result.rows.length > 0) {
            if (result.rows[0].inserted) inserted++;
            else updated++;
          }
        } catch (err) {
          if (err.code === '23505') { // Unique constraint violation
            skipped++;
          } else {
            throw err;
          }
        }
      }
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      res.json({
        message: 'Attendance data uploaded successfully',
        teams_in_file: Array.from(teamIds),
        summary: {
          total_records: records.length,
          inserted,
          updated,
          skipped,
          errors: errors.length
        }
      });
    } catch (error) {
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to process attendance file' });
    }
  }
);

// Get attendance template
router.get('/template', authenticate, (req, res) => {
  const template = [
    {
      employee_id: 'E1',
      team_id: 'TEAM-A',
      date: '2025-01-15',
      status: 'Present'
    },
    {
      employee_id: 'E2',
      team_id: 'TEAM-A',
      date: '2025-01-15',
      status: 'Absent'
    },
    {
      employee_id: 'E1',
      team_id: 'TEAM-A',
      date: '2025-01-16',
      status: 'Present'
    }
  ];
  
  res.json({
    template,
    instructions: {
      employee_id: 'Unique identifier for employee (string)',
      team_id: 'Team code (must match existing team)',
      date: 'Date in YYYY-MM-DD format',
      status: 'One of: Present, Absent, Leave, Sick'
    }
  });
});

// Get attendance statistics
router.get('/team/:teamId/stats', async (req, res) => {
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
      dateFilter = `AND date >= $${paramCount++} AND date <= $${paramCount++}`;
      params.push(startDate, endDate);
    } else {
      dateFilter = `AND date >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT employee_id) as unique_employees,
        COUNT(DISTINCT date) as days_covered,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave_count,
        SUM(CASE WHEN status = 'Sick' THEN 1 ELSE 0 END) as sick_count
      FROM attendance
      WHERE team_id = $1 ${dateFilter}
    `;
    
    const statsResult = await pool.query(statsQuery, params);
    
    const stats = statsResult.rows[0];
    const total = parseInt(stats.total_records || 0);
    const absenceRate = total > 0 ? (parseInt(stats.absent_count || 0) / total * 100).toFixed(2) : 0;
    
    res.json({
      statistics: {
        total_records: total,
        unique_employees: parseInt(stats.unique_employees || 0),
        days_covered: parseInt(stats.days_covered || 0),
        absence_rate: parseFloat(absenceRate),
        breakdown: {
          present: parseInt(stats.present_count || 0),
          absent: parseInt(stats.absent_count || 0),
          leave: parseInt(stats.leave_count || 0),
          sick: parseInt(stats.sick_count || 0)
        }
      }
    });
  } catch (error) {
    console.error('Attendance stats error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance statistics' });
  }
});

module.exports = router;

