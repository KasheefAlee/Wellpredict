# Setup Checklist

Use this checklist to ensure proper setup of the Employee Wellbeing Platform.

## Pre-Installation

- [ ] Node.js 18+ installed (`node --version`)
- [ ] PostgreSQL 12+ installed and running
- [ ] npm or yarn package manager installed
- [ ] Git installed (for version control)

## Installation Steps

### 1. Dependencies
- [ ] Run `npm run install:all` from project root
- [ ] Verify `backend/node_modules` exists
- [ ] Verify `frontend/node_modules` exists

### 2. Database Setup
- [ ] PostgreSQL service is running
- [ ] Database `wellbeing_db` created
- [ ] Database user has proper permissions
- [ ] `backend/.env` file created from `.env.example`
- [ ] Database credentials configured in `.env`
- [ ] JWT_SECRET set (min 32 characters)
- [ ] Migrations run successfully (`npm run migrate` in backend)
- [ ] Default admin user created

### 3. Backend Configuration
- [ ] `backend/.env` configured with:
  - [ ] DB_HOST
  - [ ] DB_PORT
  - [ ] DB_NAME
  - [ ] DB_USER
  - [ ] DB_PASSWORD
  - [ ] JWT_SECRET
  - [ ] PORT (default: 5000)
  - [ ] FRONTEND_URL
- [ ] Backend starts without errors
- [ ] Health check endpoint works: `http://localhost:5000/api/health`

### 4. Frontend Configuration
- [ ] `frontend/.env.local` created (optional, uses defaults)
- [ ] NEXT_PUBLIC_API_URL set (or uses default)
- [ ] Frontend starts without errors
- [ ] Frontend accessible at `http://localhost:3000`

## Testing Checklist

### Authentication
- [ ] Can login with default admin credentials
- [ ] JWT token received after login
- [ ] Token persists in cookies
- [ ] Logout works correctly

### Admin Functions
- [ ] Can create a new team
- [ ] Can generate check-in token
- [ ] Check-in URL is valid
- [ ] Can upload attendance file (CSV/Excel)

### Check-in System
- [ ] Can access check-in form via token URL
- [ ] Form displays correctly (no login required)
- [ ] Can submit check-in with all 5 parameters
- [ ] Burnout score calculated correctly
- [ ] Submission is anonymous (no user data stored)

### Dashboard
- [ ] Dashboard loads after login
- [ ] Team selector works
- [ ] Burnout score displays correctly
- [ ] Trend chart shows data
- [ ] Risk distribution chart works
- [ ] Activity heatmap displays
- [ ] Correlation chart shows (if attendance data exists)

### Export Functions
- [ ] CSV export downloads
- [ ] Excel export downloads
- [ ] PDF export downloads
- [ ] Exported files contain correct data

## Security Checklist

- [ ] Default admin password changed (in production)
- [ ] JWT_SECRET is strong and unique
- [ ] Database password is secure
- [ ] .env files are in .gitignore
- [ ] No sensitive data in code
- [ ] HTTPS configured (in production)
- [ ] CORS properly configured

## Production Deployment Checklist

- [ ] Environment variables set on server
- [ ] Database backups configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Process manager (PM2) set up
- [ ] Nginx/reverse proxy configured
- [ ] Monitoring set up
- [ ] Error logging configured
- [ ] Default admin password changed
- [ ] All documentation reviewed

## Documentation Review

- [ ] README.md reviewed
- [ ] API_DOCUMENTATION.md reviewed
- [ ] DEPLOYMENT.md reviewed
- [ ] DATABASE_SCHEMA.md reviewed
- [ ] QUICK_START.md reviewed

## Final Verification

- [ ] All features working as expected
- [ ] No console errors
- [ ] No database errors
- [ ] API endpoints responding correctly
- [ ] Frontend displays correctly
- [ ] Mobile responsive (test on different screen sizes)
- [ ] Browser compatibility tested

## Post-Setup

- [ ] Create additional users (managers)
- [ ] Create teams
- [ ] Generate check-in links
- [ ] Test complete workflow:
  1. Admin creates team
  2. Admin generates token
  3. Employee submits check-in
  4. Manager views dashboard
  5. Manager exports data

---

**Once all items are checked, the platform is ready for use!** ✅

