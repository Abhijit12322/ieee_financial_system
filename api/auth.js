import { neon } from '@neondatabase/serverless';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Helper function to hash passcodes using SHA-256 for secure encryption in the database
function hashPasscode(passcode) {
  if (!passcode) return '';
  return crypto.createHash('sha256').update(passcode).digest('hex');
}

// Helper function to initialize database tables and apply migrations
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
        otp_expiry VARCHAR(50),
        is_verified BOOLEAN DEFAULT FALSE
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

    // Create yearly_spreadsheets table
    await sql(`
      CREATE TABLE IF NOT EXISTS yearly_spreadsheets (
        id SERIAL PRIMARY KEY,
        year VARCHAR(20) NOT NULL,
        module_type VARCHAR(50) NOT NULL,
        spreadsheet_id VARCHAR(255) NOT NULL,
        spreadsheet_url TEXT,
        created_at VARCHAR(50) NOT NULL,
        CONSTRAINT unique_year_module UNIQUE(year, module_type)
      )
    `);

    // Migration: Add is_verified column to existing 'users' table if it doesn't exist
    try {
      await sql(`ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE`);
    } catch (e) {}



    // Automatically delete login logs older than 60 days to save space and maintain privacy
    const sixtyDaysAgo = new Date(new Date().getTime() - 60 * 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    await sql(`DELETE FROM login_logs WHERE timestamp < $1`, [sixtyDaysAgo]);
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

// Mail Dispatcher using Gmail App Password via SMTP (port 587 TLS/STARTTLS)
async function sendEmailViaGmail(toEmail, subject, textContent) {
  const gmailUser = process.env.SENDER_EMAIL;
  // Automatically strip any spaces from Gmail App Password (usually pasted as "abcd efgh ijkl mnop")
  const gmailAppPass = process.env.SENDER_PASSWORD ? process.env.SENDER_PASSWORD.replace(/\s+/g, '') : '';

  if (!gmailUser || !gmailAppPass) {
    return { success: false, error: "SMTP credentials (SENDER_EMAIL / SENDER_PASSWORD) not configured on Vercel." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // false for port 587 (TLS/STARTTLS)
      auth: {
        user: gmailUser,
        pass: gmailAppPass
      }
    });

    await transporter.sendMail({
      from: `"Portal Security" <${gmailUser}>`,
      to: toEmail,
      subject: subject,
      text: textContent
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to send email via SMTP nodemailer:", err);
    return { success: false, error: err.message };
  }
}

export default async (req, res) => {
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

      const users = await sql(`SELECT passcode, security_question, security_answer, is_verified FROM users WHERE email = $1`, [email]);
      if (users.length === 0) {
        return res.status(200).json({ success: true, verified: false, error: "User not found" });
      }

      const user = users[0];
      // Compare entered passcode encrypted hash with stored encrypted hash
      if (user.passcode !== hashPasscode(passcode)) {
        return res.status(200).json({ success: true, verified: false, error: "Incorrect passcode" });
      }

      if (!user.is_verified) {
        return res.status(200).json({ success: true, verified: false, error: "This account is pending host authorization. Please sign up again to request verification." });
      }

      // Valid Credentials & Verified: Log directly into dashboard (No OTP needed for logins!)
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

    } else if (action === 'requestSignUpOtp') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      const passcode = params.passcode;
      const question = params.security_question;
      const answer = params.security_answer;

      if (!email || !passcode || !question || !answer) {
        return res.status(400).json({ success: false, error: "All parameters are required (email, passcode, security_question, security_answer)." });
      }

      // Check if user is already registered and verified
      const checkRes = await sql(`SELECT is_verified FROM users WHERE email = $1`, [email]);
      if (checkRes.length > 0 && checkRes[0].is_verified) {
        return res.status(200).json({ success: false, error: "An account with this email already exists." });
      }

      // Generate OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = (new Date().getTime() + 10 * 60 * 1000).toString(); // Valid for 10 minutes

      // Upsert temporary user state (encrypt passcode before storing)
      const encryptedPasscode = hashPasscode(passcode);
      if (checkRes.length === 0) {
        await sql(`
          INSERT INTO users (email, passcode, security_question, security_answer, otp_code, otp_expiry, is_verified)
          VALUES ($1, $2, $3, $4, $5, $6, FALSE)
        `, [email, encryptedPasscode, question, answer, otp, expiry]);
      } else {
        await sql(`
          UPDATE users 
          SET passcode = $1, security_question = $2, security_answer = $3, otp_code = $4, otp_expiry = $5, is_verified = FALSE
          WHERE email = $6
        `, [encryptedPasscode, question, answer, otp, expiry, email]);
      }

      // Send OTP code to the designated HOST_EMAIL (falls back to SENDER_EMAIL if not set)
      const hostEmail = process.env.HOST_EMAIL || process.env.SENDER_EMAIL || "admin@ieee.org";
      console.log(`[SMTP Debug] Attempting to send registration OTP to: ${hostEmail}`);
      const subject = "IEEE SB Financial Portal - Registration Authorization Request";
      const content = `Hello Host,\n\nA registration attempt was initiated for user: ${email}.\n\nTo authorize their account creation, please share the following verification code with them:\n\nVerification Code: ${otp}\n\nThis security code will expire in 10 minutes.\n\nRegards,\nPortal Security System`;

      const emailResult = await sendEmailViaGmail(hostEmail, subject, content);
      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          error: `Failed to dispatch verification email: ${emailResult.error}. Please check your SMTP credentials (SENDER_EMAIL / SENDER_PASSWORD) on Vercel.`
        });
      }

      return res.status(200).json({
        success: true,
        otpRequired: true,
        email: email
      });

    } else if (action === 'verifySignUpOtp') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      const otp = params.otp;
      if (!email || !otp) {
        return res.status(400).json({ success: false, error: "Missing email or OTP verification code" });
      }

      const users = await sql(`SELECT otp_code, otp_expiry FROM users WHERE email = $1`, [email]);
      if (users.length === 0) {
        return res.status(200).json({ success: true, verified: false, error: "User not found" });
      }

      const user = users[0];
      const currentTime = new Date().getTime();

      if (user.otp_code === otp && user.otp_expiry && currentTime <= parseInt(user.otp_expiry)) {
        // Verification Successful: mark user as verified and clear OTP
        await sql(`UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expiry = NULL WHERE email = $1`, [email]);
        return res.status(200).json({ success: true, verified: true });
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
      
      // Send passcode recovery information exclusively to the designated HOST_EMAIL (falls back to SENDER_EMAIL if not set)
      const hostEmail = process.env.HOST_EMAIL || process.env.SENDER_EMAIL || "admin@ieee.org";
      console.log(`[SMTP Debug] Attempting to send recovery to: ${hostEmail}`);
      const subject = "IEEE SB Financial Portal - Passcode Recovery Request";
      // Note: Hashed passwords cannot be decrypted. The Host will be prompted that the passcode is encrypted and must be reset via security question or direct DB.
      const content = `Hello Host,\n\nA passcode recovery request was initiated for user: ${email}.\n\nNote: The user passcode is securely encrypted (hashed via SHA-256) inside the database. They must answer their security question to reset it, or you can clear it in the database.\n\nRegards,\nPortal Security System`;

      const emailResult = await sendEmailViaGmail(hostEmail, subject, content);
      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          error: `Failed to dispatch recovery request email: ${emailResult.error}. Please check your SMTP credentials (SENDER_EMAIL / SENDER_PASSWORD) on Vercel.`
        });
      }

      return res.status(200).json({ success: true, message: "Passcode recovery request dispatched to Host." });

    } else if (action === 'saveUserAccount') {
      const email = params.email ? params.email.trim().toLowerCase() : '';
      const passcode = params.passcode;
      const question = params.security_question;
      const answer = params.security_answer;

      if (!email || !passcode || !question || !answer) {
        return res.status(400).json({ success: false, error: "Missing required parameters (email, passcode, security_question, security_answer)" });
      }

      // Check if user exists
      const countRes = await sql(`SELECT COUNT(*) FROM users WHERE email = $1`, [email]);
      const count = parseInt(countRes[0].count);
      const encryptedPasscode = hashPasscode(passcode);

      if (count === 0) {
        await sql(`
          INSERT INTO users (email, passcode, security_question, security_answer, is_verified)
          VALUES ($1, $2, $3, $4, TRUE)
        `, [email, encryptedPasscode, question, answer]);
      } else {
        await sql(`
          UPDATE users 
          SET passcode = $1, security_question = $2, security_answer = $3, is_verified = TRUE
          WHERE email = $4
        `, [encryptedPasscode, question, answer, email]);
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

    } else if (action === 'getYearlySpreadsheets') {
      const spreadsheets = await sql(`SELECT * FROM yearly_spreadsheets ORDER BY year DESC`);
      return res.status(200).json({ success: true, spreadsheets: spreadsheets });

    } else if (action === 'saveYearlySpreadsheet') {
      const year = params.year ? params.year.toString().trim() : '';
      const module_type = params.module_type ? params.module_type.toString().trim() : 'expenses';
      const spreadsheet_id = params.spreadsheet_id ? params.spreadsheet_id.toString().trim() : '';
      const spreadsheet_url = params.spreadsheet_url ? params.spreadsheet_url.toString().trim() : '';

      if (!year || !spreadsheet_id) {
        return res.status(400).json({ success: false, error: "Missing year or spreadsheet_id parameters" });
      }

      const formattedDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

      await sql(`
        INSERT INTO yearly_spreadsheets (year, module_type, spreadsheet_id, spreadsheet_url, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (year, module_type) DO UPDATE
        SET spreadsheet_id = EXCLUDED.spreadsheet_id,
            spreadsheet_url = EXCLUDED.spreadsheet_url,
            created_at = EXCLUDED.created_at
      `, [year, module_type, spreadsheet_id, spreadsheet_url, formattedDate]);

      return res.status(200).json({ success: true, message: `Spreadsheet link saved for ${year} (${module_type}).` });

    } else if (action === 'deleteYearlySpreadsheet') {
      const year = params.year ? params.year.toString().trim() : '';
      const module_type = params.module_type ? params.module_type.toString().trim() : 'expenses';

      if (!year) {
        return res.status(400).json({ success: false, error: "Missing year parameter" });
      }

      await sql(`DELETE FROM yearly_spreadsheets WHERE year = $1 AND module_type = $2`, [year, module_type]);
      return res.status(200).json({ success: true, message: `Spreadsheet link removed for ${year}.` });

    } else {
      return res.status(400).json({ success: false, error: "Unknown action: " + action });
    }
  } catch (error) {
    console.error("Auth server error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
