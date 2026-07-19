const { neon } = require('@neondatabase/serverless');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Helper function to get database connection and run setup
async function initDbSchema(sql) {
  try {
    // Create users table
    await sql(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        passcode VARCHAR(255) NOT NULL,
        security_question VARCHAR(255),
        security_answer VARCHAR(255),
        otp_code VARCHAR(10),
        otp_expiry VARCHAR(50)
      )
    `);

    // Create login_logs table
    await sql(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        timestamp VARCHAR(50) NOT NULL
      )
    `);

    // Seed default admin if table is empty
    const countRes = await sql(`SELECT COUNT(*) FROM users`);
    const count = parseInt(countRes[0].count);
    if (count === 0) {
      await sql(`
        INSERT INTO users (email, passcode, security_question, security_answer)
        VALUES ($1, $2, $3, $4)
      `, ['admin@ieee.org', 'IEEE@2026', 'What is the default recovery code?', 'IEEE@2026']);
    }

    // Automatically delete login logs older than 60 days to save space and maintain privacy
    const sixtyDaysAgo = new Date(new Date().getTime() - 60 * 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    await sql(`DELETE FROM login_logs WHERE timestamp < $1`, [sixtyDaysAgo]);
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

// Mail Forwarding Helper to Google Apps Script
async function forwardMailToGas(action, payload) {
  const gasUrl = process.env.VITE_GAS_URL;
  if (!gasUrl) {
    console.warn("VITE_GAS_URL not configured. Mail forwarding bypassed.");
    return false;
  }

  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: action,
        ...payload
      })
    });
    const result = await res.json();
    return result.success;
  } catch (err) {
    console.error(`Mail forwarding failed for action ${action}:`, err);
    return false;
  }
}

module.exports = async (req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ 
      success: false, 
      error: "DATABASE_URL environment variable is not configured. Please link your Neon database in the Vercel dashboard." 
    });
  }

  const sql = neon(databaseUrl);

  // Auto-initialize DB structure
  await initDbSchema(sql);

  // Extract action parameter (can be in query string or post payload)
  let action = req.query.action || (req.body && req.body.action);
  let params = { ...req.query, ...(req.body || {}) };

  try {
    if (action === 'verifyUserLogin') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      const passcode = params.passcode;
      if (!email || !passcode) {
        return res.status(400).json({ success: false, error: "Missing email or passcode parameter" });
      }

      const users = await sql(`SELECT passcode, security_question, security_answer FROM users WHERE email = $1`, [email]);
      if (users.length === 0) {
        return res.status(200).json({ success: true, verified: false, error: "User not found" });
      }

      const user = users[0];
      if (user.passcode === passcode) {
        // Generate OTP and expiration (10 minutes)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = (new Date().getTime() + 10 * 60 * 1000).toString();

        await sql(`UPDATE users SET otp_code = $1, otp_expiry = $2 WHERE email = $3`, [otp, expiry, email]);

        // Forward mail request to Google Apps Script
        await forwardMailToGas('sendHostEmail', { email, otp });

        return res.status(200).json({ 
          success: true, 
          otpRequired: true, 
          email: email 
        });
      } else {
        return res.status(200).json({ success: true, verified: false, error: "Incorrect passcode" });
      }

    } else if (action === 'verifyUserOtp') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      const otp = params.otp;
      if (!email || !otp) {
        return res.status(400).json({ success: false, error: "Missing email or OTP verification code" });
      }

      const users = await sql(`SELECT otp_code, otp_expiry, security_question, security_answer FROM users WHERE email = $1`, [email]);
      if (users.length === 0) {
        return res.status(200).json({ success: true, verified: false, error: "User not found" });
      }

      const user = users[0];
      const currentTime = new Date().getTime();

      if (user.otp_code === otp && user.otp_expiry && currentTime <= parseInt(user.otp_expiry)) {
        // Valid OTP: Clear OTP fields
        await sql(`UPDATE users SET otp_code = NULL, otp_expiry = NULL WHERE email = $1`, [email]);

        // Log session audit in Neon Postgres
        const timeZone = "GMT+5:30";
        // Calculate offset date string
        const formattedDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        await sql(`INSERT INTO login_logs (email, action, timestamp) VALUES ($1, $2, $3)`, [email, "Login", formattedDate]);

        return res.status(200).json({
          success: true,
          verified: true,
          user: {
            email: email,
            security_question: user.security_question,
            security_answer: user.security_answer
          }
        });
      } else {
        return res.status(200).json({ success: true, verified: false, error: "Invalid or expired verification code." });
      }

    } else if (action === 'getUserQuestion') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      if (!email) {
        return res.status(400).json({ success: false, error: "Missing email parameter" });
      }

      const users = await sql(`SELECT security_question FROM users WHERE email = $1`, [email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      return res.status(200).json({ success: true, security_question: users[0].security_question });

    } else if (action === 'verifyUserAnswer') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      const answer = params.answer;
      if (!email || !answer) {
        return res.status(400).json({ success: false, error: "Missing email or security answer" });
      }

      const users = await sql(`SELECT security_answer FROM users WHERE email = $1`, [email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const isVerified = answer.toString().trim().toLowerCase() === users[0].security_answer.toString().trim().toLowerCase();
      return res.status(200).json({ success: true, verified: isVerified });

    } else if (action === 'forgotUserPassword') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      if (!email) {
        return res.status(400).json({ success: false, error: "Missing email parameter" });
      }

      const users = await sql(`SELECT passcode FROM users WHERE email = $1`, [email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const passcode = users[0].passcode;
      // Forward recovery email call to Apps Script
      await forwardMailToGas('sendRecoveryEmail', { email, passcode });

      return res.status(200).json({ success: true, message: "Passcode has been emailed to you." });

    } else if (action === 'saveUserAccount') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      const passcode = params.passcode;
      const question = params.security_question;
      const answer = params.security_answer;

      if (!email || !passcode) {
        return res.status(400).json({ success: false, error: "Missing email or passcode parameters" });
      }

      // Check if user exists
      const countRes = await sql(`SELECT COUNT(*) FROM users WHERE email = $1`, [email]);
      const count = parseInt(countRes[0].count);

      if (count === 0) {
        await sql(`
          INSERT INTO users (email, passcode, security_question, security_answer)
          VALUES ($1, $2, $3, $4)
        `, [email, passcode, question || "What is the default recovery code?", answer || "IEEE@2026"]);
      } else {
        await sql(`
          UPDATE users 
          SET passcode = $1, security_question = $2, security_answer = $3
          WHERE email = $4
        `, [passcode, question || "What is the default recovery code?", answer || "IEEE@2026", email]);
      }

      return res.status(200).json({ success: true, message: "User account saved successfully." });

    } else if (action === 'logUserLogout') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      if (!email) {
        return res.status(400).json({ success: false, error: "Missing email parameter" });
      }

      const formattedDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      await sql(`INSERT INTO login_logs (email, action, timestamp) VALUES ($1, $2, $3)`, [email, "Logout", formattedDate]);

      return res.status(200).json({ success: true, message: "Logout logged successfully." });

    } else {
      return res.status(400).json({ success: false, error: "Unknown action: " + action });
    }
  } catch (error) {
    console.error("Auth server error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
