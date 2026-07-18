/**
 * IEEE Event Expenses - Google Apps Script Backend (Single Table Version)
 * Serves as a REST API for the Vercel-hosted React application.
 */

// SQL Database Connection Parameters
var DB_URL = "jdbc:mysql://YOUR_DB_HOST:3306/YOUR_DB_NAME";
var DB_USER = "YOUR_DB_USER";
var DB_PASSWORD = "YOUR_DB_PASSWORD";

// Master Host Email (Receives all secure login verification codes)
var HOST_EMAIL = "admin@ieee.org";

/**
 * Gets a direct connection to the SQL Database using Google Apps Script JDBC service.
 */
function getDbConnection() {
  if (DB_URL.indexOf("YOUR_DB_HOST") !== -1) {
    throw new Error("SQL Database connection parameters not configured. Please edit DB_URL, DB_USER, and DB_PASSWORD variables at the top of Code.gs.");
  }
  return Jdbc.getConnection(DB_URL, DB_USER, DB_PASSWORD);
}

// Allow cross-origin requests
function doGet(e) {
  var action = e.parameter.action;
  var spreadsheetId = e.parameter.spreadsheetId;
  
  var response = {};
  
  try {
    var ss = getSpreadsheet(spreadsheetId);
    if (!ss) {
      throw new Error("Spreadsheet not found. Please provide a valid spreadsheetId or run this as a container-bound script.");
    }
    
    if (action === 'getEvents') {
      response = { success: true, events: getEventSheetsList(ss) };
    } else if (action === 'getEventData') {
      var eventName = e.parameter.event;
      if (!eventName) {
        throw new Error("Missing 'event' parameter");
      }
      response = { success: true, data: getSheetData(ss, eventName) };
    } else if (action === 'getBookKeepingEvents') {
      response = { success: true, events: getBookKeepingSheetsList(ss) };
    } else if (action === 'getBookKeepingData') {
      var yearName = e.parameter.year;
      if (!yearName) {
        throw new Error("Missing 'year' parameter");
      }
      response = { success: true, data: getBookKeepingSheetData(ss, yearName) };
    } else if (action === 'getSystemSettings') {
      response = { 
        success: true, 
        settings: {
          recovery_email: "admin@ieee.org",
          security_question: "What is the default recovery code?"
        } 
      };
    } else if (action === 'verifyUserLogin') {
      var email = e.parameter.email;
      var passcode = e.parameter.passcode;
      if (!email || !passcode) {
        throw new Error("Missing email or passcode parameter");
      }
      
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT passcode, security_question, security_answer FROM users WHERE email = ?");
      checkStmt.setString(1, email.toString().trim());
      var checkRes = checkStmt.executeQuery();
      
      if (!checkRes.next()) {
        response = { success: true, verified: false, error: "User not found" };
      } else {
        var storedPasscode = checkRes.getString("passcode");
        if (storedPasscode === passcode) {
          // Generate a secure 6-digit verification code
          var otp = Math.floor(100000 + Math.random() * 900000).toString();
          var expiry = (new Date().getTime() + 10 * 60 * 1000).toString(); // Valid for 10 minutes
          
          // Save OTP details inside the user's database record
          var updateStmt = conn.prepareStatement("UPDATE users SET otp_code = ?, otp_expiry = ? WHERE email = ?");
          updateStmt.setString(1, otp);
          updateStmt.setString(2, expiry);
          updateStmt.setString(3, email.toString().trim());
          updateStmt.executeUpdate();
          updateStmt.close();
          
          // Email the secure authorization code exclusively to the designated HOST_EMAIL inbox
          try {
            MailApp.sendEmail(
              HOST_EMAIL,
              "IEEE SB Financial Portal - Login Authorization Request",
              "Hello Admin/Host,\n\nA login attempt has been initiated for user: " + email + ".\n\nTo authorize this secure session, please share the following verification code with them:\n\nVerification Code: " + otp + "\n\nThis security code will expire in 10 minutes.\n\nRegards,\nPortal Security System"
            );
          } catch(mailErr) {
            Logger.log("Failed to send authorization email: " + mailErr.message);
          }
          
          response = { 
            success: true, 
            otpRequired: true,
            email: email
          };
        } else {
          response = { success: true, verified: false, error: "Incorrect passcode" };
        }
      }
      checkRes.close();
      checkStmt.close();
      conn.close();
      
    } else if (action === 'verifyUserOtp') {
      var email = e.parameter.email;
      var otp = e.parameter.otp;
      if (!email || !otp) {
        throw new Error("Missing email or verification code parameter");
      }
      
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT otp_code, otp_expiry, security_question, security_answer FROM users WHERE email = ?");
      checkStmt.setString(1, email.toString().trim());
      var checkRes = checkStmt.executeQuery();
      
      if (!checkRes.next()) {
        response = { success: true, verified: false, error: "User not found" };
      } else {
        var storedOtp = checkRes.getString("otp_code");
        var storedExpiry = checkRes.getString("otp_expiry");
        var currentTime = new Date().getTime();
        
        if (storedOtp === otp && storedExpiry && currentTime <= parseInt(storedExpiry)) {
          // Valid verification: Clear OTP fields to prevent replay
          var updateStmt = conn.prepareStatement("UPDATE users SET otp_code = NULL, otp_expiry = NULL WHERE email = ?");
          updateStmt.setString(1, email.toString().trim());
          updateStmt.executeUpdate();
          updateStmt.close();
          
          logUserSessionSql(email, "Login");
          
          var question = checkRes.getString("security_question");
          var answer = checkRes.getString("security_answer");
          
          response = { 
            success: true, 
            verified: true,
            user: {
              email: email,
              security_question: question,
              security_answer: answer
            }
          };
        } else {
          response = { success: true, verified: false, error: "Invalid or expired verification code." };
        }
      }
      checkRes.close();
      checkStmt.close();
      conn.close();
      
    } else if (action === 'getUserQuestion') {
      var email = e.parameter.email;
      if (!email) throw new Error("Missing email parameter");
      
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT security_question FROM users WHERE email = ?");
      checkStmt.setString(1, email.toString().trim());
      var checkRes = checkStmt.executeQuery();
      
      if (!checkRes.next()) {
        throw new Error("User not found");
      }
      
      var question = checkRes.getString("security_question");
      response = { success: true, security_question: question };
      checkRes.close();
      checkStmt.close();
      conn.close();
      
    } else if (action === 'verifyUserAnswer') {
      var email = e.parameter.email;
      var answer = e.parameter.answer;
      if (!email || !answer) throw new Error("Missing email or answer parameter");
      
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT security_answer FROM users WHERE email = ?");
      checkStmt.setString(1, email.toString().trim());
      var checkRes = checkStmt.executeQuery();
      
      if (!checkRes.next()) throw new Error("User not found");
      
      var storedAnswer = checkRes.getString("security_answer").toString().trim().toLowerCase();
      var isVerified = answer.toString().trim().toLowerCase() === storedAnswer;
      response = { success: true, verified: isVerified };
      checkRes.close();
      checkStmt.close();
      conn.close();
      
    } else if (action === 'forgotUserPassword') {
      var email = e.parameter.email;
      if (!email) throw new Error("Missing email parameter");
      
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT passcode FROM users WHERE email = ?");
      checkStmt.setString(1, email.toString().trim());
      var checkRes = checkStmt.executeQuery();
      
      if (!checkRes.next()) throw new Error("User not found");
      
      var storedPasscode = checkRes.getString("passcode");
      MailApp.sendEmail(
        email, 
        "IEEE SB Financial Portal - Passcode Recovery", 
        "Hello,\n\nYour access passcode for IEEE SB Financial Portal is: " + storedPasscode + "\n\nRegards,\nSystem Administrator"
      );
      response = { success: true, message: "Passcode has been emailed to you." };
      checkRes.close();
      checkStmt.close();
      conn.close();
      
    } else if (action === 'getLoginLogs') {
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT email, action, timestamp FROM login_logs ORDER BY id DESC LIMIT 50");
      var checkRes = checkStmt.executeQuery();
      var logsList = [];
      while (checkRes.next()) {
        logsList.push({
          email: checkRes.getString("email"),
          action: checkRes.getString("action"),
          timestamp: checkRes.getString("timestamp")
        });
      }
      response = { success: true, logs: logsList };
      checkRes.close();
      checkStmt.close();
      conn.close();
      
    } else if (action === 'getUsersList') {
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT email FROM users ORDER BY email ASC");
      var checkRes = checkStmt.executeQuery();
      var usersList = [];
      while (checkRes.next()) {
        usersList.push(checkRes.getString("email"));
      }
      response = { success: true, users: usersList };
      checkRes.close();
      checkStmt.close();
      conn.close();
    } else {
      // Default: show welcome message
      response = { 
        success: true, 
        message: "IEEE Event Expenses & Book Keeping API is running.",
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl()
      };
    }
  } catch (error) {
    response = { success: false, error: error.message };
  }
  
  return jsonResponse(response);
}

function doPost(e) {
  var response = {};
  
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("No payload found in the request.");
    }
    
    var data = JSON.parse(e.postData.contents);
    var spreadsheetId = data.spreadsheetId;
    var ss = getSpreadsheet(spreadsheetId);
    
    if (!ss) {
      throw new Error("Spreadsheet not found.");
    }
    
    var action = data.action;
    
    if (action === 'createEvent') {
      var eventName = data.eventName;
      if (!eventName) throw new Error("Missing 'eventName'");
      createEventSheet(ss, eventName);
      response = { success: true, message: "Event '" + eventName + "' created successfully.", events: getEventSheetsList(ss) };
      
    } else if (action === 'saveEventData') {
      var eventName = data.eventName;
      var expenses = data.expenses || [];
      
      if (!eventName) throw new Error("Missing 'eventName'");
      
      saveSheetData(ss, eventName, expenses);
      response = { success: true, message: "Data for '" + eventName + "' saved successfully." };
      
    } else if (action === 'deleteEvent') {
      var eventName = data.eventName;
      if (!eventName) throw new Error("Missing 'eventName'");
      
      deleteEventSheet(ss, eventName);
      response = { success: true, message: "Event '" + eventName + "' deleted successfully.", events: getEventSheetsList(ss) };
      
    } else if (action === 'createBookKeepingYear') {
      var yearName = data.yearName;
      if (!yearName) throw new Error("Missing 'yearName'");
      createBookKeepingSheet(ss, yearName);
      response = { success: true, message: "Year '" + yearName + "' created successfully.", events: getBookKeepingSheetsList(ss) };
      
    } else if (action === 'saveBookKeepingData') {
      var yearName = data.yearName;
      var withdraws = data.withdraws || [];
      var incomes = data.incomes || [];
      var initialBalances = data.initialBalances || [];
      
      if (!yearName) throw new Error("Missing 'yearName'");
      
      saveBookKeepingSheetData(ss, yearName, {
        withdraws: withdraws,
        incomes: incomes,
        initialBalances: initialBalances
      });
      response = { success: true, message: "Book keeping data for '" + yearName + "' saved successfully." };
      
    } else if (action === 'deleteBookKeepingYear') {
      var yearName = data.yearName;
      if (!yearName) throw new Error("Missing 'yearName'");
      
      deleteEventSheet(ss, yearName);
      response = { success: true, message: "Year '" + yearName + "' deleted successfully.", events: getBookKeepingSheetsList(ss) };
      
    } else if (action === 'saveUserAccount') {
      var email = data.email;
      var passcode = data.passcode;
      var question = data.security_question;
      var answer = data.security_answer;
      
      if (!email || !passcode) throw new Error("Missing email or passcode");
      
      initSqlDatabase();
      var conn = getDbConnection();
      var checkStmt = conn.prepareStatement("SELECT COUNT(*) FROM users WHERE email = ?");
      checkStmt.setString(1, email.toString().trim());
      var checkRes = checkStmt.executeQuery();
      var count = 0;
      if (checkRes.next()) {
        count = checkRes.getInt(1);
      }
      checkRes.close();
      checkStmt.close();
      
      if (count === 0) {
        var insertStmt = conn.prepareStatement("INSERT INTO users (email, passcode, security_question, security_answer) VALUES (?, ?, ?, ?)");
        insertStmt.setString(1, email.toString().trim());
        insertStmt.setString(2, passcode.toString().trim());
        insertStmt.setString(3, question || "What is the default recovery code?");
        insertStmt.setString(4, answer || "IEEE@2026");
        insertStmt.executeUpdate();
        insertStmt.close();
      } else {
        var updateStmt = conn.prepareStatement("UPDATE users SET passcode = ?, security_question = ?, security_answer = ? WHERE email = ?");
        updateStmt.setString(1, passcode.toString().trim());
        updateStmt.setString(2, question || "What is the default recovery code?");
        updateStmt.setString(3, answer || "IEEE@2026");
        updateStmt.setString(4, email.toString().trim());
        updateStmt.executeUpdate();
        updateStmt.close();
      }
      conn.close();
      response = { success: true, message: "User account saved successfully." };
      
    } else if (action === 'logUserLogout') {
      var email = data.email;
      if (!email) throw new Error("Missing email parameter");
      
      initSqlDatabase();
      logUserSessionSql(email, "Logout");
      response = { success: true, message: "Logout logged successfully." };
    } else {
      throw new Error("Unknown action: " + action);
    }
    
  } catch (error) {
    var runningAs = "Unknown";
    try {
      runningAs = Session.getEffectiveUser().getEmail();
    } catch (e) {
      runningAs = "No Email Permission (Multi-login or scope restriction)";
    }
    response = { 
      success: false, 
      error: error.message + " [Running as: " + runningAs + "]" 
    };
  }
  
  return jsonResponse(response);
}

/**
 * Helper to wrap response as JSON and handle CORS redirects.
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Gets active spreadsheet or opens by ID.
 */
function getSpreadsheet(spreadsheetId) {
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return null;
  }
}

/**
 * Get list of all sheet names
 */
function getEventSheetsList(ss) {
  var sheets = ss.getSheets();
  var list = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name !== 'Settings' && name !== 'Template' && name !== 'Users' && name !== 'LoginLogs') {
      list.push(name);
    }
  }
  return list;
}

/**
 * Reads event tables from the given sheet (Single Table).
 */
function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet '" + sheetName + "' not found.");
  }
  
  // Table 1 (Expenses Details) is in columns A to D
  var expensesItems = [];
  var lastRow = sheet.getLastRow();
  
  if (lastRow >= 3) {
    var rangeValues = sheet.getRange(3, 1, Math.max(1, lastRow - 2), 4).getValues();
    for (var i = 0; i < rangeValues.length; i++) {
      var item = rangeValues[i][0];
      if (!item || item.toString().toUpperCase().indexOf("TOTAL") !== -1) {
        break; // Stop if empty or Total row
      }
      expensesItems.push({
        item: item.toString(),
        qty: Number(rangeValues[i][1]) || 0,
        price: parseAmount(rangeValues[i][2]),
        total: parseAmount(rangeValues[i][3])
      });
    }
  }
  
  // Image metadata: Columns F onwards (starts at column 6)
  var images = [];
  if (lastRow >= 5) {
    var maxCols = sheet.getLastColumn();
    if (maxCols >= 6) {
      var headers = sheet.getRange(5, 6, 1, maxCols - 5).getValues()[0];
      for (var k = 0; k < headers.length; k++) {
        var category = headers[k];
        if (category) {
          var cellFormula = sheet.getRange(7, 6 + k).getFormula();
          var cellValue = sheet.getRange(7, 6 + k).getValue();
          var imageUrl = "";
          
          if (cellFormula && cellFormula.indexOf("IMAGE") !== -1) {
            var match = cellFormula.match(/IMAGE\("([^"]+)"\)/i) || cellFormula.match(/IMAGE\('([^']+)'\)/i);
            if (match && match[1]) {
              imageUrl = match[1];
            }
          } else if (cellValue && cellValue.toString().indexOf("http") === 0) {
            imageUrl = cellValue.toString();
          }
          
          if (imageUrl) {
            images.push({
              category: category.toString(),
              imageUrl: imageUrl
            });
          }
        }
      }
    }
  }
  
  return {
    expenses: expensesItems,
    images: images
  };
}

/**
 * Creates a new event tab, setting up standard tables.
 */
function createEventSheet(ss, sheetName) {
  var existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    throw new Error("An event with the name '" + sheetName + "' already exists.");
  }
  
  var sheet = ss.insertSheet(sheetName);
  
  // Set up layout and headers
  sheet.getRange("A1").setValue("Event Expenses Details: " + sheetName);
  sheet.getRange("A1:D1").merge().setFontSize(14).setFontWeight("bold").setFontColor("#ffffff").setBackgroundColor("#00629B");
  
  // Expenses Details Headers
  sheet.getRange("A2").setValue("ITEMS");
  sheet.getRange("B2").setValue("QUANTITY");
  sheet.getRange("C2").setValue("UNIT PRICE");
  sheet.getRange("D2").setValue("TOTAL PRICE");
  sheet.getRange("A2:D2").setFontWeight("bold").setBackgroundColor("#f3f4f6").setBorder(true, true, true, true, null, null);
  
  sheet.setColumnWidth(1, 250); // Items
  sheet.setColumnWidth(2, 90);  // Qty
  sheet.setColumnWidth(3, 110); // Unit Price
  sheet.setColumnWidth(4, 150); // Total Price
  
  // Pre-fill some empty rows and Totals
  for (var r = 3; r <= 7; r++) {
    sheet.getRange(r, 4).setFormula("=B" + r + "*C" + r);
  }
  
  sheet.getRange("C8").setValue("TOTAL -").setFontWeight("bold");
  sheet.getRange("D8").setFormula("=SUM(D3:D7)").setFontWeight("bold");
  
  sheet.getRange("C3:D8").setNumberFormat('"Rs "#,##0');
  
  sheet.setHiddenGridlines(false);
}

/**
 * Saves event tables back to the sheet.
 */
function saveSheetData(ss, sheetName, expenses) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet '" + sheetName + "' not found.");
  }
  
  // Clear columns A-D from Row 3 down, without removing the images on the right
  var lastRow = Math.max(sheet.getLastRow(), 25);
  sheet.getRange(3, 1, lastRow, 4).clearContent().clearFormat();
  
  // Write Expenses
  var rowIndex = 3;
  for (var i = 0; i < expenses.length; i++) {
    var item = expenses[i];
    sheet.getRange(rowIndex, 1).setValue(item.item);
    sheet.getRange(rowIndex, 2).setValue(item.qty);
    sheet.getRange(rowIndex, 3).setValue(item.price);
    // Write total formula = qty * price
    sheet.getRange(rowIndex, 4).setFormula("=B" + rowIndex + "*C" + rowIndex);
    rowIndex++;
  }
  
  // Expected Total
  sheet.getRange(rowIndex, 3).setValue("TOTAL -").setFontWeight("bold");
  sheet.getRange(rowIndex, 4).setFormula("=SUM(D3:D" + (rowIndex - 1) + ")").setFontWeight("bold");
  sheet.getRange(3, 3, rowIndex - 2, 2).setNumberFormat('"Rs "#,##0');
  sheet.getRange(rowIndex, 4).setNumberFormat('"Rs "#,##0');
}

/**
 * Deletes an event sheet.
 */
function deleteEventSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet '" + sheetName + "' not found.");
  }
  ss.deleteSheet(sheet);
}

/**
 * Get list of all sheet names for book keeping
 */
function getBookKeepingSheetsList(ss) {
  var sheets = ss.getSheets();
  var list = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name !== 'Settings' && name !== 'Template' && name !== 'Users' && name !== 'LoginLogs') {
      list.push(name);
    }
  }
  return list;
}

function getBookKeepingSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet '" + sheetName + "' not found.");
  }
  
  var lastRow = Math.max(sheet.getLastRow(), 5);
  
  var withdraws = [];
  var incomes = [];
  var initialBalances = [];
  
  // Read Withdraw (B5:F)
  var withdrawValues = sheet.getRange(5, 2, lastRow - 4, 5).getValues();
  for (var i = 0; i < withdrawValues.length; i++) {
    var dateVal = withdrawValues[i][0];
    var amountVal = withdrawValues[i][1];
    var dateStr = dateVal ? dateVal.toString().trim() : "";
    if (dateStr === "" || dateStr === "-") continue;
    
    var fromVal = withdrawValues[i][3].toString().trim();
    var branchName = fromVal.split('(')[0].trim();
    
    var collabSplits = {};
    
    if (branchName === "Collab" && fromVal.indexOf('(') !== -1) {
      var insideParen = fromVal.split('(')[1].split(')')[0];
      if (insideParen.indexOf(':') !== -1) {
        var parts = insideParen.split(',');
        parts.forEach(function(part) {
          var subParts = part.split(':');
          if (subParts.length === 2) {
            var key = subParts[0].trim();
            var valStr = subParts[1].replace(/[^0-9]/g, '');
            var val = Number(valStr) || 0;
            collabSplits[key] = val;
          }
        });
      } else {
        var deductBr = insideParen.split('-')[0].trim();
        collabSplits[deductBr] = parseAmount(amountVal);
      }
    }
    
    // For backwards compatibility mapping:
    var collabBranchAmount = collabSplits['Branch'] || 0;
    var collabApAmount = collabSplits['AP'] || 0;
    var collabMttsAmount = collabSplits['MTT-S'] || 0;
    
    withdraws.push({
      date: formatDate(dateVal),
      amount: parseAmount(amountVal),
      raised: withdrawValues[i][2].toString().trim(),
      branch: branchName,
      collabBranchAmount: collabBranchAmount,
      collabApAmount: collabApAmount,
      collabMttsAmount: collabMttsAmount,
      collabSplits: collabSplits,
      description: withdrawValues[i][4].toString().trim()
    });
  }
  
  // Detect old vs new format by checking Row 4 headers for Remain table
  var remainHeaders = sheet.getRange(4, 8, 1, 15).getValues()[0];
  var jHeader = remainHeaders[2] ? remainHeaders[2].toString().trim() : "";
  var isNewFormat = (jHeader === "Branch" || jHeader === "Particulars" || remainHeaders[1] === "Particulars");
  
  var activeBranches = [];
  var totalColIndex = 10; // Default position of Total in new format
  var incomeStartCol = 12; // Old format starts at Column L
  
  if (isNewFormat) {
    // Read active branches: columns from Col 10 (J) until we hit "Total" or empty
    for (var k = 2; k < remainHeaders.length; k++) {
      var h = remainHeaders[k] ? remainHeaders[k].toString().trim() : "";
      if (h === "Total" || h === "") {
        totalColIndex = 8 + k;
        break;
      }
      activeBranches.push(h);
    }
    incomeStartCol = totalColIndex + 2; // Spacer after Total, then Date of Income
  } else {
    activeBranches = ["Branch", "MTT-S", "AP"];
  }
  
  // Read Income
  var incomeValues = sheet.getRange(5, incomeStartCol, lastRow - 4, 4).getValues();
  for (var i = 0; i < incomeValues.length; i++) {
    var dateVal = incomeValues[i][0];
    var amountVal = incomeValues[i][1];
    var dateStr = dateVal ? dateVal.toString().trim() : "";
    if (dateStr === "" || dateStr === "-") continue;
    
    var brVal = incomeValues[i][2].toString().trim();
    var branchName = brVal.split('(')[0].trim();
    var collabSplits = {};
    
    if (branchName === "Collab" && brVal.indexOf('(') !== -1) {
      var insideParen = brVal.split('(')[1].split(')')[0];
      if (insideParen.indexOf(':') !== -1) {
        var parts = insideParen.split(',');
        parts.forEach(function(part) {
          var subParts = part.split(':');
          if (subParts.length === 2) {
            var key = subParts[0].trim();
            var valStr = subParts[1].replace(/[^0-9]/g, '');
            var val = Number(valStr) || 0;
            collabSplits[key] = val;
          }
        });
      } else {
        var deductBr = insideParen.split('-')[0].trim();
        collabSplits[deductBr] = parseAmount(amountVal);
      }
    }
    
    var collabBranchAmount = collabSplits['Branch'] || 0;
    var collabApAmount = collabSplits['AP'] || 0;
    var collabMttsAmount = collabSplits['MTT-S'] || 0;
    
    incomes.push({
      date: formatDate(dateVal),
      amount: parseAmount(amountVal),
      branch: branchName,
      collabBranchAmount: collabBranchAmount,
      collabApAmount: collabApAmount,
      collabMttsAmount: collabMttsAmount,
      collabSplits: collabSplits,
      source: incomeValues[i][3].toString().trim()
    });
  }
  
  // Read Initial Balances from Remain
  if (isNewFormat) {
    // Row 5 contains the first row of remains, containing initial balances
    var initialsRow = sheet.getRange(5, 8, 1, activeBranches.length + 2).getValues()[0];
    var dateVal = formatDate(initialsRow[0]);
    for (var k = 0; k < activeBranches.length; k++) {
      initialBalances.push({
        date: dateVal,
        amount: parseAmount(initialsRow[k + 2]),
        branch: activeBranches[k]
      });
    }
  } else {
    // Old format: loop through H5:J
    var remainValues = sheet.getRange(5, 8, lastRow - 4, 3).getValues();
    for (var i = 0; i < remainValues.length; i++) {
      var dateVal = remainValues[i][0];
      var amountVal = remainValues[i][1];
      var branchVal = remainValues[i][2].toString().trim();
      var dateStr = dateVal ? dateVal.toString().trim() : "";
      if (dateStr === "" || dateStr === "-") continue;
      
      if (branchVal.indexOf("(Initial)") !== -1) {
        var cleanBranch = branchVal.replace("(Initial)", "").trim();
        initialBalances.push({
          date: formatDate(dateVal),
          amount: parseAmount(amountVal),
          branch: cleanBranch
        });
      }
    }
  }
  
  // Fallback: If no initial balances exist, initialize with 0 for standard branches
  if (initialBalances.length === 0) {
    initialBalances = [
      { date: "01/04/2025", amount: 0, branch: "Branch" },
      { date: "01/04/2025", amount: 0, branch: "MTT-S" },
      { date: "01/04/2025", amount: 0, branch: "AP" }
    ];
  }
  
  return {
    withdraws: withdraws,
    incomes: incomes,
    initialBalances: initialBalances
  };
}

function formatDate(dateObj) {
  if (!dateObj) return "-";
  if (dateObj instanceof Date) {
    var day = ("0" + dateObj.getDate()).slice(-2);
    var month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
    var year = dateObj.getFullYear();
    return day + "/" + month + "/" + year;
  }
  var str = dateObj.toString().trim();
  if (str === "" || str === "-") return "-";
  
  // Keep if DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }
  
  // React's YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    var parts = str.split('-');
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }
  
  return str;
}

/**
 * Parses date string in DD/MM/YYYY or YYYY-MM-DD into a structured object
 */
function parseDateString(str) {
  if (!str) return null;
  var s = str.toString().trim();
  
  // DD/MM/YYYY
  var ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return {
      day: parseInt(ddmmyyyy[1], 10),
      month: parseInt(ddmmyyyy[2], 10),
      year: parseInt(ddmmyyyy[3], 10)
    };
  }
  
  // YYYY-MM-DD
  var yyyymmdd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    return {
      year: parseInt(yyyymmdd[1], 10),
      month: parseInt(yyyymmdd[2], 10),
      day: parseInt(yyyymmdd[3], 10)
    };
  }
  
  return null;
}

/**
 * Writes a date safely into a spreadsheet cell using a real Date object to prevent locale auto-parse errors
 */
function setCellDate(range, dateStr) {
  if (!dateStr || dateStr === "-") {
    range.setValue("-");
    return;
  }
  var parsed = parseDateString(dateStr);
  if (parsed) {
    // Noon time is used to avoid timezone conversion offset shifts
    var dateObj = new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0);
    range.setValue(dateObj);
  } else {
    range.setValue(dateStr);
  }
}

/**
 * Parses numeric values safely, stripping non-numeric letters (e.g. Rs, $) and commas
 */
function parseAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  
  var str = val.toString().trim();
  if (str === "") return 0;
  
  var cleanStr = str.replace(/[^0-9.-]/g, '');
  var num = Number(cleanStr);
  return isNaN(num) ? 0 : num;
}

function saveBookKeepingSheetData(ss, sheetName, data) {
  var withdraws = data.withdraws || [];
  var incomes = data.incomes || [];
  var initialBalances = data.initialBalances || [];
  
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet '" + sheetName + "' not found.");
  }
  
  // Compile list of unique active branches
  var activeBranchesSet = {};
  activeBranchesSet['Branch'] = true;
  activeBranchesSet['MTT-S'] = true;
  activeBranchesSet['AP'] = true;
  
  for (var i = 0; i < initialBalances.length; i++) {
    if (initialBalances[i].branch) {
      activeBranchesSet[initialBalances[i].branch] = true;
    }
  }
  for (var i = 0; i < withdraws.length; i++) {
    if (withdraws[i].branch && withdraws[i].branch !== "Collab") {
      activeBranchesSet[withdraws[i].branch] = true;
    }
  }
  for (var i = 0; i < incomes.length; i++) {
    if (incomes[i].branch && incomes[i].branch !== "Collab") {
      activeBranchesSet[incomes[i].branch] = true;
    }
  }
  
  var activeBranches = Object.keys(activeBranchesSet);
  var numBranches = activeBranches.length;
  
  // H4 starts Remain section, uses:
  // Col 8: Date
  // Col 9: Particulars
  // Col 10 to 10 + numBranches - 1: Branch columns
  // Col 10 + numBranches: Total
  // Col 10 + numBranches + 1: Spacer
  // Col 10 + numBranches + 2: Income Date
  var totalColIndex = 10 + numBranches;
  var spacerColIndex = totalColIndex + 1;
  var incomeStartCol = spacerColIndex + 1;
  
  var lastRow = Math.max(sheet.getLastRow(), 200);
  
  // Clear columns B-F, H to maximum possible width from Row 4 down
  sheet.getRange(4, 2, lastRow, 5).clearContent().clearFormat(); // Withdraws: B4:F
  sheet.getRange(4, 8, lastRow, 25).clearContent().clearFormat(); // Remains and Incomes: H4 onwards
  
  // Re-write Headers
  // Section Headers (Row 2)
  sheet.getRange("B2").setValue("Withdraw").setFontSize(14).setFontWeight("bold").setFontColor("#ea580c");
  sheet.getRange(2, 8).setValue("Remain").setFontSize(14).setFontWeight("bold").setFontColor("#ea580c");
  sheet.getRange(2, incomeStartCol).setValue("Income").setFontSize(14).setFontWeight("bold").setFontColor("#ea580c");
  
  // Row 4 headers
  // Withdraw
  sheet.getRange("B4").setValue("Date");
  sheet.getRange("C4").setValue("Amount");
  sheet.getRange("D4").setValue("Raised");
  sheet.getRange("E4").setValue("From ( Branch/MTT-S/Ap)");
  sheet.getRange("F4").setValue("Description");
  sheet.getRange("B4:F4").setFontWeight("bold").setBackgroundColor("#f3f4f6").setBorder(true, true, true, true, null, null);
  
  // Remain Headers
  sheet.getRange(4, 8).setValue("Date");
  sheet.getRange(4, 9).setValue("Particulars");
  for (var k = 0; k < numBranches; k++) {
    sheet.getRange(4, 10 + k).setValue(activeBranches[k]);
  }
  sheet.getRange(4, totalColIndex).setValue("Total");
  sheet.getRange(4, 8, 1, numBranches + 3).setFontWeight("bold").setBackgroundColor("#f3f4f6").setBorder(true, true, true, true, null, null);
  
  // Income Headers
  sheet.getRange(4, incomeStartCol).setValue("Date");
  sheet.getRange(4, incomeStartCol + 1).setValue("Amount");
  sheet.getRange(4, incomeStartCol + 2).setValue("Branch/MTT-S/AP");
  sheet.getRange(4, incomeStartCol + 3).setValue("Source");
  sheet.getRange(4, incomeStartCol, 1, 4).setFontWeight("bold").setBackgroundColor("#f3f4f6").setBorder(true, true, true, true, null, null);
  
  // Column Widths adjustment
  sheet.setColumnWidth(7, 30); // spacer G
  sheet.setColumnWidth(8, 100); // Date
  sheet.setColumnWidth(9, 150); // Particulars
  for (var k = 0; k < numBranches; k++) {
    sheet.setColumnWidth(10 + k, 90);
  }
  sheet.setColumnWidth(totalColIndex, 90);
  sheet.setColumnWidth(spacerColIndex, 30);
  sheet.setColumnWidth(incomeStartCol, 100);
  sheet.setColumnWidth(incomeStartCol + 1, 90);
  sheet.setColumnWidth(incomeStartCol + 2, 150);
  sheet.setColumnWidth(incomeStartCol + 3, 150);
  
  // 1. Write Withdraws (B5:F)
  for (var i = 0; i < withdraws.length; i++) {
    var row = 5 + i;
    var item = withdraws[i];
    setCellDate(sheet.getRange(row, 2), item.date);
    sheet.getRange(row, 3).setValue(Number(item.amount) || 0);
    sheet.getRange(row, 4).setValue(item.raised || "-");
    
    if (item.branch === "Collab") {
      var splitStrings = [];
      var splits = item.collabSplits || {};
      // Map backward compatible ones if splits dictionary empty
      if (Object.keys(splits).length === 0) {
        if (item.collabBranchAmount) splits['Branch'] = item.collabBranchAmount;
        if (item.collabApAmount) splits['AP'] = item.collabApAmount;
        if (item.collabMttsAmount) splits['MTT-S'] = item.collabMttsAmount;
      }
      
      activeBranches.forEach(function(br) {
        var val = Number(splits[br]) || 0;
        if (val > 0) {
          splitStrings.push(br + ": " + val);
        }
      });
      sheet.getRange(row, 5).setValue("Collab(" + splitStrings.join(", ") + ")");
    } else {
      var amountString = Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 0 });
      sheet.getRange(row, 5).setValue(item.branch + "( Rs " + amountString + " )");
    }
    sheet.getRange(row, 6).setValue(item.description || "-");
  }
  
  // 2. Write Incomes
  for (var i = 0; i < incomes.length; i++) {
    var row = 5 + i;
    var item = incomes[i];
    setCellDate(sheet.getRange(row, incomeStartCol), item.date);
    sheet.getRange(row, incomeStartCol + 1).setValue(Number(item.amount) || 0);
    
    if (item.branch === "Collab") {
      var splitStrings = [];
      var splits = item.collabSplits || {};
      activeBranches.forEach(function(br) {
        var val = Number(splits[br]) || 0;
        if (val > 0) {
          splitStrings.push(br + ": " + val);
        }
      });
      sheet.getRange(row, incomeStartCol + 2).setValue("Collab(" + splitStrings.join(", ") + ")");
    } else {
      sheet.getRange(row, incomeStartCol + 2).setValue(item.branch);
    }
    sheet.getRange(row, incomeStartCol + 3).setValue(item.source || "-");
  }
  
  // 3. Compute and Write Remains (H5 onwards)
  var balances = {};
  activeBranches.forEach(function(br) {
    balances[br] = 0;
  });
  
  // Find initial balances and starting date
  var startDate = "";
  for (var i = 0; i < initialBalances.length; i++) {
    var ib = initialBalances[i];
    balances[ib.branch] = Number(ib.amount) || 0;
    if (!startDate || parseDateForSorting(ib.date) < parseDateForSorting(startDate)) {
      startDate = ib.date;
    }
  }
  
  var remainRows = [];
  // Write initial balance row
  var initialRowBalances = {};
  activeBranches.forEach(function(br) {
    initialRowBalances[br] = balances[br];
  });
  
  var initialTotal = 0;
  activeBranches.forEach(function(br) {
    initialTotal += balances[br];
  });
  
  remainRows.push({
    date: startDate || "01/04/2025",
    particulars: "Initial Balance",
    branchBalances: initialRowBalances,
    total: initialTotal
  });
  
  // Compile transactions
  var txs = [];
  for (var i = 0; i < withdraws.length; i++) {
    txs.push({
      type: "withdraw",
      date: parseDateForSorting(withdraws[i].date),
      originalDate: withdraws[i].date,
      amount: Number(withdraws[i].amount) || 0,
      branch: withdraws[i].branch,
      description: withdraws[i].description || "Withdrawal",
      collabSplits: withdraws[i].collabSplits || {},
      collabBranchAmount: withdraws[i].collabBranchAmount,
      collabApAmount: withdraws[i].collabApAmount,
      collabMttsAmount: withdraws[i].collabMttsAmount
    });
  }
  for (var i = 0; i < incomes.length; i++) {
    txs.push({
      type: "income",
      date: parseDateForSorting(incomes[i].date),
      originalDate: incomes[i].date,
      amount: Number(incomes[i].amount) || 0,
      branch: incomes[i].branch,
      description: incomes[i].source || "Income",
      collabSplits: incomes[i].collabSplits || {},
      collabBranchAmount: incomes[i].collabBranchAmount,
      collabApAmount: incomes[i].collabApAmount,
      collabMttsAmount: incomes[i].collabMttsAmount
    });
  }
  
  // Sort by date
  txs.sort(function(a, b) {
    return a.date.localeCompare(b.date);
  });
  
  // Compute running balances
  for (var i = 0; i < txs.length; i++) {
    var tx = txs[i];
    var br = tx.branch;
    
    if (br === "Collab") {
      var splits = tx.collabSplits || {};
      if (Object.keys(splits).length === 0) {
        if (tx.collabBranchAmount) splits['Branch'] = tx.collabBranchAmount;
        if (tx.collabApAmount) splits['AP'] = tx.collabApAmount;
        if (tx.collabMttsAmount) splits['MTT-S'] = tx.collabMttsAmount;
      }
      
      var totalSplit = 0;
      activeBranches.forEach(function(b) {
        var val = Number(splits[b]) || 0;
        balances[b] += (tx.type === "income" ? val : -val);
        totalSplit += val;
      });
      // Fallback for legacy collab: deduct from AP if total split is 0
      if (totalSplit === 0) {
        balances['AP'] += (tx.type === "income" ? tx.amount : -tx.amount);
      }
    } else {
      var key = balances[br] !== undefined ? br : 'Branch';
      balances[key] += (tx.type === "income" ? tx.amount : -tx.amount);
    }
    
    var rowBalances = {};
    var rowTotal = 0;
    activeBranches.forEach(function(b) {
      rowBalances[b] = balances[b];
      rowTotal += balances[b];
    });
    
    remainRows.push({
      date: tx.originalDate,
      particulars: tx.description,
      branchBalances: rowBalances,
      total: rowTotal
    });
  }
  
  // Write RemainRows to H5 onwards
  for (var i = 0; i < remainRows.length; i++) {
    var row = 5 + i;
    var item = remainRows[i];
    setCellDate(sheet.getRange(row, 8), item.date);
    sheet.getRange(row, 9).setValue(item.particulars);
    for (var k = 0; k < numBranches; k++) {
      sheet.getRange(row, 10 + k).setValue(item.branchBalances[activeBranches[k]]);
    }
    sheet.getRange(row, totalColIndex).setValue(item.total);
  }
  
  // 4. Alignments and Number Formats
  var maxWrite = Math.max(withdraws.length, incomes.length, remainRows.length, 1);
  sheet.getRange(5, 2, maxWrite, incomeStartCol - 2 + 4).setHorizontalAlignment("center");
  sheet.getRange(5, 6, maxWrite, 1).setHorizontalAlignment("left"); // Description
  sheet.getRange(5, 9, maxWrite, 1).setHorizontalAlignment("left"); // Particulars
  sheet.getRange(5, incomeStartCol + 3, maxWrite, 1).setHorizontalAlignment("left"); // Source
  
  // Date formats
  sheet.getRange(5, 2, maxWrite, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(5, 8, maxWrite, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(5, incomeStartCol, maxWrite, 1).setNumberFormat('dd/MM/yyyy');
  
  // Amount formats
  sheet.getRange(5, 3, maxWrite, 1).setNumberFormat('"Rs "#,##0');
  sheet.getRange(5, 10, maxWrite, numBranches + 1).setNumberFormat('"Rs "#,##0'); // Branches + Total
  sheet.getRange(5, incomeStartCol + 1, maxWrite, 1).setNumberFormat('"Rs "#,##0'); // Income amount
}

// Convert DD/MM/YYYY to YYYY-MM-DD for sorting
function parseDateForSorting(dateStr) {
  if (!dateStr) return "0000-00-00";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    var parts = dateStr.split('/');
    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }
  return dateStr;
}

/**
 * Creates a brand new year sheet formatted exactly as the monthly budget book keeping sheet
 */
function createBookKeepingSheet(ss, yearName) {
  var existingSheet = ss.getSheetByName(yearName);
  if (existingSheet) {
    throw new Error("A year tab with the name '" + yearName + "' already exists.");
  }
  
  var sheet = ss.insertSheet(yearName);
  
  // Merge B1:R1 for Title Card
  sheet.getRange("B1:R1").merge().setValue("Money Draft for " + yearName + " session")
    .setFontSize(14).setFontWeight("bold").setFontColor("#ffffff")
    .setBackgroundColor("#1e3a8a").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  sheet.setRowHeight(1, 40);
  
  // Section Headers (Row 2)
  sheet.getRange("B2").setValue("Withdraw").setFontSize(14).setFontWeight("bold").setFontColor("#ea580c");
  sheet.getRange("H2").setValue("Remain").setFontSize(14).setFontWeight("bold").setFontColor("#ea580c");
  sheet.getRange("O2").setValue("Income").setFontSize(14).setFontWeight("bold").setFontColor("#ea580c");
  
  // Column Headers (Row 4)
  // Withdraw
  sheet.getRange("B4").setValue("Date");
  sheet.getRange("C4").setValue("Amount");
  sheet.getRange("D4").setValue("Raised");
  sheet.getRange("E4").setValue("From ( Branch/MTT-S/Ap)");
  sheet.getRange("F4").setValue("Description");
  sheet.getRange("B4:F4").setFontWeight("bold").setBackgroundColor("#f3f4f6").setBorder(true, true, true, true, null, null);
  
  // Remain
  sheet.getRange("H4").setValue("Date");
  sheet.getRange("I4").setValue("Particulars");
  sheet.getRange("J4").setValue("Branch");
  sheet.getRange("K4").setValue("MTT-S");
  sheet.getRange("L4").setValue("AP");
  sheet.getRange("M4").setValue("Total");
  sheet.getRange("H4:M4").setFontWeight("bold").setBackgroundColor("#f3f4f6").setBorder(true, true, true, true, null, null);
  
  // Income
  sheet.getRange("O4").setValue("Date");
  sheet.getRange("P4").setValue("Amount");
  sheet.getRange("Q4").setValue("Branch/MTT-S/AP");
  sheet.getRange("R4").setValue("Source");
  sheet.getRange("O4:R4").setFontWeight("bold").setBackgroundColor("#f3f4f6").setBorder(true, true, true, true, null, null);
  
  // Widths
  sheet.setColumnWidth(2, 100);  // B: Date
  sheet.setColumnWidth(3, 90);   // C: Amount
  sheet.setColumnWidth(4, 90);   // D: Raised
  sheet.setColumnWidth(5, 180);  // E: From
  sheet.setColumnWidth(6, 200);  // F: Description
  sheet.setColumnWidth(7, 30);   // G: Spacer
  sheet.setColumnWidth(8, 100);  // H: Remain Date
  sheet.setColumnWidth(9, 150);  // I: Particulars
  sheet.setColumnWidth(10, 90);  // J: Branch
  sheet.setColumnWidth(11, 90);  // K: MTT-S
  sheet.setColumnWidth(12, 90);  // L: AP
  sheet.setColumnWidth(13, 90);  // M: Total
  sheet.setColumnWidth(14, 30);  // N: Spacer
  sheet.setColumnWidth(15, 100); // O: Income Date
  sheet.setColumnWidth(16, 90);  // P: Amount
  sheet.setColumnWidth(17, 150); // Q: Branch/MTT-S/AP
  sheet.setColumnWidth(18, 150); // R: Source
  
  sheet.setHiddenGridlines(false);
}

/**
 * SQL Database helpers & Initialization sequence
 */

/**
 * Initializes tables in the SQL Database.
 * Runs query statements to construct 'users' and 'login_logs' if they are missing.
 * Seeds the default 'admin@ieee.org' account if the user table is empty.
 */
function initSqlDatabase() {
  var conn;
  var stmt;
  try {
    conn = getDbConnection();
    stmt = conn.createStatement();
    
    // Create users table
    stmt.execute(
      "CREATE TABLE IF NOT EXISTS users (" +
      "email VARCHAR(255) PRIMARY KEY, " +
      "passcode VARCHAR(255) NOT NULL, " +
      "security_question VARCHAR(255), " +
      "security_answer VARCHAR(255), " +
      "otp_code VARCHAR(10), " +
      "otp_expiry VARCHAR(50)" +
      ")"
    );
    
    // Migration: Add OTP columns to existing 'users' table if they don't exist
    try {
      stmt.execute("ALTER TABLE users ADD COLUMN otp_code VARCHAR(10)");
    } catch(e) {}
    try {
      stmt.execute("ALTER TABLE users ADD COLUMN otp_expiry VARCHAR(50)");
    } catch(e) {}
    
    // Create login_logs table
    stmt.execute(
      "CREATE TABLE IF NOT EXISTS login_logs (" +
      "id SERIAL PRIMARY KEY, " +
      "email VARCHAR(255) NOT NULL, " +
      "action VARCHAR(50) NOT NULL, " +
      "timestamp VARCHAR(50) NOT NULL" +
      ")"
    );
    
    // Check if user table is empty, if so, seed default admin
    var checkStmt = conn.prepareStatement("SELECT COUNT(*) FROM users");
    var checkRes = checkStmt.executeQuery();
    var count = 0;
    if (checkRes.next()) {
      count = checkRes.getInt(1);
    }
    checkRes.close();
    checkStmt.close();
    
    if (count === 0) {
      var insertStmt = conn.prepareStatement("INSERT INTO users (email, passcode, security_question, security_answer) VALUES (?, ?, ?, ?)");
      insertStmt.setString(1, "admin@ieee.org");
      insertStmt.setString(2, "IEEE@2026");
      insertStmt.setString(3, "What is the default recovery code?");
      insertStmt.setString(4, "IEEE@2026");
      insertStmt.executeUpdate();
      insertStmt.close();
    }
    
  } catch (err) {
    Logger.log("initSqlDatabase failed: " + err.message);
    throw new Error("SQL Database connection successful but schema initialization failed: " + err.message);
  } finally {
    if (stmt) try { stmt.close(); } catch(e) {}
    if (conn) try { conn.close(); } catch(e) {}
  }
}

/**
 * Appends a row containing the user's email, action (Login/Logout), and the current timestamp to the login_logs table.
 */
function logUserSessionSql(email, action) {
  var conn;
  var stmt;
  try {
    conn = getDbConnection();
    
    var timeZone = Session.getScriptTimeZone() || "GMT+5:30";
    var formattedDate = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    
    stmt = conn.prepareStatement("INSERT INTO login_logs (email, action, timestamp) VALUES (?, ?, ?)");
    stmt.setString(1, email.toString().trim());
    stmt.setString(2, action.toString().trim());
    stmt.setString(3, formattedDate);
    stmt.executeUpdate();
  } catch (err) {
    Logger.log("Failed to insert audit log in SQL: " + err.message);
  } finally {
    if (stmt) try { stmt.close(); } catch(e) {}
    if (conn) try { conn.close(); } catch(e) {}
  }
}
