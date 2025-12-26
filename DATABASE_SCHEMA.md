# Database Schema Documentation

Complete database schema for the Employee Wellbeing & Burnout Monitoring Platform.

## Overview

The database uses PostgreSQL and consists of 5 main tables:
- `users` - Admin and manager accounts
- `teams` - Team information
- `team_tokens` - Secure tokens for anonymous check-ins
- `check_ins` - Anonymous employee check-in submissions
- `attendance` - Employee attendance records

## Tables

### users

Stores admin and manager user accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(255) | NOT NULL | User's full name |
| role | VARCHAR(50) | NOT NULL, CHECK | Role: 'admin' or 'manager' |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- Primary key on `id`
- Unique index on `email`

**Triggers:**
- `update_updated_at_column` - Automatically updates `updated_at` on row update

---

### teams

Stores team information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| team_code | VARCHAR(100) | UNIQUE, NOT NULL | Unique team identifier (e.g., "TEAM-A") |
| team_name | VARCHAR(255) | NOT NULL | Team display name |
| manager_id | INTEGER | FOREIGN KEY → users(id) | Assigned manager (nullable) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Team creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- Primary key on `id`
- Unique index on `team_code`
- Foreign key index on `manager_id`

**Relationships:**
- `manager_id` references `users(id)` ON DELETE SET NULL

---

### team_tokens

Stores secure tokens for anonymous check-in links.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| team_id | INTEGER | NOT NULL, FOREIGN KEY → teams(id) | Associated team |
| token | VARCHAR(255) | UNIQUE, NOT NULL | UUID token string |
| created_by | INTEGER | FOREIGN KEY → users(id) | User who created token |
| is_active | BOOLEAN | DEFAULT true | Whether token is active |
| expires_at | TIMESTAMP | NULLABLE | Token expiration date |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Token creation time |

**Indexes:**
- Primary key on `id`
- Unique index on `token`
- Index on `team_id` for faster lookups

**Relationships:**
- `team_id` references `teams(id)` ON DELETE CASCADE
- `created_by` references `users(id)`

**Security:**
- Tokens are UUIDs (v4) for uniqueness
- Can be deactivated without deletion
- Optional expiration date

---

### check_ins

Stores anonymous employee check-in submissions. **NO user identification stored.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| team_id | INTEGER | NOT NULL, FOREIGN KEY → teams(id) | Team that received check-in |
| token_used | VARCHAR(255) | NULLABLE | Token used (for reference only) |
| workload | INTEGER | NOT NULL, CHECK (0-4) | Workload rating (0-4) |
| stress | INTEGER | NOT NULL, CHECK (0-4) | Stress level (0-4) |
| sleep | INTEGER | NOT NULL, CHECK (0-4) | Sleep quality (0-4) |
| engagement | INTEGER | NOT NULL, CHECK (0-4) | Engagement level (0-4) |
| recovery | INTEGER | NOT NULL, CHECK (0-4) | Recovery level (0-4) |
| burnout_score | DECIMAL(5,2) | NOT NULL | Calculated burnout score (0-100) |
| risk_level | VARCHAR(20) | NOT NULL, CHECK | Risk level: 'low', 'moderate', 'high', 'critical' |
| submitted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Submission timestamp |
| week_number | INTEGER | NULLABLE | Week of year for easier querying |
| month_number | INTEGER | NULLABLE | Month (1-12) for easier querying |
| year | INTEGER | NULLABLE | Year for easier querying |

**Indexes:**
- Primary key on `id`
- Index on `team_id` for team queries
- Index on `submitted_at` for date range queries
- Composite index on `(year, month_number, week_number)` for trend analysis

**Relationships:**
- `team_id` references `teams(id)` ON DELETE CASCADE

**Privacy:**
- **NO IP addresses stored**
- **NO user identification**
- **NO email addresses**
- Only team-level aggregation visible to managers

**Burnout Score Calculation:**
```
Score = (workload + stress + sleep + engagement + recovery) / 20 * 100
```

**Risk Level Mapping:**
- 0-30: 'low'
- 31-60: 'moderate'
- 61-80: 'high'
- 81-100: 'critical'

---

### attendance

Stores employee attendance records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| team_id | INTEGER | NOT NULL, FOREIGN KEY → teams(id) | Associated team |
| employee_id | VARCHAR(100) | NULLABLE | Employee identifier (not linked to users) |
| date | DATE | NOT NULL | Attendance date |
| status | VARCHAR(50) | NOT NULL, CHECK | Status: 'Present', 'Absent', 'Leave', 'Sick' |
| uploaded_by | INTEGER | FOREIGN KEY → users(id) | User who uploaded record |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |

**Indexes:**
- Primary key on `id`
- Index on `team_id` for team queries
- Index on `date` for date range queries
- Unique constraint on `(team_id, employee_id, date)` to prevent duplicates

**Relationships:**
- `team_id` references `teams(id)` ON DELETE CASCADE
- `uploaded_by` references `users(id)`

**Data Integrity:**
- Duplicate entries for same employee/team/date are prevented
- Updates use ON CONFLICT DO UPDATE

---

## Database Functions

### update_updated_at_column()

Automatically updates the `updated_at` timestamp when a row is updated.

**Used by:**
- `users` table trigger
- `teams` table trigger

---

## Indexes Summary

### Performance Indexes

1. **check_ins**
   - `idx_check_ins_team_id` - Fast team-based queries
   - `idx_check_ins_submitted_at` - Date range queries
   - `idx_check_ins_week_month_year` - Trend analysis

2. **attendance**
   - `idx_attendance_team_id` - Team-based queries
   - `idx_attendance_date` - Date range queries

3. **team_tokens**
   - `idx_team_tokens_token` - Fast token lookups
   - `idx_team_tokens_team_id` - Team token queries

---

## Data Privacy & Security

### Anonymous Check-ins

- **No IP addresses** stored
- **No user identification** stored
- **No email addresses** stored
- Only `token_used` reference (does not identify user)
- Managers see only **aggregated team statistics**

### Password Security

- Passwords stored as **bcrypt hashes** (salt rounds: 10)
- Never stored in plain text
- Never logged or exposed in API responses

### Access Control

- Role-based access control (admin, manager)
- JWT authentication required for most endpoints
- Team-level data isolation for managers

---

## Sample Queries

### Get Team Average Burnout (Last 7 Days)
```sql
SELECT 
  AVG(burnout_score) as avg_burnout,
  COUNT(*) as total_checkins
FROM check_ins
WHERE team_id = 1
  AND submitted_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Get Risk Distribution
```sql
SELECT 
  risk_level,
  COUNT(*) as count,
  AVG(burnout_score) as avg_score
FROM check_ins
WHERE team_id = 1
GROUP BY risk_level;
```

### Get Weekly Trends
```sql
SELECT 
  year,
  week_number,
  AVG(burnout_score) as avg_burnout,
  COUNT(*) as checkin_count
FROM check_ins
WHERE team_id = 1
GROUP BY year, week_number
ORDER BY year DESC, week_number DESC
LIMIT 12;
```

### Get Attendance vs Burnout Correlation
```sql
SELECT 
  DATE_TRUNC('week', a.date) as week_start,
  AVG(CASE WHEN a.status = 'Absent' THEN 1.0 ELSE 0.0 END) as absence_rate,
  AVG(c.burnout_score) as avg_burnout
FROM attendance a
LEFT JOIN check_ins c ON DATE(c.submitted_at) = a.date AND c.team_id = a.team_id
WHERE a.team_id = 1
  AND a.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', a.date)
ORDER BY week_start DESC;
```

---

## Migration Script

The database schema is created by running:
```bash
cd backend
npm run migrate
```

This executes `migrations/schema.sql` and creates:
- All tables
- All indexes
- All triggers
- Default admin user (admin@company.com / admin123)

**⚠️ Remember to change the default admin password in production!**

---

## Backup Recommendations

1. **Daily automated backups** using `pg_dump`
2. **Retain backups for 30 days**
3. **Test restore procedures regularly**
4. **Encrypt backups** for sensitive data
5. **Store backups off-site** (S3, etc.)

---

## Future Enhancements

Potential schema additions:
- `alerts` table for burnout threshold alerts
- `notifications` table for manager notifications
- `export_history` table for audit trail
- `team_settings` table for team-specific configurations

---

For questions or schema modifications, refer to the main README.md or contact the development team.

