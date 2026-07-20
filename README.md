# IEEE Event Expenses & Bookkeeping Manager

![IEEE SB Financial Portal Banner](banner.png)

A premium, modern, and high-performance financial management web application designed for IEEE Student Branches. Secures account management via an external Neon PostgreSQL database and direct Vercel Serverless API, synced in real-time with Google Sheets.

---

## 🎨 Key Features & Innovations

- **Glassmorphic Cyber-Security UI**: Modern dark mode design featuring floating ambient glows, backdrop-blur saturation filters, and interactive auth tabs (Sign In / Create Account).
- **Registration 2FA Authorization**: When a user registers, an account is created in a pending state (`is_verified = FALSE`). A 6-digit security code is dispatched exclusively to the **Host Email** to authorize access.
- **Direct SMTP Mailer (Vercel Serverless)**: Utilizes Node `nodemailer` and Gmail App Passwords (`SENDER_EMAIL`, `SENDER_PASSWORD`) directly inside Vercel functions without relying on Google Apps Script quotas.
- **SHA-256 Passcode Encryption**: All user passcodes are hashed using native SHA-256 cryptography before being stored in the Neon database.
- **Direct Login Access**: Once an account is authorized by the Host, verified users log in directly with their passcode without needing secondary OTP steps.
- **Automatic 60-Day Audit Pruning**: Automatically prunes security logs (`login_logs`) older than 60 days to maintain database health and privacy.
- **Real-Time Spreadsheet Sync**: Syncs event expenses and bookkeeping budget tables in real-time with Google Sheets via Google Apps Script endpoints.

---

## 🏗️ System Architecture

```mermaid
sequenceDiagram
    participant React Client
    participant Vercel Function (/api/auth)
    participant Neon Postgres DB
    participant Gmail SMTP (Nodemailer)
    participant Apps Script (Code.gs)
    participant Google Sheets
    
    %% Sign Up Flow
    React Client->>Vercel Function (/api/auth): POST requestSignUpOtp
    Vercel Function (/api/auth)->>Neon Postgres DB: Hash Passcode (SHA-256) & Store Pending User
    Vercel Function (/api/auth)->>Gmail SMTP (Nodemailer): Send 6-Digit Code to HOST_EMAIL
    Gmail SMTP (Nodemailer)-->>React Client: Return 2FA Code Prompt
    
    %% OTP Verification
    React Client->>Vercel Function (/api/auth): GET verifySignUpOtp
    Vercel Function (/api/auth)->>Neon Postgres DB: Update is_verified = TRUE
    Neon Postgres DB-->>React Client: Registration Authorized & Direct Login
    
    %% Financial Operations
    React Client->>Apps Script (Code.gs): GET/POST Event & Bookkeeping Data
    Apps Script (Code.gs)->>Google Sheets: Read/Write Expenses & Balances
    Google Sheets-->>React Client: Return Live Dashboard Figures
```

---

## ⚙️ Environment Variables Configuration

Copy `.env.example` to `.env` for local development. Configure the following environment variables in your local environment and in your **Vercel Project Settings**:

```env
# Google Apps Script Web App URL (deployed from Code.gs)
VITE_GAS_URL=https://script.google.com/macros/s/your-deployment-id/exec

# Event Expenses & Bookkeeping Google Sheet IDs
VITE_SPREADSHEET_ID=your-spreadsheet-id-for-event-expenses
VITE_BOOKKEEPING_SS_ID=your-spreadsheet-id-for-book-keeping

# Neon PostgreSQL Connection String (Direct SQL link for Vercel API)
DATABASE_URL=postgresql://neondb_owner:password@ep-host.neon.tech/neondb?sslmode=require

# Host Email (Receives all 2FA registration authorization codes)
HOST_EMAIL=host@example.com

# Direct Gmail SMTP Transporter Parameters
SENDER_EMAIL=your-sender-gmail-account@gmail.com
SENDER_PASSWORD=your-16-char-google-app-password
```

---

## 🚀 Deployment Guide

### 1. Deploy the Neon PostgreSQL Database
1. Sign up at [Neon.tech](https://neon.tech/) and create a project.
2. Copy the PostgreSQL connection URI from your Neon project dashboard.

### 2. Deploy Google Apps Script (Code.gs)
1. Open your Google Sheet, navigate to **Extensions** ➔ **Apps Script**.
2. Paste the contents of `Code.gs` into your script editor.
3. Deploy as a **Web App** (Execute as: `Me`, Who has access: `Anyone`).
4. Copy the Web App URL (ends in `/exec`).

### 3. Deploy to Vercel
1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add all the environment variables listed above to your Vercel Project Settings.
4. Deploy the site.

---

## 🛡️ Database Schema & Audit Queries

You can view and audit users or logs inside your Neon SQL Console:

* **View All Registered Accounts:**
  ```sql
  SELECT email, is_verified, security_question FROM users;
  ```

* **View Login & Logout Audit Logs:**
  ```sql
  SELECT * FROM login_logs ORDER BY id DESC;
  ```
