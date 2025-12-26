# Installing Node.js on Windows

## Quick Install (Recommended)

### Option 1: Download from Official Website

1. **Go to:** https://nodejs.org/
2. **Download the LTS version** (Long Term Support) - should be version 18 or higher
3. **Run the installer** (.msi file)
4. **Follow the installation wizard:**
   - Click "Next" through the setup
   - Accept the license agreement
   - Keep default installation path
   - **IMPORTANT:** Make sure "Add to PATH" is checked
   - Click "Install"
5. **Restart your terminal/command prompt** after installation

### Option 2: Using Chocolatey (If you have it)

```bash
choco install nodejs-lts
```

### Option 3: Using Winget (Windows 10/11)

```bash
winget install OpenJS.NodeJS.LTS
```

---

## Verify Installation

After installing, **close and reopen your terminal**, then run:

```bash
node --version
npm --version
```

You should see version numbers like:
```
v18.17.0
9.6.7
```

If you see version numbers, Node.js is installed correctly! ✅

---

## If Still Not Working

### Check PATH Environment Variable

1. **Search for "Environment Variables"** in Windows Start menu
2. Click **"Edit the system environment variables"**
3. Click **"Environment Variables"** button
4. Under **"System variables"**, find **"Path"**
5. Click **"Edit"**
6. Look for entries like:
   - `C:\Program Files\nodejs\`
   - `C:\Program Files (x86)\nodejs\`
7. If not there, click **"New"** and add: `C:\Program Files\nodejs\`
8. Click **"OK"** on all windows
9. **Restart your terminal**

---

## Install PostgreSQL Too

You'll also need PostgreSQL for the database:

1. **Go to:** https://www.postgresql.org/download/windows/
2. **Download the installer** (use the official installer)
3. **Run the installer:**
   - Choose installation directory (default is fine)
   - Select components (keep defaults)
   - Choose data directory (default is fine)
   - **Set a password for the postgres user** - REMEMBER THIS!
   - Port: 5432 (default)
   - Locale: Default
   - Click "Next" through the rest
4. **During installation, it will ask to install Stack Builder** - you can skip this

**Remember the PostgreSQL password you set!** You'll need it for the `.env` file.

---

## After Installing Both

1. **Close and reopen your terminal**
2. **Verify Node.js:**
   ```bash
   node --version
   npm --version
   ```

3. **Verify PostgreSQL:**
   ```bash
   psql --version
   ```

4. **Now you can continue with the setup:**
   ```bash
   npm run install:all
   ```

---

## Quick Links

- **Node.js Download:** https://nodejs.org/
- **PostgreSQL Download:** https://www.postgresql.org/download/windows/
- **Node.js Documentation:** https://nodejs.org/en/docs/

---

**Once both are installed, come back and continue with the setup!** 🚀


