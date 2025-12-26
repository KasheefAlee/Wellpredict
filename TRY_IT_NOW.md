# 🚀 Try It Now - Step by Step

Follow these steps to get the Employee Wellbeing Platform running on your machine.

## ⚡ Quick Setup (5-10 minutes)

### Step 1: Check Prerequisites

Make sure you have these installed:

```bash
# Check Node.js (need version 18+)
node --version

# Check npm
npm --version

# Check PostgreSQL (need version 12+)
psql --version
```

**If you don't have PostgreSQL:**
- **Windows:** Download from https://www.postgresql.org/download/windows/
- **Mac:** `brew install postgresql@12` or download from postgresql.org
- **Linux:** `sudo apt install postgresql postgresql-contrib`

---

### Step 2: Install Dependencies

Open a terminal in the project folder and run:

```bash
npm run install:all
```

This installs all dependencies for both backend and frontend. It may take a few minutes.

---

### Step 3: Setup PostgreSQL Database

**Option A: Using Command Line (Recommended)**

```bash
# Windows: Open Command Prompt or PowerShell
# Mac/Linux: Open Terminal

# Connect to PostgreSQL (use your PostgreSQL password when prompted)
psql -U postgres

# In PostgreSQL prompt, run:
CREATE DATABASE wellbeing_db;

# Exit PostgreSQL
\q
```

**Option B: Using pgAdmin (GUI)**

1. Open pgAdmin
2. Right-click "Databases" → "Create" → "Database"
3. Name: `wellbeing_db`
4. Click "Save"

---

### Step 4: Configure Backend

1. **Create `.env` file:**
   ```bash
   cd backend
   copy .env.example .env    # Windows
   # OR
   cp .env.example .env      # Mac/Linux
   ```

2. **Edit `backend/.env`** with your database info:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=wellbeing_db
   DB_USER=postgres
   DB_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE
   JWT_SECRET=my_super_secret_key_12345_change_this
   JWT_EXPIRES_IN=7d
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

   **Replace `YOUR_POSTGRES_PASSWORD_HERE`** with your actual PostgreSQL password!

---

### Step 5: Run Database Migrations

```bash
# Make sure you're in the backend folder
cd backend
npm run migrate
```

You should see:
```
🔄 Running database migrations...
✅ Database schema created successfully!
✅ Default admin user created (admin@company.com / admin123)
⚠️  WARNING: Change default admin password in production!
```

---

### Step 6: Start the Application

**Option A: Run Both Together (Easiest)**

From the project root folder:
```bash
npm run dev
```

This starts both backend (port 5000) and frontend (port 3000).

**Option B: Run Separately (Better for debugging)**

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

You should see: `🚀 Server running on port 5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see: `Ready on http://localhost:3000`

---

### Step 7: Open in Browser

1. Go to: **http://localhost:3000**
2. You'll be redirected to the login page

---

## 🎯 Test the Application

### 1. Login as Admin

- **URL:** http://localhost:3000/login
- **Email:** `admin@company.com`
- **Password:** `admin123`

Click "Login" - you should see the dashboard!

---

### 2. Create a Team

1. Click **"Admin Panel"** button (or go to http://localhost:3000/admin)
2. Click **"Create Team"**
3. Fill in:
   - **Team Code:** `TEAM-A` (must be uppercase, no spaces)
   - **Team Name:** `Engineering Team`
4. Click **"Create Team"**

You should see your team appear in the list!

---

### 3. Generate Check-in Link

1. In Admin Panel, find your team
2. Click **"Generate Check-in Link"**
3. A popup will show the URL - **copy it!**

It looks like: `http://localhost:3000/checkin/TEAM-A?token=xxxx-xxxx-xxxx`

---

### 4. Submit a Test Check-in

1. **Open the check-in URL** in a new browser window (or incognito)
2. You'll see the anonymous check-in form
3. Fill in all 5 questions (select 0-4 for each):
   - Workload: 3
   - Stress: 2
   - Sleep: 2
   - Engagement: 3
   - Recovery: 2
4. Click **"Submit Check-in"**
5. You'll see a success message! ✅

---

### 5. View Dashboard

1. Go back to the dashboard (http://localhost:3000/dashboard)
2. Select your team from the dropdown
3. You should see:
   - **Burnout Score** (e.g., 60.0/100)
   - **Trend Chart** showing the check-in
   - **Risk Distribution** chart
   - **Activity Heatmap**

---

### 6. Try Export

1. On the dashboard, click **"Export CSV"** or **"Export Excel"**
2. A file should download with your data!

---

## 🧪 Test More Features

### Upload Attendance Data

1. Go to Admin Panel → **"Attendance Upload"** tab
2. Create a CSV file with this content:
   ```csv
   employee_id,team_id,date,status
   E1,TEAM-A,2025-01-15,Present
   E2,TEAM-A,2025-01-15,Absent
   E1,TEAM-A,2025-01-16,Present
   ```
3. Save as `attendance.csv`
4. Upload it in the admin panel
5. Go back to dashboard to see correlation charts!

---

### Submit Multiple Check-ins

1. Generate more check-in links (or reuse the same one)
2. Submit check-ins with different values
3. Watch the dashboard update with trends!

---

## 🐛 Troubleshooting

### "Cannot connect to database"

- ✅ Is PostgreSQL running?
  - Windows: Check Services → PostgreSQL
  - Mac: `brew services start postgresql`
  - Linux: `sudo systemctl start postgresql`
- ✅ Check password in `backend/.env`
- ✅ Verify database exists: `psql -U postgres -l`

### "Port 5000 already in use"

- Change `PORT=5001` in `backend/.env`
- Update `FRONTEND_URL` if needed

### "Port 3000 already in use"

- Frontend will automatically try 3001, 3002, etc.
- Or set manually: `PORT=3001 npm run dev` in frontend folder

### "Module not found" errors

- Run `npm run install:all` again
- Delete `node_modules` folders and reinstall:
  ```bash
  rm -rf node_modules backend/node_modules frontend/node_modules
  npm run install:all
  ```

### Frontend shows "Failed to fetch"

- ✅ Is backend running? Check http://localhost:5000/api/health
- ✅ Check browser console for errors
- ✅ Verify `NEXT_PUBLIC_API_URL` in frontend (or use default)

---

## 📊 What to Test

- [x] Login/Logout
- [x] Create team
- [x] Generate check-in token
- [x] Submit anonymous check-in
- [x] View dashboard with data
- [x] See burnout score calculation
- [x] View charts and trends
- [x] Export data (CSV/Excel/PDF)
- [x] Upload attendance file
- [x] See attendance correlation

---

## 🎉 Success!

If you can:
- ✅ Login
- ✅ Create a team
- ✅ Submit a check-in
- ✅ See the dashboard with data

**Congratulations! The platform is working!** 🚀

---

## 📚 Next Steps

- Read [README.md](README.md) for full documentation
- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production setup

---

**Need help?** Check the error messages in:
- Backend terminal (for API errors)
- Browser console (F12) for frontend errors
- Database logs for connection issues

Happy testing! 🎯


