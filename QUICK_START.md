# Quick Start Guide

Get the Employee Wellbeing Platform running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ installed and running
- npm or yarn

## Step 1: Install Dependencies

```bash
# From project root
npm run install:all
```

This installs dependencies for both backend and frontend.

## Step 2: Setup Database

1. **Create PostgreSQL database:**
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE wellbeing_db;

# Exit
\q
```

2. **Configure backend environment:**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wellbeing_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

3. **Run database migrations:**
```bash
cd backend
npm run migrate
```

This creates all tables and a default admin user:
- **Email:** admin@company.com
- **Password:** admin123

⚠️ **Change this password in production!**

## Step 3: Start Development Servers

From the project root:

```bash
npm run dev
```

Or run separately:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Step 4: Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

## Step 5: First Steps

1. **Login as Admin:**
   - Go to http://localhost:3000/login
   - Email: `admin@company.com`
   - Password: `admin123`

2. **Create a Team:**
   - Navigate to Admin Panel
   - Click "Create Team"
   - Enter team code (e.g., "TEAM-A") and name
   - Save

3. **Generate Check-in Link:**
   - In Admin Panel, find your team
   - Click "Generate Check-in Link"
   - Copy the URL (e.g., `http://localhost:3000/checkin/TEAM-A?token=...`)

4. **Submit a Test Check-in:**
   - Open the check-in URL in a new browser/incognito window
   - Fill out the form (no login required)
   - Submit

5. **View Dashboard:**
   - Go back to Dashboard
   - Select your team
   - See the burnout score and analytics!

## Testing the System

### Submit Check-in via API

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
# First, login to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}'

# Use the token from response
curl -X GET http://localhost:5000/api/dashboard/team/1/overview \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Common Issues

### Database Connection Error

- Verify PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or check Services (Windows)
- Check database credentials in `backend/.env`
- Ensure database exists: `psql -U postgres -l`

### Port Already in Use

- Backend: Change `PORT` in `backend/.env`
- Frontend: Change port in `frontend/package.json` scripts or use: `PORT=3001 npm run dev`

### Frontend Can't Connect to API

- Check `NEXT_PUBLIC_API_URL` in frontend (defaults to `http://localhost:5000/api`)
- Verify backend is running on port 5000
- Check CORS settings in `backend/server.js`

### Migration Errors

- Ensure PostgreSQL is running
- Check database user has CREATE privileges
- Try dropping and recreating database: `DROP DATABASE wellbeing_db; CREATE DATABASE wellbeing_db;`

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API reference
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for database structure

## Development Tips

1. **Backend logs:** Check terminal running `npm run dev` in backend folder
2. **Frontend logs:** Check browser console and terminal running Next.js
3. **Database queries:** Use `psql -U postgres -d wellbeing_db` to inspect data
4. **API testing:** Use Postman or curl for API testing
5. **Hot reload:** Both frontend and backend support hot reload on file changes

## Support

For issues or questions:
1. Check the documentation files
2. Review error messages in console/logs
3. Verify all prerequisites are installed
4. Ensure database is properly configured

---

**Happy coding! 🚀**

