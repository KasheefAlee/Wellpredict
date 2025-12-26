const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🔄 Running database migrations...');
    await pool.query(schema);
    console.log('✅ Database schema created successfully!');
    
    /**
     * SECURITY: Do NOT create a default admin with a hard-coded password.
     * For local/dev, you may opt-in via env vars.
     */
    const shouldCreateDefaultAdmin =
      (process.env.CREATE_DEFAULT_ADMIN || '').toLowerCase() === 'true';

    if (shouldCreateDefaultAdmin) {
      const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
      const adminPasswordPlain = process.env.DEFAULT_ADMIN_PASSWORD;
      const adminName = process.env.DEFAULT_ADMIN_NAME || 'System Admin';

      if (!adminEmail || !adminPasswordPlain) {
        console.log('⚠️  Skipping default admin creation: DEFAULT_ADMIN_EMAIL/PASSWORD not set.');
      } else {
        const bcrypt = require('bcrypt');
        const adminPassword = await bcrypt.hash(String(adminPasswordPlain), 10);

        const checkAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

        if (checkAdmin.rows.length === 0) {
          await pool.query(
            'INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, TRUE)',
            [adminEmail, adminPassword, adminName, 'admin']
          );
          console.log(`✅ Default admin user created (${adminEmail})`);
        } else {
          console.log(`ℹ️  Default admin already exists (${adminEmail})`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();

