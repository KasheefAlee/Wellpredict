-- Employee Wellbeing & Burnout Monitoring Platform Database Schema

-- Users table (for admins and managers)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'hr')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    team_code VARCHAR(100) UNIQUE NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team tokens for anonymous check-in links
CREATE TABLE IF NOT EXISTS team_tokens (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Anonymous check-ins (NO user identification stored)
CREATE TABLE IF NOT EXISTS check_ins (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    token_used VARCHAR(255), -- Reference to token, but not identifying user
    workload INTEGER NOT NULL CHECK (workload >= 0 AND workload <= 4),
    stress INTEGER NOT NULL CHECK (stress >= 0 AND stress <= 4),
    sleep INTEGER NOT NULL CHECK (sleep >= 0 AND sleep <= 4),
    engagement INTEGER NOT NULL CHECK (engagement >= 0 AND engagement <= 4),
    recovery INTEGER NOT NULL CHECK (recovery >= 0 AND recovery <= 4),
    burnout_score DECIMAL(5,2) NOT NULL, -- Calculated score 0-100
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    week_number INTEGER, -- Week of year for easier querying
    month_number INTEGER, -- Month for easier querying
    year INTEGER -- Year for easier querying
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    employee_id VARCHAR(100), -- Optional identifier, not linked to users
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave', 'Sick')),
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, employee_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_ins_team_id ON check_ins(team_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_submitted_at ON check_ins(submitted_at);
CREATE INDEX IF NOT EXISTS idx_check_ins_week_month_year ON check_ins(year, month_number, week_number);
CREATE INDEX IF NOT EXISTS idx_attendance_team_id ON attendance(team_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_team_tokens_token ON team_tokens(token);
CREATE INDEX IF NOT EXISTS idx_team_tokens_team_id ON team_tokens(team_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
    ) THEN
        EXECUTE 'CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
                 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at'
    ) THEN
        EXECUTE 'CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
                 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- Ensure is_active columns exist on existing deployments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'teams' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE teams ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Ensure role CHECK constraint supports hr on existing deployments
DO $$
BEGIN
    -- Postgres expands IN() to an ANY(array) expression in constraint defs, so
    -- rely on the canonical constraint name in this project.
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check';
    EXECUTE 'ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (''admin'', ''manager'', ''hr''))';
EXCEPTION
    WHEN undefined_table THEN
        -- Fresh DB or non-postgres-compatible state; ignore
        NULL;
END $$;

