# Employee Wellbeing & Burnout Monitoring Platform

A comprehensive MVP platform for monitoring employee wellbeing and burnout through anonymous check-ins, analytics dashboards, and attendance correlation.

## 🎯 Features

- **Anonymous Employee Check-ins**: Secure token-based system for weekly wellbeing surveys
- **Burnout Scoring**: Automated calculation of burnout scores (0-100) with risk level categorization
- **Manager Dashboard**: Team-level analytics, trends, and risk distribution
- **Attendance Correlation**: Compare attendance data with burnout metrics
- **Data Export**: CSV, Excel, and PDF report generation
- **Role-Based Access**: Admin and Manager roles with appropriate permissions
- **Security**: JWT authentication, password hashing, no IP storage for check-ins

## 🛠️ Tech Stack

### Backend
- Node.js + Express
- PostgreSQL
- JWT Authentication
- bcrypt for password hashing
- Puppeteer for PDF generation
- ExcelJS for Excel exports

### Frontend
- Next.js 14
- React 18
- Recharts for data visualization
- Tailwind CSS for styling

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Git

## 🚀 Installation

### 1. Clone and Install Dependencies

```bash
npm run install:all
```

### 2. Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE wellbeing_db;
```

2. Update `backend/.env` with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wellbeing_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_jwt_key_change_in_production
PORT=5000
FRONTEND_URL=http://localhost:3000
```

3. Run migrations:
```bash
cd backend
npm run migrate
```

This will create all database tables and indexes.

**Production note:** the migration script no longer creates a hard-coded default admin.
For local/dev you can opt-in via env variables (see `backend/.env.example`).

### 3. Start Development Servers

From the root directory:
```bash
npm run dev
```

Or run separately:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

- Backend API: http://localhost:5000
- Frontend: http://localhost:3000

## 📖 API Documentation

### Authentication

**POST** `/api/auth/login`
- Login and receive JWT token
- Body: `{ email, password }`

**POST** `/api/auth/register` (Admin only)
- Register new users
- Requires authentication
- Body: `{ email, password, full_name, role }`

**GET** `/api/auth/me`
- Get current user info
- Requires authentication

### Teams

**GET** `/api/teams`
- List all teams (managers see only their teams)

**POST** `/api/teams`
- Create new team (Admin only)
- Body: `{ team_code, team_name, manager_id? }`

**POST** `/api/teams/:id/token`
- Generate check-in token for team
- Returns check-in URL

### Check-ins

**POST** `/api/checkin/submit`
- Submit anonymous check-in (no auth required)
- Body: `{ token, workload, stress, sleep, engagement, recovery }`

**GET** `/api/checkin/verify/:token`
- Verify if token is valid

### Dashboard

**GET** `/api/dashboard/team/:teamId/overview`
- Get team burnout overview and trends

**GET** `/api/dashboard/team/:teamId/correlation`
- Get attendance vs burnout correlation

**GET** `/api/dashboard/team/:teamId/activity`
- Get check-in activity heatmap data

### Attendance

**POST** `/api/attendance/upload`
- Upload CSV/Excel attendance file
- Multipart form data with `file` field

**GET** `/api/attendance/template`
- Get attendance upload template

**GET** `/api/attendance/team/:teamId/stats`
- Get attendance statistics

### Export

**GET** `/api/export/team/:teamId/csv`
- Export check-in data as CSV

**GET** `/api/export/team/:teamId/excel`
- Export comprehensive Excel report

**GET** `/api/export/team/:teamId/pdf`
- Export PDF report

## 🔐 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **No IP Storage**: Check-ins are completely anonymous
- **Role-Based Access Control**: Admin and Manager roles
- **Input Validation**: Express-validator for all inputs
- **SQL Injection Protection**: Parameterized queries

## 📊 Burnout Scoring

The burnout score is calculated from 5 parameters (each 0-4):
- Workload
- Stress
- Sleep
- Engagement
- Recovery

**Formula (risk-based)**:
- Workload (manageability), Sleep, Engagement, Recovery are **protective** (higher = better) and are inverted for risk.
- Stress is **direct risk** (higher = worse).

`risk = (4-workload) + stress + (4-sleep) + (4-engagement) + (4-recovery)`

`Score = (risk / 20) * 100`

## 🚀 Free Deployment (Render + Railway)

### Railway (PostgreSQL) — free DB
- Create a new Railway project and add **PostgreSQL**
- Copy the connection URL (Railway provides a `DATABASE_URL`)
- Either run migrations from your backend:

```bash
cd backend
# set env vars or export DATABASE_URL
npm run migrate
```

Or use Railway’s SQL editor to run `backend/migrations/schema.sql`.

### Render (Backend) — free web service
- Create a new **Web Service** from your GitHub repo
- **Root directory**: `backend`
- **Build command**: `npm install`
- **Start command**: `npm start`

Set these environment variables on Render:
- `DATABASE_URL` (recommended) **or** `DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default `7d`)
- `NODE_ENV=production`
- `FRONTEND_URL` (for CORS + link generation)
- `PORT` (Render sets this automatically; backend uses `process.env.PORT`)

After deploy, verify:
- `GET /health` → `{ "status": "ok" }`

### Postman quick test
1. `POST /api/auth/login` (get JWT)
2. Use `Authorization: Bearer <token>` for protected endpoints
3. `GET /api/teams`
4. `GET /api/dashboard/team/:teamId/overview`
5. `GET /api/export/team/:teamId/csv`

**Risk Levels**:
- 0-30: Low
- 31-60: Moderate
- 61-80: High
- 81-100: Critical

## 📁 Project Structure

```
.
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   └── auth.js
│   ├── migrations/
│   │   ├── schema.sql
│   │   └── runMigrations.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── teams.js
│   │   ├── checkins.js
│   │   ├── dashboard.js
│   │   ├── attendance.js
│   │   └── export.js
│   ├── utils/
│   │   └── burnoutCalculator.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── pages/
│   ├── components/
│   ├── lib/
│   └── package.json
└── README.md
```

## 🧪 Testing the System

1. **Login as Admin**:
   - Email: `admin@company.com`
   - Password: `admin123`

2. **Create a Team**:
   - Use the admin panel to create a team
   - Assign a manager (optional)

3. **Generate Check-in Token**:
   - Navigate to team details
   - Generate a token
   - Copy the check-in URL

4. **Submit Check-in**:
   - Open the check-in URL (no login required)
   - Fill out the form
   - Submit anonymously

5. **View Dashboard**:
   - Login as manager
   - View team burnout metrics and trends

## 📝 Attendance Upload Format

CSV/Excel file should have these columns:
- `employee_id`: Unique employee identifier
- `team_id`: Team code (must match existing team)
- `date`: Date in YYYY-MM-DD format
- `status`: One of: `Present`, `Absent`, `Leave`, `Sick`

## 🚢 Deployment

### Backend Deployment

1. Set environment variables on your hosting platform
2. Run migrations: `npm run migrate`
3. Start server: `npm start`

### Frontend Deployment

1. Build: `npm run build`
2. Start: `npm start`

### Database

Ensure PostgreSQL is accessible and backups are configured.

## 📄 License & IP

All code and intellectual property belong to the client after full payment. Full source code, documentation, and deployment instructions are included.

## 🐛 Support

30-day free bug fix support included after delivery. Contact for issues or questions.

## 📞 Contact

For questions or support, please contact the development team.

---

**Built with ❤️ for employee wellbeing**

