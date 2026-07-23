/**
 * IEEE Event Expenses - Google Apps Script Backend (Single Table Version)
 * Serves as a REST API for the Vercel-hosted React application.
 */



// Allow cross-origin requests
function doGet(e) {
  var action = e.parameter.action;
  var spreadsheetId = e.parameter.spreadsheetId;
  
  var response = {};
  
  try {
    var ss = null;
    if (action === 'getEvents' || action === 'getEventData' || action === 'getBookKeepingEvents' || action === 'getBookKeepingData') {
      ss = getSpreadsheet(spreadsheetId);
      if (!ss) {
        throw new Error("Spreadsheet not found. Please provide a valid spreadsheetId.");
      }
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
    } else {
      // Default: show welcome message and diagnostic details
      var testDrive = "Unknown";
      try {
        var root = DriveApp.getRootFolder();
        testDrive = "OK (Root: " + root.getName() + ")";
      } catch (err) {
        testDrive = "Failed: " + err.message;
      }
      
      var effectiveUser = "Unknown";
      try {
        effectiveUser = Session.getEffectiveUser().getEmail();
      } catch (err) {
        effectiveUser = "Error: " + err.message;
      }

      var testSpreadsheet = "Not Checked";
      if (spreadsheetId) {
        try {
          var tempSs = SpreadsheetApp.openById(spreadsheetId);
          testSpreadsheet = tempSs ? "OK (" + tempSs.getName() + ")" : "Failed to open";
        } catch (err) {
          testSpreadsheet = "Failed: " + err.message;
        }
      }

      response = { 
        success: true, 
        message: "IEEE Event Expenses & Book Keeping API is running.",
        spreadsheetStatus: testSpreadsheet,
        effectiveUser: effectiveUser,
        drivePermission: testDrive
      };
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
    } else if (action === 'linkBillImage') {
      var eventName = data.eventName;
      var category = data.category || 'General';
      var fileName = data.fileName || 'Linked Bill';
      var embedUrl = data.embedUrl;
      var fileUrl = data.fileUrl;

      if (!eventName || !embedUrl || !fileUrl) {
        throw new Error("Missing eventName, embedUrl, or fileUrl");
      }

      var sheet = ss.getSheetByName(eventName);
      if (sheet) {
        var lastCol = sheet.getLastColumn();
        var targetCol = 6;
        if (lastCol >= 6) {
          var row5Vals = sheet.getRange(5, 6, 1, lastCol - 5).getValues()[0];
          for (var c = 0; c < row5Vals.length; c++) {
            if (!row5Vals[c]) {
              targetCol = 6 + c;
              break;
            }
          }
          if (targetCol === 6 && row5Vals[0]) {
            targetCol = lastCol + 1;
          }
        }
        
        sheet.getRange(5, targetCol).setValue(category).setFontWeight("bold");
        sheet.getRange(6, targetCol).setValue(fileName).setFontStyle("italic");
        sheet.getRange(7, targetCol).setFormula('=IMAGE("' + embedUrl + '")');
        sheet.getRange(8, targetCol).setValue(fileUrl);
      }

      response = { success: true, message: "Bill link added successfully to sheet." };
    } else if (action === 'uploadBillImage') {
      var eventName = data.eventName;
      var fileName = data.fileName;
      var fileData = data.fileData; // base64 string
      var mimeType = data.mimeType || 'image/png';
      var category = data.category || 'General';
      var year = data.year || 'General';

      if (!eventName || !fileName || !fileData) {
        throw new Error("Missing eventName, fileName, or fileData for image upload");
      }

      // Decode base64
      var bytes = Utilities.base64Decode(fileData);
      var blob = Utilities.newBlob(bytes, mimeType, fileName);

      // Find or create "IEEE Portal Bill Uploads" folder in Drive
      var rootFolderName = "IEEE Portal Bill Uploads";
      var rootFolders = DriveApp.getFoldersByName(rootFolderName);
      var rootFolder;
      if (rootFolders.hasNext()) {
        rootFolder = rootFolders.next();
      } else {
        rootFolder = DriveApp.createFolder(rootFolderName);
      }

      // Find or create Year subfolder
      var yearFolder = getOrCreateSubFolder(rootFolder, year);

      // Find or create Event subfolder inside Year folder
      var subFolder = getOrCreateSubFolder(yearFolder, eventName);

      // Save file
      var file = subFolder.createFile(blob);
      // Share so anyone with link can view (needed for web portal to display it)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileUrl = file.getUrl();
      // Embeddable link generator for Google Sheets IMAGE() formula
      var fileId = file.getId();
      var embedUrl = "https://docs.google.com/uc?export=view&id=" + fileId;

      // Write to Google Sheet (row 5 is category, row 6 is filename, row 7 is image formula, row 8 is link)
      var sheet = ss.getSheetByName(eventName);
      if (sheet) {
        var lastCol = sheet.getLastColumn();
        var targetCol = 6; // Column F
        if (lastCol >= 6) {
          // Find next empty column starting from column F (6)
          var row5Vals = sheet.getRange(5, 6, 1, lastCol - 5).getValues()[0];
          for (var c = 0; c < row5Vals.length; c++) {
            if (!row5Vals[c]) {
              targetCol = 6 + c;
              break;
            }
          }
          if (targetCol === 6 && row5Vals[0]) {
            targetCol = lastCol + 1;
          }
        }
        
        sheet.getRange(5, targetCol).setValue(category).setFontWeight("bold");
        sheet.getRange(6, targetCol).setValue(fileName).setFontStyle("italic");
        sheet.getRange(7, targetCol).setFormula('=IMAGE("' + embedUrl + '")');
        sheet.getRange(8, targetCol).setValue(fileUrl);
      }

      response = { 
        success: true, 
        fileId: fileId,
        fileUrl: fileUrl, 
        embedUrl: embedUrl,
        message: "Bill image uploaded successfully to Google Drive & synced to sheet." 
      };
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

// Run this function once manually in the Apps Script editor to authorize Google Drive & Spreadsheets permissions
function authorizePortal() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log("Authorized Spreadsheet: " + (ss ? ss.getName() : "None"));
  } catch (err) {
    Logger.log("Spreadsheet Access Status: " + err.message);
  }
  
  try {
    // Force email scope authorization
    var email = Session.getEffectiveUser().getEmail();
    Logger.log("Authorized Email: " + email);
  } catch (err) {
    Logger.log("Email Authorization Failed: " + err.message);
  }

  try {
    // Force Drive write scope authorization by creating a temporary folder
    var testFolder = DriveApp.createFolder("IEEE Temp Test Folder");
    Logger.log("Authorized Google Drive Folder Creation.");
    
    // Clean up/trash the temp folder immediately
    testFolder.setTrashed(true);
    Logger.log("Cleaned up temporary test folder.");
  } catch (err) {
    Logger.log("Drive Authorization Failed: " + err.message);
  }
}

// Helper to find or create a subfolder inside a parent folder
function getOrCreateSubFolder(parentFolder, subFolderName) {
  var folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(subFolderName);
  }
}

