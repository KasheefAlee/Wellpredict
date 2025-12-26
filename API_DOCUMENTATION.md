# API Documentation

Complete API reference for the Employee Wellbeing & Burnout Monitoring Platform.

**Base URL**: `http://localhost:5000/api` (development) or `https://api.yourdomain.com/api` (production)

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Auth Endpoints

### POST `/auth/login`

Login and receive JWT token.

**Request Body:**
```json
{
  "email": "admin@company.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "full_name": "System Admin",
    "role": "admin"
  }
}
```

---

### POST `/auth/register`

Register new user (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "manager@company.com",
  "password": "securepassword",
  "full_name": "John Manager",
  "role": "manager"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 2,
    "email": "manager@company.com",
    "full_name": "John Manager",
    "role": "manager"
  }
}
```

---

### GET `/auth/me`

Get current authenticated user info.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "full_name": "System Admin",
    "role": "admin"
  }
}
```

---

## Teams Endpoints

### GET `/teams`

Get all teams. Managers see only their teams.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "teams": [
    {
      "id": 1,
      "team_code": "TEAM-A",
      "team_name": "Engineering Team",
      "manager_id": 2,
      "manager_name": "John Manager",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/teams/:id`

Get single team details.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "team": {
    "id": 1,
    "team_code": "TEAM-A",
    "team_name": "Engineering Team",
    "manager_id": 2,
    "manager_name": "John Manager"
  }
}
```

---

### POST `/teams`

Create new team (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "team_code": "TEAM-B",
  "team_name": "Marketing Team",
  "manager_id": 2
}
```

**Response:**
```json
{
  "message": "Team created successfully",
  "team": {
    "id": 2,
    "team_code": "TEAM-B",
    "team_name": "Marketing Team",
    "manager_id": 2
  }
}
```

---

### POST `/teams/:id/token`

Generate check-in token for team.

**Headers:** `Authorization: Bearer <token>`

**Request Body (optional):**
```json
{
  "expires_at": "2026-01-15T00:00:00.000Z"
}
```

**Response:**
```json
{
  "message": "Token generated successfully",
  "token": {
    "id": 1,
    "team_id": 1,
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "is_active": true,
    "expires_at": "2026-01-15T00:00:00.000Z"
  },
  "checkin_url": "http://localhost:3000/checkin/TEAM-A?token=550e8400-e29b-41d4-a716-446655440000"
}
```

---

### GET `/teams/:id/tokens`

Get all tokens for a team.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "tokens": [
    {
      "id": 1,
      "token": "550e8400-e29b-41d4-a716-446655440000",
      "is_active": true,
      "expires_at": "2026-01-15T00:00:00.000Z",
      "usage_count": "5"
    }
  ]
}
```

---

## Check-in Endpoints

### POST `/checkin/submit`

Submit anonymous check-in (no authentication required).

**Request Body:**
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "workload": 3,
  "stress": 2,
  "sleep": 2,
  "engagement": 3,
  "recovery": 2
}
```

**Note:** All parameters must be integers between 0 and 4.

**Response:**
```json
{
  "message": "Check-in submitted successfully",
  "burnout_score": 60.0,
  "risk_level": "moderate",
  "submitted_at": "2025-01-15T10:30:00.000Z"
}
```

---

### GET `/checkin/verify/:token`

Verify if check-in token is valid.

**Response:**
```json
{
  "valid": true,
  "team": {
    "code": "TEAM-A",
    "name": "Engineering Team"
  }
}
```

---

## Dashboard Endpoints

### GET `/dashboard/team/:teamId/overview`

Get team burnout overview and trends.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `period` (optional): `week` or `month` (default: `week`)
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "team": {
    "id": 1,
    "team_code": "TEAM-A",
    "team_name": "Engineering Team"
  },
  "overview": {
    "average_burnout": "58.50",
    "total_checkins": 25,
    "active_days": 7
  },
  "risk_distribution": [
    {
      "risk_level": "moderate",
      "count": "15",
      "avg_score": "55.20"
    },
    {
      "risk_level": "high",
      "count": "10",
      "avg_score": "72.30"
    }
  ],
  "trends": [
    {
      "year": 2025,
      "week_number": 3,
      "avg_burnout": "58.50",
      "checkin_count": "5"
    }
  ]
}
```

---

### GET `/dashboard/team/:teamId/correlation`

Get attendance vs burnout correlation.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "weekly_correlation": [
    {
      "week_start": "2025-01-13T00:00:00.000Z",
      "total_days": 5,
      "absent_days": 2,
      "avg_burnout": "62.50",
      "checkin_count": 5
    }
  ],
  "overall": {
    "absence_rate": "0.1500",
    "average_burnout": "58.50"
  }
}
```

---

### GET `/dashboard/team/:teamId/activity`

Get check-in activity heatmap data.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "activity": [
    {
      "date": "2025-01-15",
      "checkin_count": 5,
      "avg_burnout": "58.50"
    }
  ]
}
```

---

## Attendance Endpoints

### POST `/attendance/upload`

Upload attendance CSV/Excel file.

**Headers:** `Authorization: Bearer <token>`

**Request:** Multipart form data with `file` field

**File Format (CSV):**
```csv
employee_id,team_id,date,status
E1,TEAM-A,2025-01-15,Present
E2,TEAM-A,2025-01-15,Absent
E1,TEAM-A,2025-01-16,Present
```

**Response:**
```json
{
  "message": "Attendance data uploaded successfully",
  "summary": {
    "total_records": 100,
    "inserted": 95,
    "updated": 5,
    "skipped": 0,
    "errors": 0
  }
}
```

---

### GET `/attendance/template`

Get attendance upload template.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "template": [
    {
      "employee_id": "E1",
      "team_id": "TEAM-A",
      "date": "2025-01-15",
      "status": "Present"
    }
  ],
  "instructions": {
    "employee_id": "Unique identifier for employee (string)",
    "team_id": "Team code (must match existing team)",
    "date": "Date in YYYY-MM-DD format",
    "status": "One of: Present, Absent, Leave, Sick"
  }
}
```

---

### GET `/attendance/team/:teamId/stats`

Get attendance statistics for a team.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "statistics": {
    "total_records": 100,
    "unique_employees": 20,
    "days_covered": 30,
    "absence_rate": "15.00",
    "breakdown": {
      "present": 80,
      "absent": 15,
      "leave": 3,
      "sick": 2
    }
  }
}
```

---

## Export Endpoints

### GET `/export/team/:teamId/csv`

Export check-in data as CSV.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:** CSV file download

---

### GET `/export/team/:teamId/excel`

Export comprehensive Excel report.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:** Excel file (.xlsx) download with:
- Summary sheet (statistics, risk distribution)
- Check-in data sheet (all submissions)

---

### GET `/export/team/:teamId/pdf`

Export PDF report.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:** PDF file download

---

## Error Responses

All endpoints may return error responses:

**400 Bad Request:**
```json
{
  "error": "Validation error",
  "errors": [
    {
      "msg": "Invalid email",
      "param": "email"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "error": "No token provided"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "error": "Team not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

Currently no rate limiting implemented. Consider adding for production:
- Express-rate-limit for API endpoints
- Specific limits for check-in submissions

---

## Data Models

### Check-in Parameters

All check-in parameters use a 0-4 scale:
- **0**: Very Low
- **1**: Low
- **2**: Moderate
- **3**: High
- **4**: Very High

### Burnout Score Calculation

```
Score = (Sum of all 5 parameters / 20) * 100
```

### Risk Levels

- **0-30**: Low
- **31-60**: Moderate
- **61-80**: High
- **81-100**: Critical

---

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}'
```

### Submit Check-in
```bash
curl -X POST http://localhost:5000/api/checkin/submit \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token-here",
    "workload": 3,
    "stress": 2,
    "sleep": 2,
    "engagement": 3,
    "recovery": 2
  }'
```

### Get Dashboard Data
```bash
curl -X GET http://localhost:5000/api/dashboard/team/1/overview?period=week \
  -H "Authorization: Bearer your-token-here"
```

---

For more examples, see the frontend code in `frontend/lib/api.js`.

