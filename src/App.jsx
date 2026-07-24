import React, { useState, useEffect } from 'react';
import logoImg from './ieee_logo.png';
import {
  Plus,
  Trash2,
  Edit3,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  FileText,
  PlusCircle,
  X,
  CheckCircle,
  Hash,
  ShoppingBag,
  ArrowDownCircle,
  ArrowUpCircle,
  Briefcase,
  Lock,
  LogOut,
  Loader2,
  Mail,
  User,
  Eye,
  EyeOff,
  Link,
  Save,
  Calendar
} from 'lucide-react';

// Initial Mock Data (Expenses Module)
const MOCK_EVENTS = [];

const MOCK_EVENT_DATA = {};

// Initial Mock Data (Book Keeping Module - Three Separate Lists)
const MOCK_BK_YEARS = [];

const MOCK_BK_DATA = {};

// Custom IEEE Diamond Logo Component rendering the uploaded logo image file with preserved aspect ratio
const IeeeLogo = ({ size = 32, style = {} }) => (
  <img
    src={logoImg}
    alt="IEEE Logo"
    style={{ height: `${size}px`, width: 'auto', display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain', ...style }}
  />
);

function App() {
  // Navigation
  const [activeModule, setActiveModule] = useState('expenses'); // 'expenses' or 'bookkeeping'

  // Security, recovery and loader states
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('ieee_is_auth') === 'true';
  });
  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    return sessionStorage.getItem('ieee_user_email') || '';
  });
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Local database of users (local mode fallback)
  const [localUsers, setLocalUsers] = useState(() => {
    const saved = localStorage.getItem('ieee_local_users');
    return saved ? JSON.parse(saved) : [];
  });

  // Selected user for security recovery
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Login view states: 'login' | 'signup' | 'forgot' | 'forgot_verify' | 'reset_passcode' | 'otp_verify'
  const [loginView, setLoginView] = useState('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [expectedOtpCode, setExpectedOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [pendingSignUpData, setPendingSignUpData] = useState(null);

  // Sign up input states
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPasscode, setSignUpPasscode] = useState('');
  const [signUpConfirmPasscode, setSignUpConfirmPasscode] = useState('');
  const [signUpQuestion, setSignUpQuestion] = useState('What was the name of your first IEEE event?');
  const [signUpAnswer, setSignUpAnswer] = useState('');

  // Password visibility toggle states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);

  // Connection states
  const [gasUrl, setGasUrl] = useState(() =>
    localStorage.getItem('ieee_gas_url') || import.meta.env.VITE_GAS_URL || ''
  );
  const [spreadsheetId, setSpreadsheetId] = useState(() =>
    localStorage.getItem('ieee_ss_id') || import.meta.env.VITE_SPREADSHEET_ID || ''
  );
  const [bookkeepingSsId, setBookkeepingSsId] = useState(() =>
    localStorage.getItem('ieee_bookkeeping_ss_id') || import.meta.env.VITE_BOOKKEEPING_SS_ID || ''
  );

  // Dynamic Yearly Spreadsheet Links Management
  const [yearlySpreadsheets, setYearlySpreadsheets] = useState(() => {
    const saved = localStorage.getItem('ieee_yearly_spreadsheets');
    return saved ? JSON.parse(saved) : [];
  });
  const [expensesSeasons, setExpensesSeasons] = useState(() => {
    const saved = localStorage.getItem('ieee_expenses_seasons');
    return saved ? JSON.parse(saved) : ['2026'];
  });
  const [selectedExpensesYear, setSelectedExpensesYear] = useState('2026');
  const [linkInputYear, setLinkInputYear] = useState('2026');
  const [linkInputModule, setLinkInputModule] = useState('expenses');
  const [linkInputUrl, setLinkInputUrl] = useState('');
  const [isApiMode, setIsApiMode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Send a logout beacon online when user closes the tab/browser
  useEffect(() => {
    const handleTabClose = () => {
      if (isAuthenticated && currentUserEmail) {
        const payload = JSON.stringify({
          action: 'logUserLogout',
          email: currentUserEmail
        });
        navigator.sendBeacon('/api/auth', payload);
      }
    };
    window.addEventListener('beforeunload', handleTabClose);
    return () => window.removeEventListener('beforeunload', handleTabClose);
  }, [isAuthenticated, currentUserEmail]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const targetEmail = emailInput.trim().toLowerCase();

    // 1. Online validation via Vercel Serverless Function
    try {
      const verifyUrl = `/api/auth?action=verifyUserLogin&email=${encodeURIComponent(targetEmail)}&passcode=${encodeURIComponent(passwordInput)}`;
      const verifyRes = await fetch(verifyUrl);
      if (verifyRes.ok) {
        const verifyResult = await verifyRes.json();
        if (verifyResult.success) {
          if (verifyResult.verified) {
            setIsAuthenticated(true);
            setCurrentUserEmail(targetEmail);
            sessionStorage.setItem('ieee_is_auth', 'true');
            sessionStorage.setItem('ieee_user_email', targetEmail);
            setLoginError('');
            setLoading(false);
            fetchYearlySpreadsheets();
            return;
          } else {
            setLoginError(verifyResult.error || 'Invalid email or passcode.');
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Online verification failed, falling back to local database:", err);
    }

    // 2. Local fallback validation
    const matchedUser = localUsers.find(usr => usr.email.trim().toLowerCase() === targetEmail);
    if (matchedUser && matchedUser.passcode === passwordInput) {
      setIsAuthenticated(true);
      setCurrentUserEmail(targetEmail);
      sessionStorage.setItem('ieee_is_auth', 'true');
      sessionStorage.setItem('ieee_user_email', targetEmail);
      setLoginError('');
      fetchYearlySpreadsheets();
    } else {
      setLoginError('Invalid email or passcode.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const targetEmail = otpEmail.trim().toLowerCase();

    // 1. Online validation via Vercel Serverless Function
    try {
      const verifyUrl = `/api/auth?action=verifySignUpOtp&email=${encodeURIComponent(targetEmail)}&otp=${encodeURIComponent(otpCodeInput)}`;
      const verifyRes = await fetch(verifyUrl);
      if (verifyRes.ok) {
        const verifyResult = await verifyRes.json();
        if (verifyResult.success) {
          if (verifyResult.verified) {
            // Success! Save user settings locally
            if (pendingSignUpData) {
              const updatedUsers = localUsers.filter(usr => usr.email.toLowerCase() !== targetEmail);
              updatedUsers.push({
                email: targetEmail,
                passcode: pendingSignUpData.passcode,
                security_question: pendingSignUpData.security_question,
                security_answer: pendingSignUpData.security_answer
              });
              setLocalUsers(updatedUsers);
              localStorage.setItem('ieee_local_users', JSON.stringify(updatedUsers));
            }

            setIsAuthenticated(true);
            setCurrentUserEmail(targetEmail);
            sessionStorage.setItem('ieee_is_auth', 'true');
            sessionStorage.setItem('ieee_user_email', targetEmail);

            setLoginError('');
            setLoading(false);
            setLoginView('login');
            setPendingSignUpData(null);
            return;
          } else {
            setLoginError(verifyResult.error || 'Invalid or expired verification code.');
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Online verification failed, falling back to local database:", err);
    }

    // 2. Local fallback validation
    if (expectedOtpCode && otpCodeInput === expectedOtpCode) {
      if (pendingSignUpData) {
        const updatedUsers = localUsers.filter(usr => usr.email.toLowerCase() !== targetEmail);
        updatedUsers.push({
          email: targetEmail,
          passcode: pendingSignUpData.passcode,
          security_question: pendingSignUpData.security_question,
          security_answer: pendingSignUpData.security_answer
        });
        setLocalUsers(updatedUsers);
        localStorage.setItem('ieee_local_users', JSON.stringify(updatedUsers));
      }

      setIsAuthenticated(true);
      setCurrentUserEmail(targetEmail);
      sessionStorage.setItem('ieee_is_auth', 'true');
      sessionStorage.setItem('ieee_user_email', targetEmail);
      setLoginError('');
      setLoginView('login');
      setPendingSignUpData(null);
    } else {
      setLoginError('Invalid or expired verification code.');
    }
    setLoading(false);
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const targetEmail = signUpEmail.trim().toLowerCase();

    if (signUpPasscode !== signUpConfirmPasscode) {
      setLoginError("Passcodes do not match.");
      setLoading(false);
      return;
    }
    if (signUpPasscode.length < 4) {
      setLoginError("Passcode must be at least 4 characters long.");
      setLoading(false);
      return;
    }

    // 1. Try online authorization code request
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'requestSignUpOtp',
          email: targetEmail,
          passcode: signUpPasscode,
          security_question: signUpQuestion,
          security_answer: signUpAnswer
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.otpRequired) {
          setPendingSignUpData({
            email: targetEmail,
            passcode: signUpPasscode,
            security_question: signUpQuestion,
            security_answer: signUpAnswer
          });
          setOtpEmail(targetEmail);
          setOtpCodeInput('');
          setLoginView('otp_verify');
          setSuccessMsg("Authorization code sent to Host email!");
          setLoading(false);
          return;
        } else {
          setLoginError(result.error || "Failed to initiate registration.");
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Online signup init failed, falling back to mock mode:", err);
    }

    // 2. Local fallback mock mode
    const userExists = localUsers.some(usr => usr.email.trim().toLowerCase() === targetEmail);
    if (userExists) {
      setLoginError("An account with this email already exists.");
      setLoading(false);
      return;
    }

    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedOtpCode(mockCode);
    setPendingSignUpData({
      email: targetEmail,
      passcode: signUpPasscode,
      security_question: signUpQuestion,
      security_answer: signUpAnswer
    });
    setOtpEmail(targetEmail);
    setOtpCodeInput('');
    setLoginView('otp_verify');
    setSuccessMsg(`[Mock Mode] Authorization code sent to Host. Use code: ${mockCode}`);
    setLoading(false);
  };

  const handleLogout = async () => {
    const userEmail = currentUserEmail;

    setIsAuthenticated(false);
    setCurrentUserEmail('');
    sessionStorage.removeItem('ieee_is_auth');
    sessionStorage.removeItem('ieee_user_email');
    setEmailInput('');
    setPasswordInput('');
    setLoginView('login');

    // Reset all React state to default values to prevent data leaking
    setActiveModule('expenses');
    setSelectedExpensesYear('2026');
    setExpensesSeasons(['2026']);
    setCurrentEvent('');
    setEvents([]);
    setEventData({ expenses: [] });
    setCurrentBkYear('');
    setBkYears([]);
    setIncomes([]);
    setWithdraws([]);
    setInitialBalances([]);
    setYearlySpreadsheets([]);
    setSearchTerm('');
    setSuccessMsg('');
    setErrorMsg('');

    // Attempt to log logout online
    if (userEmail) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'logUserLogout',
            email: userEmail
          })
        });
      } catch (err) {
        console.warn("Failed to log logout online:", err);
      }
    }
  };

  const handleForgotPasscodeClick = () => {
    setLoginView('forgot');
    setLoginError('');
    setForgotEmail('');
    setSecurityAnswerInput('');
  };

  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const targetEmail = forgotEmail.trim().toLowerCase();

    // 1. Online lookup via Vercel
    try {
      const url = `/api/auth?action=getUserQuestion&email=${encodeURIComponent(targetEmail)}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setRecoveryEmail(targetEmail);
          setSecurityQuestion(result.security_question);
          setLoginView('forgot_verify');
          setLoading(false);
          return;
        } else {
          setLoginError(result.error || "User not found.");
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed online question lookup:", err);
    }

    // 2. Local fallback lookup
    const matchedUser = localUsers.find(usr => usr.email.trim().toLowerCase() === targetEmail);
    if (matchedUser) {
      setRecoveryEmail(targetEmail);
      setSecurityQuestion(matchedUser.security_question);
      setSecurityAnswer(matchedUser.security_answer);
      setLoginView('forgot_verify');
    } else {
      setLoginError("User not found in local cache database.");
    }
    setLoading(false);
  };

  const handleVerifySecurityAnswer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    // 1. Online verification via Vercel
    try {
      const url = `/api/auth?action=verifyUserAnswer&email=${encodeURIComponent(recoveryEmail)}&answer=${encodeURIComponent(securityAnswerInput)}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          if (result.verified) {
            setLoginView('reset_passcode');
            setLoginError('');
            setLoading(false);
            return;
          } else {
            setLoginError('Incorrect answer. Please try again.');
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Online answer verification failed, falling back to local:", err);
    }

    // 2. Local fallback verification
    const matchedUser = localUsers.find(usr => usr.email.trim().toLowerCase() === recoveryEmail);
    const storedAns = matchedUser ? matchedUser.security_answer : securityAnswer;

    if (securityAnswerInput.trim().toLowerCase() === storedAns.trim().toLowerCase()) {
      setLoginView('reset_passcode');
      setLoginError('');
    } else {
      setLoginError('Incorrect answer. Please try again.');
    }
    setLoading(false);
  };

  const handleEmailRecovery = async () => {
    setLoading(true);
    setLoginError('');

    // 1. Online verification via Vercel
    try {
      const url = `/api/auth?action=forgotUserPassword&email=${encodeURIComponent(recoveryEmail)}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSuccessMsg("Passcode recovery request sent to Host email!");
          setLoginView('login');
          setForgotEmail('');
        } else {
          setLoginError(result.error || "Email recovery failed.");
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      setLoginError(`Failed to connect: ${err.message}`);
    }

    // 2. Local fallback
    const matchedUser = localUsers.find(usr => usr.email.trim().toLowerCase() === recoveryEmail);
    if (matchedUser) {
      setSuccessMsg(`[Mock Mode] Passcode recovery request sent to Host. Your passcode is: ${matchedUser.passcode}`);
      setLoginView('login');
      setForgotEmail('');
    } else {
      setLoginError("Account error.");
    }
    setLoading(false);
  };

  const handleResetPasscodeSubmit = async (e) => {
    e.preventDefault();
    if (newPasscode !== confirmPasscode) {
      setLoginError('Passcodes do not match.');
      return;
    }
    if (newPasscode.length < 4) {
      setLoginError('Passcode must be at least 4 characters long.');
      return;
    }

    setLoading(true);
    setLoginError('');

    // Find matching question/answer to preserve them
    const matchedUser = localUsers.find(usr => usr.email.trim().toLowerCase() === recoveryEmail);
    const q = matchedUser ? matchedUser.security_question : securityQuestion;
    const a = matchedUser ? matchedUser.security_answer : securityAnswer;

    if (gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'saveUserAccount',
            spreadsheetId: spreadsheetId,
            email: recoveryEmail,
            passcode: newPasscode,
            security_question: q,
            security_answer: a
          })
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error("Failed to sync reset passcode online:", err);
      }
    }

    // Update local cache
    const updatedUsers = localUsers.map(usr => {
      if (usr.email.trim().toLowerCase() === recoveryEmail) {
        return { ...usr, passcode: newPasscode };
      }
      return usr;
    });
    setLocalUsers(updatedUsers);
    localStorage.setItem('ieee_local_users', JSON.stringify(updatedUsers));

    setSuccessMsg("Passcode reset successfully! Please log in.");
    setLoginView('login');
    setNewPasscode('');
    setConfirmPasscode('');
    setSecurityAnswerInput('');
    setLoading(false);
  };

  // Settings Modal Edit States
  const [settingsTab, setSettingsTab] = useState('security');
  const [modalPasscode, setModalPasscode] = useState('');
  const [modalQuestion, setModalQuestion] = useState('What is the default recovery code?');
  const [modalAnswer, setModalAnswer] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalGasUrl, setModalGasUrl] = useState('');
  const [modalSpreadsheetId, setModalSpreadsheetId] = useState('');
  const [modalBkSsId, setModalBkSsId] = useState('');

  const handleOpenSettings = () => {
    const targetEmail = currentUserEmail.trim().toLowerCase();
    const matchedUser = localUsers.find(usr => usr.email.trim().toLowerCase() === targetEmail);
    setModalEmail(currentUserEmail);
    setModalPasscode(matchedUser ? matchedUser.passcode : 'IEEE@2026');
    setModalQuestion(matchedUser ? matchedUser.security_question : 'What is the default recovery code?');
    setModalAnswer(matchedUser ? matchedUser.security_answer : 'IEEE@2026');
    setModalGasUrl(gasUrl);
    setModalSpreadsheetId(spreadsheetId);
    setModalBkSsId(bookkeepingSsId);
    setLinkInputModule('expenses');
    setSettingsTab('security');
    setShowSettings(true);
  };

  const handleSaveConnectionSettings = (e) => {
    e.preventDefault();
    setGasUrl(modalGasUrl.trim());
    setSpreadsheetId(modalSpreadsheetId.trim());
    setBookkeepingSsId(modalBkSsId.trim());
    localStorage.setItem('ieee_gas_url', modalGasUrl.trim());
    localStorage.setItem('ieee_ss_id', modalSpreadsheetId.trim());
    localStorage.setItem('ieee_bookkeeping_ss_id', modalBkSsId.trim());
    setSuccessMsg("Connection API settings updated successfully!");
  };

  const handleSaveSecuritySettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const targetEmail = currentUserEmail.trim().toLowerCase();

    if (modalPasscode.length < 4) {
      setErrorMsg("Passcode must be at least 4 characters long.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveUserAccount',
          email: currentUserEmail,
          passcode: modalPasscode,
          security_question: modalQuestion,
          security_answer: modalAnswer
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSuccessMsg("Account details updated online and locally!");
        } else {
          throw new Error(result.error);
        }
      }
    } catch (err) {
      console.error("Failed to sync account settings online:", err);
      setErrorMsg("Failed to sync settings online. Saved locally.");
    }

    const updatedUsers = localUsers.filter(usr => usr.email.trim().toLowerCase() !== targetEmail);
    updatedUsers.push({
      email: currentUserEmail,
      passcode: modalPasscode,
      security_question: modalQuestion,
      security_answer: modalAnswer
    });
    setLocalUsers(updatedUsers);
    localStorage.setItem('ieee_local_users', JSON.stringify(updatedUsers));

    setShowSettings(false);
    setLoading(false);
  };

  // Application Data (Expenses Module)
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState('');
  const [eventData, setEventData] = useState({ expenses: [] });

  // Application Data (Book Keeping Module)
  const [bkYears, setBkYears] = useState([]);
  const [currentBkYear, setCurrentBkYear] = useState('');
  const [withdraws, setWithdraws] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [initialBalances, setInitialBalances] = useState([]);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [bkSubView, setBkSubView] = useState('all'); // 'all', 'withdraw', 'income', 'remain'

  // Modals state
  const [showSettings, setShowSettings] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Book Keeping Modals state
  const [showBkModal, setShowBkModal] = useState(false);
  const [bkModalType, setBkModalType] = useState('withdraw'); // 'withdraw', 'income', 'initial'
  const [bkIsEdit, setBkIsEdit] = useState(false);
  const [bkEditIndex, setBkEditIndex] = useState(null);

  // Form values (Expenses Multi-Row Form)
  const [expenseRows, setExpenseRows] = useState([{ item: '', qty: '1', price: '' }]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  // Form values (Book Keeping Forms)
  const [bkDate, setBkDate] = useState('');
  const [bkAmount, setBkAmount] = useState('');
  const [bkBranch, setBkBranch] = useState('Branch'); // 'Branch', 'MTT-S', 'AP', 'Collab', 'Custom'
  const [bkCustomBranch, setBkCustomBranch] = useState('');
  const [bkRaised, setBkRaised] = useState('');
  const [bkDescription, setBkDescription] = useState('');
  const [bkSource, setBkSource] = useState('');
  const [bkCollabDeduct, setBkCollabDeduct] = useState('AP');
  const [bkCollabSplits, setBkCollabSplits] = useState({});

  // Initialize storage and set API mode
  useEffect(() => {
    if (gasUrl) {
      setIsApiMode(true);
    } else {
      initializeMockData();
    }
  }, []);

  // Fetch lists on module/connection state change or authentication state change
  useEffect(() => {
    if (isAuthenticated) {
      if (activeModule === 'expenses') {
        fetchEvents(selectedExpensesYear);
      } else {
        fetchBookKeepingYears();
      }
    }
  }, [isApiMode, activeModule, selectedExpensesYear, isAuthenticated]);

  // Fetch detailed tab data on active tab selection or year change
  useEffect(() => {
    if (isAuthenticated && activeModule === 'expenses') {
      if (currentEvent) {
        fetchEventData(currentEvent, selectedExpensesYear);
      } else {
        setEventData({ expenses: [] });
      }
    }
  }, [currentEvent, activeModule, selectedExpensesYear, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeModule === 'bookkeeping') {
      if (currentBkYear) {
        fetchBookKeepingData(currentBkYear);
      } else {
        setWithdraws([]);
        setIncomes([]);
        setInitialBalances([]);
      }
    }
  }, [currentBkYear, activeModule, isAuthenticated]);

  const initializeMockData = () => {
    if (!localStorage.getItem('ieee_mock_events')) {
      localStorage.setItem('ieee_mock_events', JSON.stringify(MOCK_EVENTS));
      localStorage.setItem('ieee_mock_data', JSON.stringify(MOCK_EVENT_DATA));
    }
    if (!localStorage.getItem('ieee_mock_bk_years')) {
      localStorage.setItem('ieee_mock_bk_years', JSON.stringify(MOCK_BK_YEARS));
      localStorage.setItem('ieee_mock_bk_data', JSON.stringify(MOCK_BK_DATA));
    }
  };

  // Toast banner clear timeouts
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Convert Date from DD/MM/YYYY to YYYY-MM-DD for React Input
  const parseDateToInputFormat = (dateStr) => {
    if (!dateStr) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
    }
    return dateStr;
  };

  // Extract Spreadsheet ID from full URL or return ID directly
  const extractSpreadsheetId = (input) => {
    if (!input) return '';
    const trimmed = input.trim();
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    return trimmed;
  };

  // Get current spreadsheet ID for a module and target year
  const getActiveSpreadsheetId = (moduleType, targetYear) => {
    const yearStr = (targetYear || selectedExpensesYear).toString();
    const match = yearlySpreadsheets.find(item => item.year.toString() === yearStr && item.module_type === moduleType);
    if (match && match.spreadsheet_id) {
      return match.spreadsheet_id;
    }
    if (moduleType === 'bookkeeping') {
      return bookkeepingSsId;
    }
    return null; // Return null if no sheet is assigned for the year (no default sheet fallback!)
  };

  const fetchYearlySpreadsheets = async () => {
    try {
      const response = await fetch('/api/auth?action=getYearlySpreadsheets');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.spreadsheets) {
          setYearlySpreadsheets(result.spreadsheets);
          localStorage.setItem('ieee_yearly_spreadsheets', JSON.stringify(result.spreadsheets));
        }
      }
    } catch (err) {
      console.warn("Could not fetch yearly spreadsheets online, using local cache:", err);
    }
  };

  useEffect(() => {
    fetchYearlySpreadsheets();
  }, []);

  // Sync expensesSeasons with yearlySpreadsheets database entries
  useEffect(() => {
    if (isAuthenticated && yearlySpreadsheets.length > 0) {
      const dbYears = yearlySpreadsheets
        .filter(item => item.module_type === 'expenses')
        .map(item => item.year.toString());
      
      if (dbYears.length > 0) {
        setExpensesSeasons(prev => {
          const merged = [...new Set([...prev, ...dbYears])].sort((a, b) => b - a);
          if (JSON.stringify(merged) !== JSON.stringify(prev)) {
            localStorage.setItem('ieee_expenses_seasons', JSON.stringify(merged));
            return merged;
          }
          return prev;
        });
      }
    }
  }, [yearlySpreadsheets, isAuthenticated]);

  const handleSaveYearlyLink = async (e) => {
    if (e) e.preventDefault();
    if (!linkInputUrl.trim()) {
      setErrorMsg("Please enter a Google Sheet URL or Spreadsheet ID.");
      return;
    }
    const extractedId = extractSpreadsheetId(linkInputUrl);
    if (!extractedId) {
      setErrorMsg("Invalid Google Sheet link format.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveYearlySpreadsheet',
          year: linkInputYear,
          module_type: linkInputModule,
          spreadsheet_id: extractedId,
          spreadsheet_url: linkInputUrl.trim()
        })
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMsg(`Spreadsheet link for ${linkInputYear} (${linkInputModule}) saved successfully!`);
        fetchYearlySpreadsheets();
        setLinkInputUrl('');
        if (linkInputModule === 'expenses' && linkInputYear === selectedExpensesYear) {
          fetchEvents(selectedExpensesYear);
        }
      } else {
        throw new Error(result.error || "Failed to save link.");
      }
    } catch (err) {
      console.warn("Could not save link online, saving locally:", err);
      const updated = yearlySpreadsheets.filter(item => !(item.year.toString() === linkInputYear.toString() && item.module_type === linkInputModule));
      updated.push({
        year: linkInputYear,
        module_type: linkInputModule,
        spreadsheet_id: extractedId,
        spreadsheet_url: linkInputUrl.trim(),
        created_at: new Date().toISOString()
      });
      setYearlySpreadsheets(updated);
      localStorage.setItem('ieee_yearly_spreadsheets', JSON.stringify(updated));
      setSuccessMsg(`Saved link locally for ${linkInputYear}!`);
    }
    setLoading(false);
  };

  const handleDeleteYearlyLink = async (year, moduleType) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteYearlySpreadsheet',
          year: year,
          module_type: moduleType
        })
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMsg(`Removed spreadsheet link for ${year}.`);
        fetchYearlySpreadsheets();
      }
    } catch (err) {
      const updated = yearlySpreadsheets.filter(item => !(item.year.toString() === year.toString() && item.module_type === moduleType));
      setYearlySpreadsheets(updated);
      localStorage.setItem('ieee_yearly_spreadsheets', JSON.stringify(updated));
      setSuccessMsg(`Removed local link for ${year}.`);
    }
    setLoading(false);
  };

  const handleAddExpensesSeason = () => {
    const yr = window.prompt("Enter new season year (e.g. 2029):");
    if (!yr) return;
    const trimmed = yr.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setErrorMsg("Please enter a valid 4-digit year (e.g. 2029).");
      return;
    }
    if (expensesSeasons.includes(trimmed)) {
      setErrorMsg(`Season year ${trimmed} already exists.`);
      return;
    }
    const updated = [trimmed, ...expensesSeasons].sort((a, b) => b - a);
    setExpensesSeasons(updated);
    localStorage.setItem('ieee_expenses_seasons', JSON.stringify(updated));
    setSelectedExpensesYear(trimmed);
    fetchEvents(trimmed);
    setSuccessMsg(`Added new season year ${trimmed}!`);
  };

  const handleDeleteExpensesSeason = async (targetYear) => {
    if (expensesSeasons.length <= 1) {
      setErrorMsg("You must keep at least one season year.");
      return;
    }
    if (!window.confirm(`Are you sure you want to remove season year "${targetYear}"? This will also remove any custom Google Sheet link assigned to this year.`)) return;

    handleDeleteYearlyLink(targetYear, 'expenses');

    const updated = expensesSeasons.filter(y => y !== targetYear);
    setExpensesSeasons(updated);
    localStorage.setItem('ieee_expenses_seasons', JSON.stringify(updated));

    if (selectedExpensesYear === targetYear) {
      const nextYr = updated[0];
      setSelectedExpensesYear(nextYr);
      fetchEvents(nextYr);
    }
    setSuccessMsg(`Removed season year ${targetYear}.`);
  };

  // ==========================================
  // EXPENSES BACKEND OPERATIONS
  // ==========================================

  const fetchEvents = async (targetYear = selectedExpensesYear) => {
    setLoading(true);
    setErrorMsg('');
    const activeSsId = getActiveSpreadsheetId('expenses', targetYear);
    if (!activeSsId) {
      setEvents([]);
      setCurrentEvent('');
      setLoading(false);
      return;
    }
    if (isApiMode && gasUrl) {
      try {
        const url = `${gasUrl}?action=getEvents&spreadsheetId=${activeSsId}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.success) {
          setEvents(result.events);
          if (result.events.length > 0) {
            if (!currentEvent || !result.events.includes(currentEvent)) {
              setCurrentEvent(result.events[0]);
            }
          } else {
            setCurrentEvent('');
          }
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to connect to Google Sheets. Reverted to local Mock Mode.");
        setIsApiMode(false);
        fallbackToMockExpenses();
      }
    } else {
      fallbackToMockExpenses();
    }
    setLoading(false);
  };

  const fallbackToMockExpenses = () => {
    const mockEvs = JSON.parse(localStorage.getItem('ieee_mock_events')) || MOCK_EVENTS;
    setEvents(mockEvs);
    if (mockEvs.length > 0) {
      if (!currentEvent || !mockEvs.includes(currentEvent)) {
        setCurrentEvent(mockEvs[0]);
      }
    } else {
      setCurrentEvent('');
    }
  };

  const fetchEventData = async (eventName, targetYear = selectedExpensesYear) => {
    setLoading(true);
    setErrorMsg('');
    const activeSsId = getActiveSpreadsheetId('expenses', targetYear);
    if (!activeSsId) {
      setEventData({ expenses: [], images: [] });
      setLoading(false);
      return;
    }
    if (isApiMode && gasUrl) {
      try {
        const url = `${gasUrl}?action=getEventData&event=${encodeURIComponent(eventName)}&spreadsheetId=${activeSsId}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.success) {
          setEventData({
            expenses: result.data.expenses || [],
            images: result.data.images || []
          });
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to load sheet data. Displaying offline cache.");
        setEventData(getMockEventData(eventName));
      }
    } else {
      setEventData(getMockEventData(eventName));
    }
    setLoading(false);
  };

  const getMockEventData = (eventName) => {
    const data = JSON.parse(localStorage.getItem('ieee_mock_data')) || {};
    const itemData = data[eventName] || {};
    return {
      expenses: itemData.expenses || [],
      images: itemData.images || []
    };
  };

  const saveEventDataChanges = async (updatedExpenses, showFeedback = true) => {
    setLoading(true);
    const activeSsId = getActiveSpreadsheetId('expenses', selectedExpensesYear);
    if (isApiMode && gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'saveEventData',
            spreadsheetId: activeSsId,
            eventName: currentEvent,
            expenses: updatedExpenses
          })
        });
        const result = await response.json();
        if (result.success) {
          if (showFeedback) setSuccessMsg("Google Sheet updated successfully!");
          fetchEventData(currentEvent, selectedExpensesYear);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to save changes online. Saved locally.");
        saveMockEventData(currentEvent, updatedExpenses);
        setEventData({ expenses: updatedExpenses });
      }
    } else {
      saveMockEventData(currentEvent, updatedExpenses);
      setEventData({ expenses: updatedExpenses });
      if (showFeedback) setSuccessMsg("Saved changes locally (Mock Database).");
    }
    setLoading(false);
  };

  const handleUploadBillFile = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" exceeds 10MB limit.`);
        return;
      }
    }

    const categoryInput = prompt("Enter bill category for these uploads (e.g., Food, Decor, Printing, Travel):", "General");
    if (categoryInput === null) return;
    const category = categoryInput.trim() || 'General';

    const fileUploadConfigs = [];
    for (const file of files) {
      const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const customNameInput = prompt(`Enter name/description for "${file.name}":`, defaultName);
      
      if (customNameInput === null) {
        continue;
      }
      
      const customName = customNameInput.trim() || defaultName;
      const fileExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
      const driveFileName = customName.endsWith(fileExt) ? customName : (customName + fileExt);
      
      fileUploadConfigs.push({
        fileObj: file,
        driveFileName: driveFileName
      });
    }

    if (fileUploadConfigs.length === 0) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const activeSsId = getActiveSpreadsheetId('expenses', selectedExpensesYear);
    if (!activeSsId) {
      setErrorMsg("No spreadsheet link configured for the selected season.");
      setLoading(false);
      return;
    }

    let successCount = 0;
    let failedFiles = [];

    const readFileAsBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error("Failed to read file contents."));
        reader.readAsDataURL(file);
      });
    };

    for (const config of fileUploadConfigs) {
      const file = config.fileObj;
      const driveFileName = config.driveFileName;
      
      try {
        const base64Data = await readFileAsBase64(file);
        
        if (isApiMode && gasUrl) {
          const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
              action: 'uploadBillImage',
              spreadsheetId: activeSsId,
              eventName: currentEvent,
              year: selectedExpensesYear,
              fileName: driveFileName,
              fileData: base64Data,
              mimeType: file.type,
              category: category
            })
          });

          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            throw new Error(result.error);
          }
        } else {
          const mockData = JSON.parse(localStorage.getItem('ieee_mock_data')) || {};
          if (!mockData[currentEvent]) {
            mockData[currentEvent] = { expenses: [], images: [] };
          }
          if (!mockData[currentEvent].images) {
            mockData[currentEvent].images = [];
          }
          mockData[currentEvent].images.push({
            category: category,
            imageUrl: `https://example.com/mock-bill-${driveFileName}`
          });
          localStorage.setItem('ieee_mock_data', JSON.stringify(mockData));
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to upload ${driveFileName}:`, err);
        failedFiles.push(driveFileName);
      }
    }

    if (successCount > 0) {
      setSuccessMsg(`Successfully uploaded ${successCount} bill(s) to Drive & synced to sheet!`);
      fetchEventData(currentEvent, selectedExpensesYear);
    }
    if (failedFiles.length > 0) {
      setErrorMsg(`Failed to upload: ${failedFiles.join(', ')}`);
    }

    setLoading(false);
  };

  const handleLinkBillManually = async () => {
    const urlInput = window.prompt("Enter Google Drive sharing link or direct image URL for the bill:");
    if (!urlInput || !urlInput.trim()) return;

    const trimmedUrl = urlInput.trim();

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setErrorMsg("Please enter a valid URL (starting with http:// or https://).");
      return;
    }

    const categoryInput = window.prompt("Enter bill category (e.g., Food, Decor, Printing, Travel):", "General");
    if (categoryInput === null) return;
    const category = categoryInput.trim() || 'General';

    const filenameInput = window.prompt("Enter file description/name:", "Linked Invoice");
    if (filenameInput === null) return;
    const fileName = filenameInput.trim() || 'Linked Invoice';

    setLoading(true);
    setErrorMsg('');

    try {
      const activeSsId = getActiveSpreadsheetId('expenses', selectedExpensesYear);
      if (!activeSsId) {
        throw new Error("No spreadsheet link configured for the selected season.");
      }

      let embedUrl = trimmedUrl;
      let fileUrl = trimmedUrl;
      
      const driveIdReg1 = /\/file\/d\/([^\/]+)/;
      const driveIdReg2 = /[?&]id=([^&]+)/;
      const match1 = trimmedUrl.match(driveIdReg1);
      const match2 = trimmedUrl.match(driveIdReg2);
      
      const driveFileId = (match1 && match1[1]) || (match2 && match2[1]);
      if (driveFileId) {
        embedUrl = `https://docs.google.com/uc?export=view&id=${driveFileId}`;
      }

      if (isApiMode && gasUrl) {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'linkBillImage',
            spreadsheetId: activeSsId,
            eventName: currentEvent,
            fileName: fileName,
            embedUrl: embedUrl,
            fileUrl: fileUrl,
            category: category
          })
        });

        const result = await response.json();
        if (result.success) {
          setSuccessMsg("Bill link added successfully to sheet!");
          fetchEventData(currentEvent, selectedExpensesYear);
        } else {
          throw new Error(result.error);
        }
      } else {
        const mockData = JSON.parse(localStorage.getItem('ieee_mock_data')) || {};
        if (!mockData[currentEvent]) {
          mockData[currentEvent] = { expenses: [], images: [] };
        }
        if (!mockData[currentEvent].images) {
          mockData[currentEvent].images = [];
        }
        mockData[currentEvent].images.push({
          category: category,
          imageUrl: embedUrl
        });
        localStorage.setItem('ieee_mock_data', JSON.stringify(mockData));
        setSuccessMsg("Linked bill manually in mock database!");
        fetchEventData(currentEvent, selectedExpensesYear);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to link bill: " + err.message);
    }
    setLoading(false);
  };

  const handleDeleteBill = async (fileUrl) => {
    if (!window.confirm("Are you sure you want to delete this bill? This will remove the link from the sheet and delete the file from Google Drive (if uploaded there).")) {
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const activeSsId = getActiveSpreadsheetId('expenses', selectedExpensesYear);
      if (!activeSsId) {
        throw new Error("No spreadsheet link configured for the selected season.");
      }

      if (isApiMode && gasUrl) {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'deleteBill',
            spreadsheetId: activeSsId,
            eventName: currentEvent,
            fileUrl: fileUrl
          })
        });

        const result = await response.json();
        if (result.success) {
          setSuccessMsg("Bill deleted successfully!");
          fetchEventData(currentEvent, selectedExpensesYear);
        } else {
          throw new Error(result.error);
        }
      } else {
        const mockData = JSON.parse(localStorage.getItem('ieee_mock_data')) || {};
        if (mockData[currentEvent] && mockData[currentEvent].images) {
          mockData[currentEvent].images = mockData[currentEvent].images.filter(img => img.imageUrl !== fileUrl);
          localStorage.setItem('ieee_mock_data', JSON.stringify(mockData));
        }
        setSuccessMsg("Deleted bill manually from mock database!");
        fetchEventData(currentEvent, selectedExpensesYear);
      }
    } catch (err) {
      console.error("Failed to delete bill:", err);
      setErrorMsg("Failed to delete bill: " + err.message);
    }
    setLoading(false);
  };

  const saveMockEventData = (eventName, expenses) => {
    const data = JSON.parse(localStorage.getItem('ieee_mock_data')) || {};
    const existingImages = data[eventName]?.images || [];
    data[eventName] = { expenses: expenses || [], images: existingImages };
    localStorage.setItem('ieee_mock_data', JSON.stringify(data));
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    const formattedName = newEventName.trim();

    if (isApiMode && gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'createEvent',
            spreadsheetId: getActiveSpreadsheetId('expenses', selectedExpensesYear),
            eventName: formattedName
          })
        });
        const result = await response.json();
        if (result.success) {
          setSuccessMsg(`Tab "${formattedName}" created in Spreadsheet.`);
          setEvents(result.events);
          setCurrentEvent(formattedName);
          setShowAddEvent(false);
          setNewEventName('');
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to write online tab. Created local mockup instead.");
        createLocalEvent(formattedName);
      }
    } else {
      createLocalEvent(formattedName);
    }
    setLoading(false);
  };

  const createLocalEvent = (formattedName) => {
    const mockEvs = JSON.parse(localStorage.getItem('ieee_mock_events')) || MOCK_EVENTS;
    if (mockEvs.includes(formattedName)) {
      setErrorMsg("An event with that name already exists.");
      return;
    }
    const updated = [...mockEvs, formattedName];
    localStorage.setItem('ieee_mock_events', JSON.stringify(updated));
    setEvents(updated);
    setCurrentEvent(formattedName);
    setShowAddEvent(false);
    setNewEventName('');
    setSuccessMsg(`Created local event tab "${formattedName}".`);
  };

  const handleDeleteEvent = async (eventName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete event "${eventName}"? This will delete the tab sheet inside the Google Spreadsheet.`)) {
      return;
    }

    setLoading(true);
    setErrorMsg('');

    if (isApiMode && gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'deleteEvent',
            spreadsheetId: getActiveSpreadsheetId('expenses', selectedExpensesYear),
            eventName: eventName
          })
        });
        const result = await response.json();
        if (result.success) {
          setSuccessMsg(`Deleted event "${eventName}"`);
          setEvents(result.events);
          if (currentEvent === eventName) {
            setCurrentEvent(result.events[0] || '');
          }
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to delete event online.");
        deleteLocalEvent(eventName);
      }
    } else {
      deleteLocalEvent(eventName);
    }
    setLoading(false);
  };

  const deleteLocalEvent = (eventName) => {
    const mockEvs = JSON.parse(localStorage.getItem('ieee_mock_events')) || MOCK_EVENTS;
    const updated = mockEvs.filter(ev => ev !== eventName);
    localStorage.setItem('ieee_mock_events', JSON.stringify(updated));
    const data = JSON.parse(localStorage.getItem('ieee_mock_data')) || {};
    delete data[eventName];
    localStorage.setItem('ieee_mock_data', JSON.stringify(data));
    setEvents(updated);
    if (currentEvent === eventName) {
      setCurrentEvent(updated[0] || '');
    }
    setSuccessMsg(`Deleted "${eventName}" locally.`);
  };

  // ==========================================
  // BOOK KEEPING BACKEND OPERATIONS
  // ==========================================

  const fetchBookKeepingYears = async () => {
    if (activeModule !== 'bookkeeping') return;
    setLoading(true);
    setErrorMsg('');
    if (isApiMode && gasUrl) {
      try {
        const url = `${gasUrl}?action=getBookKeepingEvents${bookkeepingSsId ? `&spreadsheetId=${bookkeepingSsId}` : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.success) {
          setBkYears(result.events);
          if (result.events.length > 0) {
            if (!currentBkYear || !result.events.includes(currentBkYear)) {
              setCurrentBkYear(result.events[0]);
            }
          } else {
            setCurrentBkYear('');
          }
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to connect to Book Keeping Sheet. Reverted to Mock Mode.");
        fallbackToMockBk();
      }
    } else {
      fallbackToMockBk();
    }
    setLoading(false);
  };

  const fallbackToMockBk = () => {
    const storedYears = JSON.parse(localStorage.getItem('ieee_mock_bk_years')) || MOCK_BK_YEARS;
    setBkYears(storedYears);
    if (storedYears.length > 0) {
      if (!currentBkYear || !storedYears.includes(currentBkYear)) {
        setCurrentBkYear(storedYears[0]);
      }
    } else {
      setCurrentBkYear('');
    }
  };

  const fetchBookKeepingData = async (yearName) => {
    setLoading(true);
    setErrorMsg('');
    if (isApiMode && gasUrl) {
      try {
        const url = `${gasUrl}?action=getBookKeepingData&year=${encodeURIComponent(yearName)}${bookkeepingSsId ? `&spreadsheetId=${bookkeepingSsId}` : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.success) {
          setWithdraws(result.data.withdraws || []);
          setIncomes(result.data.incomes || []);
          setInitialBalances(result.data.initialBalances || []);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to load Book Keeping data. Displaying offline cache.");
        loadMockBkData(yearName);
      }
    } else {
      loadMockBkData(yearName);
    }
    setLoading(false);
  };

  const loadMockBkData = (yearName) => {
    const data = JSON.parse(localStorage.getItem('ieee_mock_bk_data')) || MOCK_BK_DATA;
    const yearData = data[yearName] || { withdraws: [], incomes: [], initialBalances: [] };
    setWithdraws(yearData.withdraws || []);
    setIncomes(yearData.incomes || []);
    setInitialBalances(yearData.initialBalances || []);
  };

  const saveMockBookKeepingData = (yearName, updatedWithdraws, updatedIncomes, updatedInitials) => {
    const data = JSON.parse(localStorage.getItem('ieee_mock_bk_data')) || MOCK_BK_DATA;
    data[yearName] = {
      withdraws: updatedWithdraws,
      incomes: updatedIncomes,
      initialBalances: updatedInitials
    };
    localStorage.setItem('ieee_mock_bk_data', JSON.stringify(data));
  };

  const saveBookKeepingChanges = async (updatedWithdraws, updatedIncomes, updatedInitials, showFeedback = true) => {
    setLoading(true);
    if (isApiMode && gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'saveBookKeepingData',
            spreadsheetId: activeBkSsId,
            yearName: currentBkYear,
            withdraws: newWithdraws,
            incomes: newIncomes,
            initialBalances: newInitialBalances
          })
        });
        const result = await response.json();
        if (result.success) {
          if (showFeedback) setSuccessMsg("Book Keeping Sheet updated successfully!");
          fetchBookKeepingData(currentBkYear);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to save changes online. Saved locally.");
        saveMockBookKeepingData(currentBkYear, updatedWithdraws, updatedIncomes, updatedInitials);
        setWithdraws(updatedWithdraws);
        setIncomes(updatedIncomes);
        setInitialBalances(updatedInitials);
      }
    } else {
      saveMockBookKeepingData(currentBkYear, updatedWithdraws, updatedIncomes, updatedInitials);
      setWithdraws(updatedWithdraws);
      setIncomes(updatedIncomes);
      setInitialBalances(updatedInitials);
      if (showFeedback) setSuccessMsg("Saved changes locally (Mock Database).");
    }
    setLoading(false);
  };

  const handleCreateBkYear = async (e) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    const formattedName = newEventName.trim();

    if (isApiMode && gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'createBookKeepingYear',
            spreadsheetId: getActiveSpreadsheetId('bookkeeping', currentBkYear),
            yearName: formattedName
          })
        });
        const result = await response.json();
        if (result.success) {
          setSuccessMsg(`Tab "${formattedName}" created in Book Keeping Sheet.`);
          setBkYears(result.events);
          setCurrentBkYear(formattedName);
          setShowAddEvent(false);
          setNewEventName('');
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to write online year. Created local mockup instead.");
        createLocalBkYear(formattedName);
      }
    } else {
      createLocalBkYear(formattedName);
    }
    setLoading(false);
  };

  const createLocalBkYear = (formattedName) => {
    const mockYears = JSON.parse(localStorage.getItem('ieee_mock_bk_years')) || MOCK_BK_YEARS;
    if (mockYears.includes(formattedName)) {
      setErrorMsg("A year tab with that name already exists.");
      return;
    }
    const updated = [...mockYears, formattedName];
    localStorage.setItem('ieee_mock_bk_years', JSON.stringify(updated));
    saveMockBookKeepingData(formattedName, [], [], [
      { date: "01/04/2026", amount: 0, branch: "Branch" },
      { date: "01/04/2026", amount: 0, branch: "MTT-S" },
      { date: "01/04/2026", amount: 0, branch: "AP" }
    ]);
    setBkYears(updated);
    setCurrentBkYear(formattedName);
    setShowAddEvent(false);
    setNewEventName('');
    setSuccessMsg(`Created local year tab "${formattedName}".`);
  };

  const handleDeleteBkYear = async (yearName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete year "${yearName}"? This will delete the tab sheet inside the Google Spreadsheet.`)) {
      return;
    }

    setLoading(true);
    setErrorMsg('');

    if (isApiMode && gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'deleteBookKeepingYear',
            spreadsheetId: getActiveSpreadsheetId('bookkeeping', yearName),
            yearName: yearName
          })
        });
        const result = await response.json();
        if (result.success) {
          setSuccessMsg(`Deleted year "${yearName}"`);
          setBkYears(result.events);
          if (currentBkYear === yearName) {
            setCurrentBkYear(result.events[0] || '');
          }
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to delete year online.");
        deleteLocalBkYear(yearName);
      }
    } else {
      deleteLocalBkYear(yearName);
    }
    setLoading(false);
  };

  const deleteLocalBkYear = (yearName) => {
    const mockYears = JSON.parse(localStorage.getItem('ieee_mock_bk_years')) || MOCK_BK_YEARS;
    const updated = mockYears.filter(y => y !== yearName);
    localStorage.setItem('ieee_mock_bk_years', JSON.stringify(updated));
    const data = JSON.parse(localStorage.getItem('ieee_mock_bk_data')) || MOCK_BK_DATA;
    delete data[yearName];
    localStorage.setItem('ieee_mock_bk_data', JSON.stringify(data));
    setBkYears(updated);
    if (currentBkYear === yearName) {
      setCurrentBkYear(updated[0] || '');
    }
    setSuccessMsg(`Deleted year "${yearName}" locally.`);
  };



  // ==========================================
  // FORMS MANAGEMENT
  // ==========================================

  // Expenses CRUD Helpers
  const openExpenseModal = (itemToEdit = null, index = null) => {
    if (itemToEdit !== null && index !== null) {
      setIsEditMode(true);
      setEditIndex(index);
      setExpenseRows([{
        item: itemToEdit.item,
        qty: itemToEdit.qty.toString(),
        price: itemToEdit.price.toString()
      }]);
    } else {
      setIsEditMode(false);
      setEditIndex(null);
      setExpenseRows([{ item: '', qty: '1', price: '' }]);
    }
    setShowExpenseModal(true);
  };

  const handleAddExpenseRowField = () => {
    setExpenseRows([...expenseRows, { item: '', qty: '1', price: '' }]);
  };

  const handleRemoveExpenseRowField = (idx) => {
    if (expenseRows.length === 1) return;
    setExpenseRows(expenseRows.filter((_, i) => i !== idx));
  };

  const handleExpenseRowChange = (idx, field, val) => {
    const updated = [...expenseRows];
    updated[idx][field] = val;
    setExpenseRows(updated);
  };

  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    const validRows = expenseRows
      .filter(row => row.item.trim())
      .map(row => ({
        item: row.item.trim(),
        qty: Number(row.qty) || 1,
        price: Number(row.price) || 0,
        total: (Number(row.qty) || 1) * (Number(row.price) || 0)
      }));

    if (validRows.length === 0) return;

    let updatedList = [...eventData.expenses];
    if (isEditMode && editIndex !== null) {
      updatedList[editIndex] = validRows[0];
    } else {
      const existingNames = updatedList.map(item => item.item.toLowerCase());
      const duplicatesFiltered = validRows.filter(row => !existingNames.includes(row.item.toLowerCase()));

      if (duplicatesFiltered.length < validRows.length) {
        setErrorMsg("Skipped duplicate item names.");
      }
      updatedList = [...updatedList, ...duplicatesFiltered];
    }

    saveEventDataChanges(updatedList);
    setShowExpenseModal(false);
  };

  const handleDeleteExpense = (index) => {
    if (!window.confirm("Are you sure you want to delete this expense item?")) return;
    const updatedList = eventData.expenses.filter((_, idx) => idx !== index);
    saveEventDataChanges(updatedList);
  };

  // Book Keeping Separate CRUD Helpers
  const openBkModal = (type, itemToEdit = null, index = null) => {
    setBkModalType(type); // 'withdraw', 'income', 'initial'

    if (itemToEdit !== null && index !== null) {
      setBkIsEdit(true);
      setBkEditIndex(index);
      setBkDate(parseDateToInputFormat(itemToEdit.date));
      setBkAmount(itemToEdit.amount || '');

      const br = itemToEdit.branch || '';
      const standardBranches = ['Branch', 'MTT-S', 'AP', 'Collab'];
      if (standardBranches.includes(br)) {
        setBkBranch(br);
        setBkCustomBranch('');
      } else {
        setBkBranch('Custom');
        setBkCustomBranch(br);
      }

      setBkRaised(itemToEdit.raised || '');
      setBkDescription(itemToEdit.description || '');
      setBkSource(itemToEdit.source || '');
      setBkCollabDeduct(itemToEdit.collabDeduct || 'AP');
      const splits = itemToEdit.collabSplits || {};
      if (Object.keys(splits).length === 0) {
        if (itemToEdit.collabBranchAmount) splits['Branch'] = itemToEdit.collabBranchAmount;
        if (itemToEdit.collabApAmount) splits['AP'] = itemToEdit.collabApAmount;
        if (itemToEdit.collabMttsAmount) splits['MTT-S'] = itemToEdit.collabMttsAmount;
      }
      setBkCollabSplits(splits);
    } else {
      setBkIsEdit(false);
      setBkEditIndex(null);
      const today = new Date().toISOString().split('T')[0];
      setBkDate(today);
      setBkAmount('');
      setBkBranch('Branch');
      setBkCustomBranch('');
      setBkRaised('');
      setBkDescription('');
      setBkSource('');
      setBkCollabDeduct('AP');
      setBkCollabSplits({});
    }
    setShowBkModal(true);
  };

  const handleBkSubmit = (e) => {
    e.preventDefault();

    let finalDate = bkDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(bkDate)) {
      const parts = bkDate.split('-');
      finalDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
    }

    const branchName = bkBranch === 'Custom' ? bkCustomBranch.trim() : bkBranch;
    const isCollab = branchName === 'Collab';
    const collabSplits = {};
    if (isCollab) {
      activeBranches.forEach(br => {
        collabSplits[br] = Number(bkCollabSplits[br]) || 0;
      });
    }
    const finalAmount = isCollab
      ? activeBranches.reduce((sum, b) => sum + (collabSplits[b] || 0), 0)
      : (Number(bkAmount) || 0);

    if (bkModalType === 'withdraw') {
      let item = {
        date: finalDate,
        amount: finalAmount,
        branch: branchName,
        raised: bkRaised.trim(),
        description: bkDescription.trim(),
        collabSplits: isCollab ? collabSplits : undefined,
        collabBranchAmount: isCollab ? (collabSplits['Branch'] || 0) : undefined,
        collabApAmount: isCollab ? (collabSplits['AP'] || 0) : undefined,
        collabMttsAmount: isCollab ? (collabSplits['MTT-S'] || 0) : undefined
      };
      let list = [...withdraws];
      if (bkIsEdit && bkEditIndex !== null) list[bkEditIndex] = item;
      else list.push(item);
      saveBookKeepingChanges(list, incomes, initialBalances);
    }
    else if (bkModalType === 'income') {
      let item = {
        date: finalDate,
        amount: finalAmount,
        branch: branchName,
        source: bkSource.trim(),
        collabSplits: isCollab ? collabSplits : undefined,
        collabBranchAmount: isCollab ? (collabSplits['Branch'] || 0) : undefined,
        collabApAmount: isCollab ? (collabSplits['AP'] || 0) : undefined,
        collabMttsAmount: isCollab ? (collabSplits['MTT-S'] || 0) : undefined
      };
      let list = [...incomes];
      if (bkIsEdit && bkEditIndex !== null) list[bkEditIndex] = item;
      else list.push(item);
      saveBookKeepingChanges(withdraws, list, initialBalances);
    }
    else if (bkModalType === 'initial') {
      let item = {
        date: finalDate,
        amount: finalAmount,
        branch: branchName,
        collabSplits: isCollab ? collabSplits : undefined,
        collabBranchAmount: isCollab ? (collabSplits['Branch'] || 0) : undefined,
        collabApAmount: isCollab ? (collabSplits['AP'] || 0) : undefined,
        collabMttsAmount: isCollab ? (collabSplits['MTT-S'] || 0) : undefined
      };
      let list = [...initialBalances];
      if (bkIsEdit && bkEditIndex !== null) list[bkEditIndex] = item;
      else list.push(item);
      saveBookKeepingChanges(withdraws, incomes, list);
    }

    setShowBkModal(false);
  };

  const handleDeleteBkTransaction = (type, index) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} entry?`)) return;

    if (type === 'withdraw') {
      const list = withdraws.filter((_, idx) => idx !== index);
      saveBookKeepingChanges(list, incomes, initialBalances);
    } else if (type === 'income') {
      const list = incomes.filter((_, idx) => idx !== index);
      saveBookKeepingChanges(withdraws, list, initialBalances);
    } else if (type === 'initial') {
      const list = initialBalances.filter((_, idx) => idx !== index);
      saveBookKeepingChanges(withdraws, incomes, list);
    }
  };

  // ==========================================
  // LAYOUT CALCULATIONS
  // ==========================================

  // Expenses calculations
  const expensesTotal = eventData.expenses.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const itemsCount = eventData.expenses.length;
  const avgCost = itemsCount > 0 ? expensesTotal / eventData.expenses.reduce((sum, i) => sum + (i.qty || 1), 0) : 0;

  // Bookkeeping dynamic calculations
  const activeBranches = (() => {
    const branchesSet = new Set(['Branch', 'MTT-S', 'AP']);
    initialBalances.forEach(ib => { if (ib.branch && ib.branch !== 'Collab') branchesSet.add(ib.branch); });
    withdraws.forEach(w => { if (w.branch && w.branch !== 'Collab') branchesSet.add(w.branch); });
    incomes.forEach(inc => { if (inc.branch && inc.branch !== 'Collab') branchesSet.add(inc.branch); });
    return Array.from(branchesSet);
  })();

  const getCalculatedRemainList = () => {
    const balances = {};
    activeBranches.forEach(br => {
      balances[br] = 0;
    });

    // Find initial balances and earliest date
    let startDate = '';
    initialBalances.forEach(ib => {
      balances[ib.branch] = Number(ib.amount) || 0;
      if (!startDate || parseDateForSorting(ib.date) < parseDateForSorting(startDate)) {
        startDate = ib.date;
      }
    });

    const remainRows = [];

    // Initial balances row
    const initialRowBalances = {};
    activeBranches.forEach(br => {
      initialRowBalances[br] = balances[br];
    });
    remainRows.push({
      date: startDate || '01/04/2025',
      description: 'Initial Balance',
      isInitial: true,
      branchBalances: initialRowBalances,
      total: activeBranches.reduce((sum, br) => sum + (balances[br] || 0), 0)
    });

    // Compile and sort transactions
    const txs = [];
    withdraws.forEach((w, idx) => {
      txs.push({
        type: 'withdraw',
        date: parseDateForSorting(w.date),
        originalDate: w.date,
        amount: Number(w.amount) || 0,
        branch: w.branch,
        description: w.description || `Withdrawal (${w.raised})`,
        refIndex: idx,
        collabBranchAmount: w.collabBranchAmount,
        collabApAmount: w.collabApAmount,
        collabMttsAmount: w.collabMttsAmount,
        collabSplits: w.collabSplits || {}
      });
    });
    incomes.forEach((inc, idx) => {
      txs.push({
        type: 'income',
        date: parseDateForSorting(inc.date),
        originalDate: inc.date,
        amount: Number(inc.amount) || 0,
        branch: inc.branch,
        description: inc.source || 'Income',
        refIndex: idx,
        collabBranchAmount: inc.collabBranchAmount,
        collabApAmount: inc.collabApAmount,
        collabMttsAmount: inc.collabMttsAmount,
        collabSplits: inc.collabSplits || {}
      });
    });

    txs.sort((a, b) => a.date.localeCompare(b.date));

    txs.forEach(tx => {
      if (tx.branch === 'Collab') {
        const splits = tx.collabSplits || {};
        // Map legacy splits if empty
        if (Object.keys(splits).length === 0) {
          if (tx.collabBranchAmount) splits['Branch'] = tx.collabBranchAmount;
          if (tx.collabApAmount) splits['AP'] = tx.collabApAmount;
          if (tx.collabMttsAmount) splits['MTT-S'] = tx.collabMttsAmount;
        }

        let totalSplit = 0;
        activeBranches.forEach(br => {
          const val = Number(splits[br]) || 0;
          balances[br] = (balances[br] || 0) + (tx.type === 'income' ? val : -val);
          totalSplit += val;
        });
        // Fallback for legacy collab: deduct from AP if total split is 0
        if (totalSplit === 0) {
          balances['AP'] = (balances['AP'] || 0) + (tx.type === 'income' ? tx.amount : -tx.amount);
        }
      } else {
        const br = tx.branch;
        const key = balances[br] !== undefined ? br : 'Branch';
        balances[key] = (balances[key] || 0) + (tx.type === 'income' ? tx.amount : -tx.amount);
      }

      const rowBalances = {};
      activeBranches.forEach(br => {
        rowBalances[br] = balances[br];
      });

      remainRows.push({
        date: tx.originalDate,
        description: tx.description,
        isInitial: false,
        type: tx.type,
        refIndex: tx.refIndex,
        branchBalances: rowBalances,
        total: activeBranches.reduce((sum, br) => sum + (balances[br] || 0), 0)
      });
    });

    return { remainRows, finalBalances: balances };
  };

  const parseDateForSorting = (dateStr) => {
    if (!dateStr) return '0000-00-00';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const { remainRows, finalBalances } = getCalculatedRemainList();

  const bkIncomeTotal = incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const bkWithdrawTotal = withdraws.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const bkRemainTotal = Object.values(finalBalances).reduce((sum, val) => sum + val, 0);
  const bkNetBalance = bkIncomeTotal - bkWithdrawTotal;

  // Filters
  const filteredEvents = events.filter(e => e.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredYears = bkYears.filter(y => y.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div id="root">
      {/* Toast notifications */}
      {successMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000 }} className="alert alert-success">
          <CheckCircle size={18} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000 }} className="alert alert-danger">
          <X size={18} />
          {errorMsg}
        </div>
      )}

      {isAppLoading ? (
        <div className="startup-loader-overlay">
          <div className="startup-loader-element"></div>
          <div className="startup-loader-text">IEEE Dibrugarh University SB Portal</div>
        </div>
      ) : !isAuthenticated ? (
        <div className="login-overlay">
          {/* Glowing premium backdrop circles */}
          <div className="login-bg-blob login-blob-1"></div>
          <div className="login-bg-blob login-blob-2"></div>
          <div className="login-bg-blob login-blob-3"></div>

          <div className="login-card">
            <div className="login-logo">
              <IeeeLogo size={36} />
            </div>

            {/* Header Tabs for Login & Sign Up */}
            {(loginView === 'login' || loginView === 'signup') && (
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab-btn ${loginView === 'login' ? 'active' : ''}`}
                  onClick={() => { setLoginView('login'); setLoginError(''); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`auth-tab-btn ${loginView === 'signup' ? 'active' : ''}`}
                  onClick={() => { setLoginView('signup'); setLoginError(''); }}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Step indicators for password recovery */}
            {(loginView === 'forgot' || loginView === 'forgot_verify' || loginView === 'reset_passcode') && (
              <div className="recovery-steps-wrapper">
                <div className="recovery-steps-timeline">
                  <div className={`step-node ${loginView === 'forgot' || loginView === 'forgot_verify' || loginView === 'reset_passcode' ? 'active' : ''} ${loginView !== 'forgot' ? 'completed' : ''}`}>
                    <span className="step-num">1</span>
                    <span className="step-label">Identify</span>
                  </div>
                  <div className={`step-line ${loginView !== 'forgot' ? 'completed' : ''}`}></div>
                  <div className={`step-node ${loginView === 'forgot_verify' || loginView === 'reset_passcode' ? 'active' : ''} ${loginView === 'reset_passcode' ? 'completed' : ''}`}>
                    <span className="step-num">2</span>
                    <span className="step-label">Verify</span>
                  </div>
                  <div className={`step-line ${loginView === 'reset_passcode' ? 'completed' : ''}`}></div>
                  <div className={`step-node ${loginView === 'reset_passcode' ? 'active' : ''}`}>
                    <span className="step-num">3</span>
                    <span className="step-label">Reset</span>
                  </div>
                </div>
              </div>
            )}

            <h2 className="login-title">
              {loginView === 'login' && "IEEE Dibrugarh University Financial Portol"}
              {loginView === 'signup' && "Register Account"}
              {loginView === 'forgot' && "Find Your Account"}
              {loginView === 'forgot_verify' && "Security Question"}
              {loginView === 'reset_passcode' && "Reset Passcode"}
            </h2>

            <p className="login-subtitle">
              {loginView === 'login' && "Sign in to manage student group expenses & cash bookkeeping"}
              {loginView === 'signup' && "Configure a new portal login with local and online sync capabilities"}
              {loginView === 'forgot' && "Verify your registered email address"}
              {loginView === 'forgot_verify' && "Answer verification question to clear authentication"}
              {loginView === 'reset_passcode' && "Create a new passcode of at least 4 characters"}
            </p>

            {loginView === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="login-form">
                <div className="login-input-wrapper">
                  <User size={16} className="login-input-icon" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="login-input"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="login-input-wrapper" style={{ marginTop: '14px' }}>
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Passcode"
                    className="login-input"
                    style={{ paddingRight: '40px' }}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {loginError && (
                  <div className="login-error" style={{ marginTop: '14px' }}>
                    <X size={14} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button type="submit" className="login-btn" style={{ marginTop: '18px' }} disabled={loading}>
                  {loading ? "Unlocking Portal..." : "Unlock Portal"}
                </button>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={handleForgotPasscodeClick}
                    className="login-link"
                  >
                    Forgot passcode or recovery options?
                  </button>
                </div>
              </form>
            ) : loginView === 'signup' ? (
              <form onSubmit={handleSignUpSubmit} className="login-form">
                <div className="login-input-wrapper">
                  <User size={16} className="login-input-icon" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="login-input"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="login-input-wrapper" style={{ marginTop: '12px' }}>
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type={showSignUpPassword ? "text" : "password"}
                    placeholder="Create Passcode (min 4 chars)"
                    className="login-input"
                    style={{ paddingRight: '40px' }}
                    value={signUpPasscode}
                    onChange={(e) => setSignUpPasscode(e.target.value)}
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                  >
                    {showSignUpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="login-input-wrapper" style={{ marginTop: '12px' }}>
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type={showSignUpConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Passcode"
                    className="login-input"
                    style={{ paddingRight: '40px' }}
                    value={signUpConfirmPasscode}
                    onChange={(e) => setSignUpConfirmPasscode(e.target.value)}
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                  >
                    {showSignUpConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="login-input-wrapper" style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <select
                    className="login-input"
                    style={{ paddingLeft: '14px', border: 'none', width: '100%', outline: 'none' }}
                    value={signUpQuestion}
                    onChange={(e) => setSignUpQuestion(e.target.value)}
                    required
                  >
                    <option value="What was the name of your first IEEE event?">Question: First IEEE event name?</option>
                    <option value="What is the default recovery code?">Question: Default recovery code?</option>
                    <option value="What was your first school?">Question: What was your first school?</option>
                    <option value="What is your pet's name?">Question: What is your pet's name?</option>
                    <option value="What was your favorite project name?">Question: Favorite project name?</option>
                  </select>
                </div>

                <div className="login-input-wrapper" style={{ marginTop: '12px' }}>
                  <input
                    type="text"
                    placeholder="Your Answer"
                    className="login-input"
                    style={{ paddingLeft: '14px' }}
                    value={signUpAnswer}
                    onChange={(e) => setSignUpAnswer(e.target.value)}
                    required
                  />
                </div>

                {loginError && (
                  <div className="login-error" style={{ marginTop: '12px' }}>
                    <X size={14} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button type="submit" className="login-btn" style={{ marginTop: '16px' }} disabled={loading}>
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </form>
            ) : loginView === 'forgot' ? (
              <form onSubmit={handleForgotEmailSubmit} className="login-form">
                <div className="login-input-wrapper">
                  <User size={16} className="login-input-icon" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="login-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {loginError && (
                  <div className="login-error" style={{ marginTop: '8px' }}>
                    <X size={14} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button type="submit" className="login-btn" style={{ marginTop: '14px' }} disabled={loading}>
                  Find Security Question
                </button>

                <button
                  type="button"
                  onClick={() => { setLoginView('login'); setLoginError(''); }}
                  className="login-btn btn-outline"
                  style={{ marginTop: '6px' }}
                >
                  Cancel & Back
                </button>
              </form>
            ) : loginView === 'forgot_verify' ? (
              <div className="login-form">
                <form onSubmit={handleVerifySecurityAnswer} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
                  <div className="recovery-question-card">
                    <span className="recovery-question-title">Security Question</span>
                    <p className="recovery-question-text">{securityQuestion}</p>
                  </div>

                  <div className="login-input-wrapper">
                    <input
                      type="text"
                      placeholder="Your Secret Answer"
                      className="login-input"
                      style={{ paddingLeft: '14px' }}
                      value={securityAnswerInput}
                      onChange={(e) => setSecurityAnswerInput(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="login-btn" style={{ padding: '10px' }} disabled={loading}>
                    Verify Answer
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                    Lost your answer? Request passcode recovery via Host:
                  </p>
                  <button type="button" onClick={handleEmailRecovery} className="login-btn btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px' }} disabled={loading}>
                    <Mail size={14} />
                    Email Recovery Request to Host
                  </button>
                </div>

                {loginError && (
                  <div className="login-error" style={{ marginBottom: '12px' }}>
                    <X size={14} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setLoginView('login'); setLoginError(''); }}
                  className="login-btn btn-outline"
                >
                  Back to Sign In
                </button>
              </div>
            ) : loginView === 'otp_verify' ? (
              <form onSubmit={handleVerifyOtp} className="login-form">
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center', lineHeight: '1.4' }}>
                  A registration authorization request was initiated. A 6-digit verification code has been dispatched to the Host's email. Please obtain the code to verify your account registration.
                </p>

                <div className="login-input-wrapper">
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-Digit Code"
                    className="login-input"
                    style={{ paddingLeft: '38px', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
                    value={otpCodeInput}
                    onChange={(e) => setOtpCodeInput(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>

                {loginError && (
                  <div className="login-error" style={{ marginTop: '12px' }}>
                    <X size={14} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button type="submit" className="login-btn" style={{ marginTop: '16px' }} disabled={loading}>
                  {loading ? "Authorizing..." : "Verify & Create Account"}
                </button>

                <button
                  type="button"
                  onClick={() => { setLoginView('login'); setLoginError(''); setOtpCodeInput(''); setPendingSignUpData(null); }}
                  className="login-btn btn-outline"
                  style={{ marginTop: '6px' }}
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasscodeSubmit} className="login-form">
                <div className="login-input-wrapper">
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="New Passcode (min 4 chars)"
                    className="login-input"
                    style={{ paddingRight: '40px' }}
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    required
                    minLength={4}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="login-input-wrapper" style={{ marginTop: '12px' }}>
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm New Passcode"
                    className="login-input"
                    style={{ paddingRight: '40px' }}
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {loginError && (
                  <div className="login-error" style={{ marginTop: '8px' }}>
                    <X size={14} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button type="submit" className="login-btn" style={{ marginTop: '12px' }} disabled={loading}>
                  Reset & Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Main Header */}
          <header className="main-header" style={{ height: '70px' }}>
            <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>IEEE Financial Manager</h1>
                <span className="logo-badge" style={{ alignSelf: 'flex-start', margin: 0, padding: '1px 6px', fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', letterSpacing: '0.5px' }}>PORTAL</span>
              </div>
            </div>

            {/* Module Switcher (Pill Style) */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '4px', borderRadius: '30px' }}>
              <button
                onClick={() => { setActiveModule('expenses'); setSearchTerm(''); }}
                style={{
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '20px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: activeModule === 'expenses' ? '#ffffff' : 'transparent',
                  color: activeModule === 'expenses' ? 'var(--primary)' : '#ffffff'
                }}
              >
                Event Expenses
              </button>
              <button
                onClick={() => { setActiveModule('bookkeeping'); setSearchTerm(''); }}
                style={{
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '20px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: activeModule === 'bookkeeping' ? '#ffffff' : 'transparent',
                  color: activeModule === 'bookkeeping' ? 'var(--primary)' : '#ffffff'
                }}
              >
                Yearly Book Keeping
              </button>
            </div>

            <div className="header-actions">
              <div
                className={`status-badge ${isApiMode ? 'connected' : 'mock'}`}
                style={{ cursor: 'pointer' }}
                onClick={handleOpenSettings}
                title="Configure sheet IDs and URLs"
              >
                {isApiMode ? <Wifi size={14} /> : <WifiOff size={14} />}
                {isApiMode ? "Sheets Connected" : "Local Mock Mode"}
              </div>

              <button className="btn btn-secondary" onClick={handleOpenSettings}>
                <SettingsIcon size={16} />
                Settings
              </button>

              <button className="btn btn-ghost" onClick={handleLogout} style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }} title="Logout">
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </header>

          {/* App Content */}
          <div className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
              <div className="sidebar-title">
                {activeModule === 'expenses' ? "Events Sheets" : "Academic Sessions"}
              </div>

              {activeModule === 'expenses' && (
                <div style={{ marginBottom: '14px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> Active Season
                    </span>
                    {yearlySpreadsheets.some(i => i.year.toString() === selectedExpensesYear && i.module_type === 'expenses') ? (
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                        Linked
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        Unlinked
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={selectedExpensesYear}
                      onChange={(e) => {
                        const newYr = e.target.value;
                        setSelectedExpensesYear(newYr);
                        fetchEvents(newYr);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      {expensesSeasons.map(yr => (
                        <option key={yr} value={yr}>{yr} Season</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleAddExpensesSeason}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--primary)' }}
                      title="Add New Season Year"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleDeleteExpensesSeason(selectedExpensesYear)}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: '#ef4444' }}
                      title="Remove Current Season Year"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}

              <input
                type="text"
                className="search-input"
                placeholder={activeModule === 'expenses' ? "Search events..." : "Search sessions..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <ul className="event-list">
                {activeModule === 'expenses' ? (
                  filteredEvents.map((eventName) => (
                    <li
                      key={eventName}
                      className={`event-item ${currentEvent === eventName ? 'active' : ''}`}
                      onClick={() => setCurrentEvent(eventName)}
                    >
                      <span>{eventName}</span>
                      <button
                        className="delete-event-btn"
                        onClick={(e) => handleDeleteEvent(eventName, e)}
                        title="Delete event tab"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))
                ) : (
                  filteredYears.map((yearName) => (
                    <li
                      key={yearName}
                      className={`event-item ${currentBkYear === yearName ? 'active' : ''}`}
                      onClick={() => setCurrentBkYear(yearName)}
                    >
                      <span>{yearName}</span>
                      <button
                        className="delete-event-btn"
                        onClick={(e) => handleDeleteBkYear(yearName, e)}
                        title="Delete session tab"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))
                )}

                {activeModule === 'expenses' && filteredEvents.length === 0 && (
                  <li className="event-item" style={{ cursor: 'default', color: 'var(--text-muted)' }}>No events found</li>
                )}
                {activeModule === 'bookkeeping' && filteredYears.length === 0 && (
                  <li className="event-item" style={{ cursor: 'default', color: 'var(--text-muted)' }}>No sessions found</li>
                )}
              </ul>

              <button
                className="btn btn-primary"
                onClick={() => setShowAddEvent(true)}
                style={{ width: '100%' }}
              >
                <Plus size={16} />
                {activeModule === 'expenses' ? "Create Event Tab" : "Create Session Tab"}
              </button>
            </aside>

            {/* Main Panel */}
            <main className="main-content">
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    border: '3px solid var(--border-color)',
                    borderTopColor: 'var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                </div>
              )}

              {/* SPREADSHEET LINK MISSING SCREEN */}
              {activeModule === 'expenses' && !getActiveSpreadsheetId('expenses', selectedExpensesYear) && !loading && (
                <div style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--surface-hover)', borderRadius: '16px', border: '1px dashed var(--border)', maxWidth: '600px', margin: '40px auto' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                    <Link size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px 0' }}>Spreadsheet Link Required</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                    There is no Google Spreadsheet linked to the <strong>{selectedExpensesYear} Season</strong>. Please paste the Spreadsheet URL in Settings to start managing expenses.
                  </p>
                  <button
                    onClick={() => {
                      setSettingsTab('links');
                      setLinkInputYear(selectedExpensesYear);
                      setShowSettings(true);
                    }}
                    className="btn btn-primary"
                    style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}
                  >
                    <Plus size={16} />
                    Configure Spreadsheet Link
                  </button>
                </div>
              )}

              {/* NO ACTIVE EVENT/YEAR SELECTOR */}
              {activeModule === 'expenses' && getActiveSpreadsheetId('expenses', selectedExpensesYear) && !currentEvent && !loading && (
                <div style={{ textAlign: 'center', padding: '80px 24px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                  <FileText size={48} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '16px' }} />
                  <h3>No Event Selected</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Please select an event tab from the sidebar, or create a new event sheet tab to begin.</p>
                </div>
              )}

              {activeModule === 'bookkeeping' && !currentBkYear && !loading && (
                <div style={{ textAlign: 'center', padding: '80px 24px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                  <FileText size={48} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '16px' }} />
                  <h3>No Session Selected</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Please select an academic session from the sidebar, or create a new year sheet tab to begin.</p>
                </div>
              )}

              {/* ========================================================= */}
              {/* EXPENSES INTERFACE */}
              {/* ========================================================= */}
              {activeModule === 'expenses' && getActiveSpreadsheetId('expenses', selectedExpensesYear) && currentEvent && !loading && (
                <>
                  {/* Event Title Block */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{currentEvent}</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Expense details tracker sheet for the active event.</p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => fetchEventData(currentEvent)}>
                      Refresh Sheet
                    </button>
                  </div>

                  {/* KPI cards */}
                  <section className="stats-grid" style={{ marginBottom: '24px' }}>
                    <div className="stat-card primary">
                      <span className="stat-label">Total Expenses</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Briefcase size={20} style={{ color: 'var(--primary)' }} />
                        <span className="stat-value" style={{ color: 'var(--primary)' }}>
                          Rs {expensesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="stat-card secondary">
                      <span className="stat-label">Items Count</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Hash size={20} style={{ color: 'var(--secondary)' }} />
                        <span className="stat-value" style={{ color: 'var(--secondary)' }}>
                          {itemsCount}
                        </span>
                      </div>
                    </div>

                    <div className="stat-card success">
                      <span className="stat-label">Average Unit Cost</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingBag size={20} style={{ color: 'var(--success)' }} />
                        <span className="stat-value" style={{ color: 'var(--success)' }}>
                          Rs {avgCost.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Expenses Table Card */}
                  <section className="section-card">
                    <div className="card-header">
                      <h3 className="card-title">
                        <FileText size={16} style={{ color: 'var(--primary)' }} />
                        Expenses Details (Table A-D)
                      </h3>
                      <button className="btn btn-primary" onClick={() => openExpenseModal()} style={{ padding: '8px 16px' }}>
                        <PlusCircle size={14} />
                        Add Expense Details
                      </button>
                    </div>

                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>ITEMS</th>
                            <th>QUANTITY</th>
                            <th>UNIT PRICE</th>
                            <th>TOTAL PRICE</th>
                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventData.expenses.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{item.item}</td>
                              <td>{item.qty}</td>
                              <td>Rs {Number(item.price).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>Rs {Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                              <td className="action-cell">
                                <button className="btn btn-ghost" onClick={() => openExpenseModal(item, idx)} title="Edit item">
                                  <Edit3 size={14} />
                                </button>
                                <button className="btn btn-ghost" onClick={() => handleDeleteExpense(idx)} title="Delete item" style={{ color: 'var(--danger)' }}>
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {eventData.expenses.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                                No expenses registered. Click 'Add Expense Details' to start.
                              </td>
                            </tr>
                          )}
                          <tr className="total-row">
                            <td colSpan="3">TOTAL EXPENSES -</td>
                            <td colSpan="2" style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>Rs {expensesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Event Bills & Invoices Gallery */}
                  <section className="section-card" style={{ marginTop: '24px' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <h3 className="card-title">
                        <ShoppingBag size={16} style={{ color: 'var(--primary)' }} />
                        Event Bills & Invoices
                      </h3>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleLinkBillManually}
                          style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                        >
                          <Link size={14} />
                          Link Bill via URL
                        </button>
                        
                        <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', margin: 0 }}>
                          <PlusCircle size={14} />
                          Upload Bill to Drive
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleUploadBillFile}
                            style={{ display: 'none' }}
                            multiple
                          />
                        </label>
                      </div>
                    </div>

                    {/* Image Cards List */}
                    {!eventData.images || eventData.images.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>No bills uploaded for this event yet.</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Upload PNG/JPG invoices directly to secure Google Drive storage.</p>
                      </div>
                    ) : (
                      <div className="images-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
                        {eventData.images.map((img, idx) => (
                          <div key={idx} className="image-card" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'var(--transition)' }}>
                            <div style={{ height: '140px', backgroundColor: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-color)', overflow: 'hidden', position: 'relative' }}>
                              <img 
                                src={img.imageUrl} 
                                alt={img.category} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentNode.innerHTML = `<div style="font-size: 2rem; color: var(--text-muted)">📄</div>`;
                                }}
                              />
                              <span style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: 'var(--primary)', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                {img.category}
                              </span>
                            </div>
                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }}>
                                Bill #{idx + 1} ({img.category})
                              </span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <a 
                                  href={img.imageUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="btn btn-secondary" 
                                  style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem', padding: '6px 0', textDecoration: 'none', color: 'var(--text-main)', display: 'block' }}
                                >
                                  View Bill
                                </a>
                                <button 
                                  type="button"
                                  className="btn btn-secondary" 
                                  onClick={() => handleDeleteBill(img.imageUrl)}
                                  style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Delete Bill"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* ========================================================= */}
              {/* BOOK KEEPING INTERFACE */}
              {/* ========================================================= */}
              {activeModule === 'bookkeeping' && currentBkYear && !loading && (
                <>
                  {/* Year Title Block */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{currentBkYear}</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Financial session ledger sheets (Withdrawals, Reserves, Income).</p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => fetchBookKeepingData(currentBkYear)}>
                      Refresh Data
                    </button>
                  </div>

                  {/* Bookkeeping KPI Stats */}
                  <section className="stats-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <div className="stat-card success" style={{ borderLeftColor: 'var(--success)' }}>
                      <span className="stat-label">Total Income</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowUpCircle size={20} style={{ color: 'var(--success)' }} />
                        <span className="stat-value" style={{ color: 'var(--success)' }}>
                          Rs {bkIncomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="stat-card secondary" style={{ borderLeftColor: 'var(--danger)' }}>
                      <span className="stat-label">Total Withdrawals</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowDownCircle size={20} style={{ color: 'var(--danger)' }} />
                        <span className="stat-value" style={{ color: 'var(--danger)' }}>
                          Rs {bkWithdrawTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="stat-card primary" style={{ borderLeftColor: 'var(--secondary)' }}>
                      <span className="stat-label">Remaining Reserves Balance</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Briefcase size={20} style={{ color: 'var(--secondary)' }} />
                        <span className="stat-value" style={{ color: 'var(--secondary)' }}>
                          Rs {bkRemainTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)', backgroundColor: 'var(--accent)' }}>
                      <span className="stat-label">Net Session Income</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {bkNetBalance >= 0 ? (
                          <ArrowUpCircle size={20} style={{ color: 'var(--success)' }} />
                        ) : (
                          <ArrowDownCircle size={20} style={{ color: 'var(--danger)' }} />
                        )}
                        <span className="stat-value" style={{ color: bkNetBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          Rs {bkNetBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* View Switches */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setBkSubView('all')}
                      className={`btn ${bkSubView === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      All Tables (Side-by-Side)
                    </button>
                    <button
                      onClick={() => setBkSubView('withdraw')}
                      className={`btn ${bkSubView === 'withdraw' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Withdraw Only
                    </button>
                    <button
                      onClick={() => setBkSubView('remain')}
                      className={`btn ${bkSubView === 'remain' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Reserves & Initial Balances
                    </button>
                    <button
                      onClick={() => setBkSubView('income')}
                      className={`btn ${bkSubView === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Income Only
                    </button>
                  </div>

                  {/* GRID OF SEPARATED TABLES */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: bkSubView === 'all' ? '1.1fr 1.6fr 1.1fr' : '1fr',
                    gap: '24px',
                    alignItems: 'start',
                    overflowX: 'auto'
                  }}>

                    {/* 1. WITHDRAW TABLE CARD */}
                    {(bkSubView === 'all' || bkSubView === 'withdraw') && (
                      <section className="section-card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ color: 'var(--danger)' }}>
                            <ArrowDownCircle size={16} />
                            Withdraw List
                          </h3>
                          <button className="btn btn-primary" onClick={() => openBkModal('withdraw')} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            <PlusCircle size={12} />
                            Record Withdrawal
                          </button>
                        </div>

                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'center' }}>DATE</th>
                                <th style={{ textAlign: 'right' }}>AMOUNT</th>
                                <th style={{ textAlign: 'center' }}>RAISED</th>
                                <th style={{ textAlign: 'center' }}>FROM (BRANCH)</th>
                                <th style={{ textAlign: 'left' }}>DESCRIPTION</th>
                                <th style={{ textAlign: 'right' }}>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {withdraws.map((item, idx) => (
                                <tr key={idx}>
                                  <td style={{ textAlign: 'center' }}>{item.date}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                                    Rs {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>{item.raised}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                    {item.branch === 'Collab' ? (
                                      'Collab (' +
                                      activeBranches.map(br => {
                                        const splits = item.collabSplits || {};
                                        if (Object.keys(splits).length === 0) {
                                          if (item.collabBranchAmount) splits['Branch'] = item.collabBranchAmount;
                                          if (item.collabApAmount) splits['AP'] = item.collabApAmount;
                                          if (item.collabMttsAmount) splits['MTT-S'] = item.collabMttsAmount;
                                        }
                                        return { name: br, val: splits[br] || 0 };
                                      })
                                        .filter(s => s.val > 0)
                                        .map(s => `${s.name}: Rs ${s.val.toLocaleString('en-IN')}`)
                                        .join(', ') +
                                      ')'
                                    ) : item.branch}
                                  </td>
                                  <td style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'normal', minWidth: '150px' }}>{item.description}</td>
                                  <td className="action-cell" style={{ textAlign: 'right' }}>
                                    <button className="btn btn-ghost" onClick={() => openBkModal('withdraw', item, idx)} title="Edit">
                                      <Edit3 size={12} />
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => handleDeleteBkTransaction('withdraw', idx)} title="Delete" style={{ color: 'var(--danger)' }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {withdraws.length === 0 && (
                                <tr>
                                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No withdrawals registered.</td>
                                </tr>
                              )}
                              <tr className="total-row">
                                <td style={{ textAlign: 'center' }}>TOTAL</td>
                                <td colSpan="5" style={{ color: 'var(--danger)', textAlign: 'left', paddingLeft: '8px' }}>
                                  Rs {bkWithdrawTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {/* 2. REMAIN (RESERVES) TABLE CARD */}
                    {(bkSubView === 'all' || bkSubView === 'remain') && (
                      <section className="section-card">
                        <div className="card-header" style={{ flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <h3 className="card-title" style={{ color: 'var(--secondary)' }}>
                              <Briefcase size={16} />
                              Remain / Reserves
                            </h3>
                            <button className="btn btn-secondary" onClick={() => openBkModal('initial')} style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}>
                              <PlusCircle size={12} />
                              Set Initial Balance
                            </button>
                          </div>

                          {/* List of starting balances */}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', padding: '6px', backgroundColor: 'var(--bg-page)', borderRadius: '6px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center' }}>INITIALS:</span>
                            {initialBalances.map((ib, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  backgroundColor: 'var(--bg-card)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '0.75rem'
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>{ib.branch}:</span>
                                <span style={{ color: 'var(--success)' }}>Rs {ib.amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
                                <button
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--text-muted)' }}
                                  onClick={() => openBkModal('initial', ib, idx)}
                                  title="Edit starting amount"
                                >
                                  <Edit3 size={10} />
                                </button>
                                <button
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--danger)' }}
                                  onClick={() => handleDeleteBkTransaction('initial', idx)}
                                  title="Delete starting amount"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>


                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'center' }}>DATE</th>
                                <th style={{ textAlign: 'left' }}>PARTICULARS</th>
                                {activeBranches.map(br => (
                                  <th style={{ textAlign: 'right' }} key={br}>{br.toUpperCase()}</th>
                                ))}
                                <th style={{ textAlign: 'right' }}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {remainRows.map((item, idx) => (
                                <tr key={idx} style={{ opacity: item.isInitial ? 0.7 : 1, backgroundColor: item.isInitial ? 'var(--accent)' : 'transparent' }}>
                                  <td style={{ textAlign: 'center' }}>{item.date}</td>
                                  <td style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.description}</td>
                                  {activeBranches.map(br => {
                                    const val = item.branchBalances[br] || 0;
                                    return (
                                      <td style={{ textAlign: 'right', fontWeight: 600, color: val >= 0 ? 'var(--text-main)' : 'var(--danger)' }} key={br}>
                                        Rs {val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      </td>
                                    );
                                  })}
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: item.total >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
                                    Rs {item.total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                              {remainRows.length === 0 && (
                                <tr>
                                  <td colSpan={activeBranches.length + 3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No reserves data calculated. Add starting amounts first.</td>
                                </tr>
                              )}
                              <tr className="total-row">
                                <td colSpan="2" style={{ textAlign: 'center' }}>TOTAL RESERVES</td>
                                {activeBranches.map(br => (
                                  <td style={{ textAlign: 'right' }} key={br}>
                                    Rs {(finalBalances[br] || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                  </td>
                                ))}
                                <td style={{ textAlign: 'right', color: 'var(--secondary)', fontSize: '1.05rem' }}>
                                  Rs {bkRemainTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {/* 3. INCOME TABLE CARD */}
                    {(bkSubView === 'all' || bkSubView === 'income') && (
                      <section className="section-card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ color: 'var(--success)' }}>
                            <ArrowUpCircle size={16} />
                            Income List
                          </h3>
                          <button className="btn btn-secondary" onClick={() => openBkModal('income')} style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--success)', color: 'var(--success)' }}>
                            <PlusCircle size={12} />
                            Record Income
                          </button>
                        </div>

                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'center' }}>DATE</th>
                                <th style={{ textAlign: 'right' }}>AMOUNT</th>
                                <th style={{ textAlign: 'center' }}>BRANCH</th>
                                <th style={{ textAlign: 'left' }}>SOURCE</th>
                                <th style={{ textAlign: 'right' }}>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incomes.map((item, idx) => (
                                <tr key={idx}>
                                  <td style={{ textAlign: 'center' }}>{item.date}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                    Rs {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                    {item.branch === 'Collab' ? (
                                      'Collab (' +
                                      activeBranches.map(br => {
                                        const splits = item.collabSplits || {};
                                        if (Object.keys(splits).length === 0) {
                                          if (item.collabBranchAmount) splits['Branch'] = item.collabBranchAmount;
                                          if (item.collabApAmount) splits['AP'] = item.collabApAmount;
                                          if (item.collabMttsAmount) splits['MTT-S'] = item.collabMttsAmount;
                                        }
                                        return { name: br, val: splits[br] || 0 };
                                      })
                                        .filter(s => s.val > 0)
                                        .map(s => `${s.name}: Rs ${s.val.toLocaleString('en-IN')}`)
                                        .join(', ') +
                                      ')'
                                    ) : item.branch}
                                  </td>
                                  <td style={{ textAlign: 'left', fontSize: '0.8rem' }}>{item.source}</td>
                                  <td className="action-cell" style={{ textAlign: 'right' }}>
                                    <button className="btn btn-ghost" onClick={() => openBkModal('income', item, idx)} title="Edit">
                                      <Edit3 size={12} />
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => handleDeleteBkTransaction('income', idx)} title="Delete" style={{ color: 'var(--danger)' }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {incomes.length === 0 && (
                                <tr>
                                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No income registered.</td>
                                </tr>
                              )}
                              <tr className="total-row">
                                <td style={{ textAlign: 'center' }}>TOTAL</td>
                                <td colSpan="4" style={{ color: 'var(--success)', textAlign: 'left', paddingLeft: '8px' }}>
                                  Rs {bkIncomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                  </div>
                </>
              )}
            </main>
          </div>

          {/* ========================================================= */}
          {/* MODALS */}
          {/* ========================================================= */}

          {/* Executive Settings Modal */}
          {showSettings && (
            <div className="modal-overlay" style={{ zIndex: 1100 }}>
              <div className="modal-content" style={{ maxWidth: '680px', padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--border)' }}>
                {/* Modal Header */}
                <div style={{ padding: '20px 24px', backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(14, 165, 233, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SettingsIcon size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>Portal System Settings</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configure security, database links, and Google API connections</span>
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setShowSettings(false)} style={{ padding: '6px' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Settings Navigation Tabs */}
                <div style={{ display: 'flex', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                  <button
                    type="button"
                    onClick={() => setSettingsTab('security')}
                    style={{
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: settingsTab === 'security' ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: settingsTab === 'security' ? '2px solid var(--primary)' : '2px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Lock size={15} />
                    Account Security
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsTab('links')}
                    style={{
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: settingsTab === 'links' ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: settingsTab === 'links' ? '2px solid var(--primary)' : '2px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Link size={15} />
                    Yearly Sheet Links
                  </button>
                </div>

                {/* Tab Body Container */}
                <div style={{ padding: '24px', maxHeight: '520px', overflowY: 'auto' }}>

                  {/* TAB 1: Account Security */}
                  {settingsTab === 'security' && (
                    <form onSubmit={handleSaveSecuritySettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Registered Account Email</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          <User size={16} />
                          <span>{modalEmail}</span>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Passcode (SHA-256 Encrypted)</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPassword ? "text" : "password"}
                            className="form-input"
                            style={{ paddingRight: '40px' }}
                            placeholder="Enter new passcode"
                            value={modalPasscode}
                            onChange={(e) => setModalPasscode(e.target.value)}
                            required
                            minLength={4}
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Security Question</label>
                        <select
                          className="form-input"
                          value={modalQuestion}
                          onChange={(e) => setModalQuestion(e.target.value)}
                          required
                        >
                          <option value="What is the default recovery code?">What is the default recovery code?</option>
                          <option value="What was your first school?">What was your first school?</option>
                          <option value="What is your pet's name?">What is your pet's name?</option>
                          <option value="What is your mother's maiden name?">What is your mother's maiden name?</option>
                          <option value="What was the name of your first IEEE event?">What was the name of your first IEEE event?</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Security Answer</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter answer"
                          value={modalAnswer}
                          onChange={(e) => setModalAnswer(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          <Save size={15} />
                          {loading ? "Saving..." : "Save Account Security"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: Yearly Sheet Links Manager */}
                  {settingsTab === 'links' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <PlusCircle size={15} style={{ color: 'var(--primary)' }} />
                          Assign Spreadsheet Link for Specific Year
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                          Paste a Google Sheet URL (e.g. <code>https://docs.google.com/spreadsheets/d/.../edit</code>) or Spreadsheet ID. It will be saved in Neon PostgreSQL and assigned to that year.
                        </p>

                        <form onSubmit={handleSaveYearlyLink} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Year</label>
                            <select
                              className="form-input"
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                              value={linkInputYear}
                              onChange={(e) => setLinkInputYear(e.target.value)}
                            >
                              {expensesSeasons.map(yr => (
                                <option key={yr} value={yr}>{yr} Season</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Google Sheet Link or ID</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Paste full Google Sheet URL or ID here..."
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                              value={linkInputUrl}
                              onChange={(e) => setLinkInputUrl(e.target.value)}
                              required
                            />
                          </div>

                          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 18px', fontSize: '0.85rem', marginTop: '4px' }} disabled={loading}>
                            <Save size={15} />
                            Save Year Link
                          </button>
                        </form>
                      </div>

                      {/* Configured Links List */}
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Configured Yearly Links ({yearlySpreadsheets.length})</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>Overriding default system sheet</span>
                        </h4>

                        {yearlySpreadsheets.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            No custom year links added yet. All years currently use the default system spreadsheet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {yearlySpreadsheets.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--primary)', backgroundColor: 'rgba(14, 165, 233, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                      {item.year}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>
                                      {item.module_type === 'expenses' ? 'Event Expenses' : 'Book Keeping'}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                                    ID: {item.spreadsheet_id}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleDeleteYearlyLink(item.year, item.module_type)}
                                  title="Delete custom link for this year"
                                >
                                  <Trash2 size={13} />
                                  Delete Link
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create Event / Year Tab Modal */}
          {showAddEvent && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 className="modal-title">
                    {activeModule === 'expenses' ? "Create New Event" : "Create Academic Session"}
                  </h3>
                  <button className="btn btn-ghost" onClick={() => setShowAddEvent(false)}>
                    <X size={18} />
                  </button>
                </div>

                <form
                  onSubmit={activeModule === 'expenses' ? handleCreateEvent : handleCreateBkYear}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div className="form-group">
                    <label className="form-label">
                      {activeModule === 'expenses' ? "Event Sheet Name" : "Session Name (e.g., 2026-2027)"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={activeModule === 'expenses' ? "e.g. Dr Prabir Boraah" : "e.g. 2026-2027"}
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      autoFocus
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      This will insert a new tab sheet formatted exactly as required.
                    </span>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddEvent(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Create Tab
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Expenses Form Modal (Add/Edit) */}
          {showExpenseModal && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '640px' }}>
                <div className="modal-header">
                  <h3 className="modal-title">
                    {isEditMode ? "Edit Expense Item" : "Add Expense Items (Multiple)"}
                  </h3>
                  <button className="btn btn-ghost" onClick={() => setShowExpenseModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                    {expenseRows.map((row, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px auto', gap: '10px', alignItems: 'center' }}>
                        <div className="form-group" style={{ gap: '4px' }}>
                          {idx === 0 && <label className="form-label">Item Name / Category</label>}
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Red Tea"
                            value={row.item}
                            onChange={(e) => handleExpenseRowChange(idx, 'item', e.target.value)}
                            required={idx === 0}
                          />
                        </div>

                        <div className="form-group" style={{ gap: '4px' }}>
                          {idx === 0 && <label className="form-label">Quantity</label>}
                          <input
                            type="number"
                            className="form-input"
                            placeholder="1"
                            min="1"
                            value={row.qty}
                            onChange={(e) => handleExpenseRowChange(idx, 'qty', e.target.value)}
                            required={idx === 0}
                          />
                        </div>

                        <div className="form-group" style={{ gap: '4px' }}>
                          {idx === 0 && <label className="form-label">Unit Price (Rs)</label>}
                          <input
                            type="number"
                            className="form-input"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={row.price}
                            onChange={(e) => handleExpenseRowChange(idx, 'price', e.target.value)}
                            required={idx === 0}
                          />
                        </div>

                        <div>
                          {idx === 0 && <div style={{ height: '22px' }}></div>}
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '8px', minWidth: 'auto' }}
                            disabled={expenseRows.length === 1}
                            onClick={() => handleRemoveExpenseRowField(idx)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isEditMode && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddExpenseRowField}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <PlusCircle size={14} />
                      Add another item row
                    </button>
                  )}

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {isEditMode ? "Save Expense" : "Save All Expenses"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Book Keeping Transaction Modal (Separated Withdrawal / Income / Initial Modal) */}
          {showBkModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 className="modal-title" style={{ textTransform: 'capitalize' }}>
                    {bkIsEdit ? 'Edit' : 'Record'} {
                      bkModalType === 'withdraw' ? 'Withdrawal' :
                        bkModalType === 'income' ? 'Income' : 'Initial Balance'
                    }
                  </h3>
                  <button className="btn btn-ghost" onClick={() => setShowBkModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleBkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={bkDate}
                      onChange={(e) => setBkDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      {bkModalType === 'initial' ? 'Initial Amount (Rs)' : 'Amount (Rs)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={bkAmount}
                      placeholder="0"
                      onChange={(e) => setBkAmount(e.target.value)}
                      disabled={bkBranch === 'Collab'}
                      required
                    />
                  </div>

                  {/* Branch/MTT-S/AP dropdown picker */}
                  <div className="form-group">
                    <label className="form-label">Branch / MTT-S / AP / Society</label>
                    <select
                      className="form-input"
                      value={bkBranch}
                      onChange={(e) => {
                        const selected = e.target.value;
                        setBkBranch(selected);
                        if (selected === 'Collab') {
                          const total = activeBranches.reduce((sum, b) => {
                            return sum + (Number(bkCollabSplits[b]) || 0);
                          }, 0);
                          setBkAmount(total.toString());
                        }
                      }}
                      required
                    >
                      {activeBranches.map(br => (
                        <option value={br} key={br}>{br}</option>
                      ))}
                      {bkModalType !== 'initial' && <option value="Collab">Collab</option>}
                      <option value="Custom">Custom...</option>
                    </select>
                  </div>

                  {bkBranch === 'Custom' && (
                    <div className="form-group">
                      <label className="form-label">Enter Custom Branch Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. WIE"
                        value={bkCustomBranch}
                        onChange={(e) => setBkCustomBranch(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {bkBranch === 'Collab' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                      {activeBranches.map(br => (
                        <div className="form-group" key={br}>
                          <label className="form-label">{br} Amount (Rs)</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            placeholder="0"
                            value={bkCollabSplits[br] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedSplits = { ...bkCollabSplits, [br]: val };
                              setBkCollabSplits(updatedSplits);

                              const total = activeBranches.reduce((sum, b) => {
                                return sum + (Number(updatedSplits[b]) || 0);
                              }, 0);
                              setBkAmount(total.toString());
                            }}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* WITHDRAWAL SPECIFIC FIELDS */}
                  {bkModalType === 'withdraw' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Raised By</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Souvik Ghosh"
                          value={bkRaised}
                          onChange={(e) => setBkRaised(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description / Details</label>
                        <textarea
                          className="form-input"
                          style={{ minHeight: '85px', fontFamily: 'inherit', padding: '8px' }}
                          placeholder="Enter a description..."
                          value={bkDescription}
                          onChange={(e) => setBkDescription(e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* INCOME SPECIFIC FIELDS */}
                  {bkModalType === 'income' && (
                    <div className="form-group">
                      <label className="form-label">Source of Income</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. HQ Grant / Orientation Tickets"
                        value={bkSource}
                        onChange={(e) => setBkSource(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowBkModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {bkIsEdit ? 'Save Changes' : `Add Entry`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
