import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc,
  onSnapshot, query, where, updateDoc, arrayUnion, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAnxIsftWdUxtHEh7nxX1UPRA29c0n1444",
  authDomain: "quiz-master-3e489.firebaseapp.com",
  projectId: "quiz-master-3e489",
  storageBucket: "quiz-master-3e489.firebasestorage.app",
  messagingSenderId: "741393992507",
  appId: "1:741393992507:web:b28cd8fcda2b74f85b851e"
};

let app = null, db = null;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (err) {
  console.warn("Offline fallback mode initialized safely.");
}

/* ============================================================
   UTILITIES
============================================================ */
function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
function genPin() { return `TN${Math.floor(1000 + Math.random() * 9000)}`; }
function nowMs() { return Date.now(); }
function sanitize(str) { return String(str || '').replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function stripHtml(str) { return String(str || '').replace(/<[^>]+>/g, ''); }

function fmtDateLong(ms) {
  if (!ms) return '--';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtTime12(ms) {
  if (!ms) return '--';
  let h = new Date(ms).getHours(), m = new Date(ms).getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}
function fmtDurationLabel(mins) {
  mins = parseInt(mins) || 0;
  if (mins < 60) return `${mins} Mins`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h} Hour${h > 1 ? 's' : ''}` : `${h}h ${m}m`;
}
function fmtClockFromSeconds(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function fmtCountdownParts(msRemaining) {
  msRemaining = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(msRemaining / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(d).padStart(2, '0')} : ${String(h).padStart(2, '0')} : ${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
}
function getShareUrl(contextId) {
  return window.location.origin + window.location.pathname + "?exam=" + encodeURIComponent(contextId);
}

/* ============================================================
   STATE
============================================================ */
const state = {
  quizzes: [],
  contexts: [],           // exam_contexts cache (scheduled + practice)
  submissions: [],
  currentUser: { uid: 'GUEST', role: 'guest', name: 'Guest' },

  liveRoom: { active: false, contextId: null, pin: '', title: '', durationMinutes: 30, participants: [], sourceQuizId: null, unsub: null, tickerId: null },

  activeQuiz: null, activeQuestions: [], userAnswers: {}, currentQuestionIndex: 0,
  runnerTimerId: null, runnerHeartbeatId: null,
  studentMeta: { name: '', rollNo: '', pin: '', contextId: null, participantId: null, deadlineAt: null, startedAt: null },

  creatorQuestions: [], excelParsedRows: [], excelWorkbook: null,
  tutStep: 1,

  gateway: { contextId: null, mode: 'student', tickerId: null, monitorUnsub: null },
  marksheetRows: [], marksheetExamTitle: '',
  groupSelectedIds: new Set()
};

/* ============================================================
   BOOTSTRAP
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  setupThemeAndPalette();
  registerNavigationEvents();
  registerAuthEvents();
  registerCreatorEvents();
  registerExcelEvents();
  registerLiveEvents();
  registerGroupEvents();
  registerLibraryEvents();
  registerMarksheetEvents();
  registerPdfToolEvents();
  registerGatewayEvents();

  await checkPersistedSession();
  await loadQuizzesFromCloud();
  await loadContextsFromCloud();

  const urlParams = new URLSearchParams(window.location.search);
  const examParam = urlParams.get('exam');
  const assessmentParam = urlParams.get('assessment');
  const pinFromUrl = urlParams.get('pin');

  if (examParam || assessmentParam || pinFromUrl) {
    document.getElementById('teacherAuthGates').style.display = 'none';
    document.body.classList.add('student-mode');
    document.getElementById('welcomeGate').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');

    if (examParam) {
      openGateway(examParam, 'student');
    } else if (assessmentParam) {
      const ctxId = await ensurePracticeContext(assessmentParam);
      if (ctxId) openGateway(ctxId, 'student');
      else displayToast("Assessment not found.", "error");
    } else if (pinFromUrl) {
      const ctx = await findContextByPin(pinFromUrl.trim().toUpperCase());
      if (ctx) openGateway(ctx.id, 'student');
      else displayToast("PIN invalid or exam not found.", "error");
    }
  }
});

function setupThemeAndPalette() {
  const html = document.documentElement;
  document.getElementById('themeToggleBtn').onclick = () => {
    const nextMode = html.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-mode', nextMode);
  };
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.onclick = () => {
      html.setAttribute('data-theme', dot.getAttribute('data-palette'));
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    };
  });
  const tutBtn = document.getElementById('btnStartTutorialHeader');
  if (tutBtn) tutBtn.onclick = () => window.appEngineAPI.startTutorial();
  const regBtn = document.getElementById('btnRegister');
  if (regBtn) regBtn.onclick = () => {
    const name = document.getElementById('regName').value.trim() || 'New User';
    const role = document.getElementById('regRole').value;
    authorizeSession({ uid: 'U-' + Date.now(), role: role === 'student' ? 'student' : 'teacher', name });
    displayToast("Account created for this session.", "success");
  };
}

function registerAuthEvents() {
  document.getElementById('btnEnterGuest').onclick = () => authorizeSession({ uid: 'GUEST', role: 'guest', name: 'Guest' });
  document.getElementById('btnLogin').onclick = () => authorizeSession({ uid: 'TEACHER', role: 'teacher', name: 'Educator' });
  document.getElementById('btnStudentEnterLive').onclick = handleStudentQuickJoin;
  document.getElementById('logoutBtn').onclick = () => { localStorage.clear(); location.reload(); };
}

async function checkPersistedSession() {
  const session = await localforage.getItem('activeSession');
  if (session && !document.body.classList.contains('student-mode')) authorizeSession(session);
  else document.getElementById('welcomeGate').classList.remove('hidden');
}

async function authorizeSession(profile) {
  state.currentUser = profile;
  await localforage.setItem('activeSession', profile);
  document.getElementById('welcomeGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('welcomeUserName').textContent = profile.name;
  const badge = document.getElementById('headerUserBadge'); if (badge) badge.textContent = profile.name;
  const role = document.getElementById('headerRoleBadge'); if (role) role.textContent = profile.role === 'teacher' ? 'School Admin' : (profile.role === 'student' ? 'Student' : 'Guest');
}

/* ============================================================
   QUICK PIN JOIN (Welcome Gate banner)
============================================================ */
async function handleStudentQuickJoin() {
  const pin = document.getElementById('studentPinInput').value.trim().toUpperCase();
  const name = document.getElementById('studentNameInput').value.trim();
  const rollNo = document.getElementById('studentRollInput').value.trim();
  if (!pin || !name) return displayToast("Exam PIN and Name are required.", "error");

  const ctx = await findContextByPin(pin);
  if (!ctx) return displayToast("PIN invalid or exam not found.", "error");

  document.body.classList.add('student-mode');
  document.getElementById('welcomeGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('teacherAuthGates').style.display = 'none';

  openGateway(ctx.id, 'student', { prefillName: name, prefillRoll: rollNo, autoJoin: true });
}

/* ============================================================
   FIRESTORE: QUIZZES
============================================================ */
async function loadQuizzesFromCloud() {
  let cloudOk = false;
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'quizzes'));
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      if (list.length) { state.quizzes = list; cloudOk = true; }
    } catch (e) { console.warn("Cloud quiz fetch failed, using local cache.", e); }
  }
  if (!cloudOk) {
    try {
      const raw = localStorage.getItem('QMP_QUIZZES_CACHE');
      if (raw) state.quizzes = JSON.parse(raw);
    } catch (e) {}
  }
  cacheQuizzesLocally();
  renderDashboardData(); populateSelects(); renderLibrary(); renderGroupInventory(); populateMarksheetAndPdfSelects();
}

function cacheQuizzesLocally() {
  try { localStorage.setItem('QMP_QUIZZES_CACHE', JSON.stringify(state.quizzes)); } catch (e) {}
}

async function saveQuizToCloud(quiz) {
  state.quizzes.push(quiz);
  cacheQuizzesLocally();
  if (db) {
    try { await setDoc(doc(db, 'quizzes', quiz.id), quiz); }
    catch (e) { console.warn("Could not sync quiz to cloud. Saved locally only.", e); displayToast("Saved locally — cloud sync failed.", "info"); }
  }
  renderDashboardData(); populateSelects(); renderLibrary(); renderGroupInventory(); populateMarksheetAndPdfSelects();
}

async function deleteQuizEverywhere(quizId) {
  state.quizzes = state.quizzes.filter(q => q.id !== quizId);
  cacheQuizzesLocally();
  if (db) { try { await deleteDoc(doc(db, 'quizzes', quizId)); } catch (e) { console.warn("Cloud delete failed", e); } }
  renderDashboardData(); populateSelects(); renderLibrary(); renderGroupInventory(); populateMarksheetAndPdfSelects();
}

/* ============================================================
   FIRESTORE: EXAM CONTEXTS (scheduled + practice + instant-live)
   exam_contexts/{contextId}
     { id, quizId, title, class, subject, type: 'scheduled'|'practice',
       durationMinutes, windowStart, windowEnd, pin, cancelled, createdAt }
   exam_contexts/{contextId}/participants/{participantId}
   exam_contexts/{contextId}/answers/{participantId}       -> { responses: {qIndex: 'A'} }
   exam_contexts/{contextId}/submissions/{participantId}
============================================================ */
async function loadContextsFromCloud() {
  if (!db) { loadContextsFromLocal(); renderDashboardData(); return; }
  try {
    const snap = await getDocs(collection(db, 'exam_contexts'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    state.contexts = list;
    cacheContextsLocally();
  } catch (e) { console.warn("Cloud context fetch failed", e); loadContextsFromLocal(); }
  renderDashboardData();
}
function loadContextsFromLocal() {
  try { const raw = localStorage.getItem('QMP_CONTEXTS_CACHE'); if (raw) state.contexts = JSON.parse(raw); } catch (e) {}
}
function cacheContextsLocally() { try { localStorage.setItem('QMP_CONTEXTS_CACHE', JSON.stringify(state.contexts)); } catch (e) {} }

async function createExamContext(cfg) {
  const context = {
    id: cfg.id, quizId: cfg.quizId, title: cfg.title, class: cfg.class || '', subject: cfg.subject || '',
    type: cfg.type, durationMinutes: parseInt(cfg.durationMinutes) || 30,
    windowStart: cfg.windowStart || null, windowEnd: cfg.windowEnd || null,
    pin: cfg.pin || genPin(), cancelled: false, createdAt: nowMs(), createdBy: state.currentUser.name || 'Teacher'
  };
  const idx = state.contexts.findIndex(c => c.id === context.id);
  if (idx > -1) state.contexts[idx] = { ...state.contexts[idx], ...context };
  else state.contexts.push(context);
  cacheContextsLocally();
  if (db) { try { await setDoc(doc(db, 'exam_contexts', context.id), context, { merge: true }); } catch (e) { console.warn("Could not sync exam context to cloud.", e); } }
  return context;
}

async function getContextById(contextId) {
  let ctx = state.contexts.find(c => c.id === contextId);
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'exam_contexts', contextId));
      if (snap.exists()) {
        ctx = { id: snap.id, ...snap.data() };
        const idx = state.contexts.findIndex(c => c.id === contextId);
        if (idx > -1) state.contexts[idx] = ctx; else state.contexts.push(ctx);
        cacheContextsLocally();
      }
    } catch (e) { console.warn("Context fetch failed, using cache.", e); }
  }
  return ctx || null;
}

async function findContextByPin(pin) {
  if (db) {
    try {
      const q = query(collection(db, 'exam_contexts'), where('pin', '==', pin));
      const snap = await getDocs(q);
      let found = null;
      snap.forEach(d => { if (!found) found = { id: d.id, ...d.data() }; });
      if (found) return found;
    } catch (e) { console.warn("PIN lookup failed via cloud, checking cache.", e); }
  }
  return state.contexts.find(c => c.pin === pin) || null;
}

async function ensurePracticeContext(quizId) {
  const quiz = state.quizzes.find(q => q.id === quizId) || await fetchQuizById(quizId);
  if (!quiz) return null;
  const contextId = 'PRC-' + quizId;
  let existing = await getContextById(contextId);
  if (existing && !existing.cancelled) return contextId;
  await createExamContext({
    id: contextId, quizId: quiz.id, title: quiz.title, class: quiz.metaClass, subject: quiz.subject,
    type: 'practice', durationMinutes: 30, windowStart: nowMs(), windowEnd: null
  });
  return contextId;
}

async function fetchQuizById(quizId) {
  let quiz = state.quizzes.find(q => q.id === quizId);
  if (quiz) return quiz;
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'quizzes', quizId));
      if (snap.exists()) { quiz = { id: snap.id, ...snap.data() }; state.quizzes.push(quiz); return quiz; }
    } catch (e) { console.warn("Quiz fetch failed", e); }
  }
  return null;
}

function getContextPhase(ctx) {
  if (!ctx) return 'unknown';
  if (ctx.cancelled) return 'cancelled';
  if (ctx.type === 'practice') return 'open';
  const now = nowMs();
  if (ctx.windowStart && now < ctx.windowStart) return 'upcoming';
  if (ctx.windowEnd && now > ctx.windowEnd) return 'closed';
  return 'open';
}

/* ============================================================
   PARTICIPANTS / ANSWERS / SUBMISSIONS
============================================================ */
function getOrCreateParticipantId(contextId) {
  const key = `qmp_pid_${contextId}`;
  let pid = localStorage.getItem(key);
  if (!pid) { pid = uid(); localStorage.setItem(key, pid); }
  return pid;
}

async function getParticipantDoc(contextId, participantId) {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'exam_contexts', contextId, 'participants', participantId));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
}

async function joinOrResumeParticipant(ctx, participantId, name, rollNo) {
  const existing = await getParticipantDoc(ctx.id, participantId);
  const now = nowMs();
  if (existing && existing.status === 'submitted') return existing;

  let deadlineAt;
  if (existing && existing.deadlineAt) {
    deadlineAt = existing.deadlineAt;
  } else {
    deadlineAt = now + (parseInt(ctx.durationMinutes) || 30) * 60000;
    if (ctx.windowEnd) deadlineAt = Math.min(deadlineAt, ctx.windowEnd);
  }

  const record = {
    participantId, name: name || (existing && existing.name) || 'Candidate',
    rollNo: rollNo || (existing && existing.rollNo) || '-',
    status: existing ? (existing.status === 'submitted' ? 'submitted' : 'answering') : 'joined',
    currentQuestionIndex: existing ? (existing.currentQuestionIndex || 0) : 0,
    answeredCount: existing ? (existing.answeredCount || 0) : 0,
    score: existing ? (existing.score || 0) : 0,
    joinedAt: existing ? existing.joinedAt : now,
    lastSeenAt: now,
    deadlineAt
  };
  if (db) { try { await setDoc(doc(db, 'exam_contexts', ctx.id, 'participants', participantId), record, { merge: true }); } catch (e) { console.warn("Join sync failed", e); } }
  return record;
}

async function heartbeatTick(contextId, participantId) {
  if (!db) return;
  try { await setDoc(doc(db, 'exam_contexts', contextId, 'participants', participantId), { lastSeenAt: nowMs() }, { merge: true }); } catch (e) {}
}

async function updateParticipantProgress(contextId, participantId, patch) {
  if (!db) return;
  try { await setDoc(doc(db, 'exam_contexts', contextId, 'participants', participantId), { ...patch, lastSeenAt: nowMs() }, { merge: true }); } catch (e) { console.warn("Progress sync failed", e); }
}

let saveAnswerTimer = null;
async function saveAnswerAutoSave(contextId, participantId, questionIndex, value) {
  if (!db) return;
  clearTimeout(saveAnswerTimer);
  saveAnswerTimer = setTimeout(async () => {
    try {
      await setDoc(doc(db, 'exam_contexts', contextId, 'answers', participantId), {
        participantId, responses: { [questionIndex]: value }, updatedAt: nowMs()
      }, { merge: true });
    } catch (e) { console.warn("Auto-save failed", e); }
  }, 250);
}

async function loadSavedAnswers(contextId, participantId) {
  if (!db) return {};
  try {
    const snap = await getDoc(doc(db, 'exam_contexts', contextId, 'answers', participantId));
    if (snap.exists()) return snap.data().responses || {};
  } catch (e) {}
  return {};
}

async function recordSubmission(contextId, submission) {
  state.submissions.push(submission);
  if (db) {
    try { await setDoc(doc(db, 'exam_contexts', contextId, 'submissions', submission.participantId), submission); }
    catch (e) { console.warn("Submission sync failed — saved locally only.", e); }
  }
  await updateParticipantProgress(contextId, submission.participantId, {
    status: submission.timeExpired ? 'expired' : 'submitted', score: submission.correct, currentQuestionIndex: submission.total - 1
  });
}

async function fetchSubmissions(contextId) {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'exam_contexts', contextId, 'submissions'));
    const list = []; snap.forEach(d => list.push(d.data())); return list;
  } catch (e) { console.warn("Fetch submissions failed", e); return []; }
}

function computeDenseRanking(rows) {
  const sorted = [...rows].sort((a, b) => (b.correct - a.correct) || (a.timeSeconds - b.timeSeconds));
  let rank = 0, lastScore = null;
  sorted.forEach(r => {
    if (r.correct !== lastScore) { rank++; lastScore = r.correct; }
    r.rank = rank;
  });
  return sorted;
}

/* ============================================================
   NAVIGATION
============================================================ */
function registerNavigationEvents() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => { e.preventDefault(); switchViewport(link.getAttribute('data-target')); };
  });
  document.getElementById('sidebarToggle').onclick = () => {
    document.getElementById('appSidebar').classList.toggle('hidden');
    document.querySelector('.main-content').classList.toggle('expanded');
  };
  document.getElementById('runnerNextBtn').onclick = () => { if (state.currentQuestionIndex < state.activeQuestions.length - 1) { state.currentQuestionIndex++; renderActiveQuestion(); } };
  document.getElementById('runnerPrevBtn').onclick = () => { if (state.currentQuestionIndex > 0) { state.currentQuestionIndex--; renderActiveQuestion(); } };
}

function switchViewport(targetId) {
  if (targetId !== 'examGatewaySection') {
    if (state.gateway.tickerId) { clearInterval(state.gateway.tickerId); state.gateway.tickerId = null; }
    if (state.gateway.monitorUnsub) { state.gateway.monitorUnsub(); state.gateway.monitorUnsub = null; }
  }
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(targetId).classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === targetId));
  const bc = document.getElementById('breadcrumbCurrent');
  if (bc) { const active = document.querySelector(`.nav-link[data-target="${targetId}"] span`); if (active) bc.textContent = active.textContent; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function displayToast(msg, type = "info") {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast-message`;
  t.style.borderLeftColor = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ============================================================
   CREATOR STUDIO (manual)
============================================================ */
function registerCreatorEvents() {
  document.getElementById('creatorAppendQuestionBtn').onclick = () => {
    const text = document.getElementById('qFormText').value.trim();
    const a = document.getElementById('qFormOptA').value.trim();
    const b = document.getElementById('qFormOptB').value.trim();
    if (!text || !a || !b) return displayToast("Question and at least Options A & B required.", "error");

    state.creatorQuestions.push({
      text: sanitize(text), a: sanitize(a), b: sanitize(b),
      c: sanitize(document.getElementById('qFormOptC').value.trim()),
      d: sanitize(document.getElementById('qFormOptD').value.trim()),
      answer: document.getElementById('qFormAnswer').value
    });

    document.getElementById('pendingQuestionsCount').textContent = state.creatorQuestions.length;
    document.querySelectorAll('#creatorQuestionForm input[type="text"]').forEach(i => i.value = '');
    displayToast("Question added to draft.", "success");
  };

  document.getElementById('creatorToWorkspaceBtn').onclick = async () => {
    const title = document.getElementById('creatorQuizTitle').value.trim() || "New Examination";
    if (state.creatorQuestions.length === 0) return displayToast("Cannot save an empty quiz. Add questions or import an Excel file first.", "error");

    const newQuiz = {
      id: `QZ-${Date.now()}`, title,
      metaClass: document.getElementById('creatorClass').value.trim(),
      subject: document.getElementById('creatorSubject').value.trim(),
      questions: [...state.creatorQuestions], createdAt: nowMs()
    };

    await saveQuizToCloud(newQuiz);
    state.creatorQuestions = [];
    document.getElementById('pendingQuestionsCount').textContent = '0';
    document.getElementById('creatorQuizTitle').value = '';
    resetExcelImportUI();

    displayToast("Quiz saved successfully to the Assessment Library!", "success");
    switchViewport('librarySection');
  };
}

/* ============================================================
   EXCEL IMPORT + PREVIEW
============================================================ */
function registerExcelEvents() {
  const fileInput = document.getElementById('excelFileInput');
  if (!fileInput) return;
  fileInput.onchange = handleExcelFileSelected;

  const sheetSelect = document.getElementById('excelSheetSelect');
  if (sheetSelect) sheetSelect.onchange = () => parseWorkbookSheet(sheetSelect.value);

  const confirmBtn = document.getElementById('btnConfirmExcelImport');
  if (confirmBtn) confirmBtn.onclick = confirmExcelImport;

  const templateBtn = document.getElementById('btnDownloadExcelTemplate');
  if (templateBtn) templateBtn.onclick = downloadExcelTemplate;
}

function handleExcelFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      state.excelWorkbook = workbook;
      const sheetSelectWrap = document.getElementById('excelSheetSelectWrap');
      const sheetSelect = document.getElementById('excelSheetSelect');
      if (workbook.SheetNames.length > 1 && sheetSelect) {
        sheetSelectWrap.classList.remove('hidden');
        sheetSelect.innerHTML = workbook.SheetNames.map(n => `<option value="${n}">${n}</option>`).join('');
      } else if (sheetSelectWrap) {
        sheetSelectWrap.classList.add('hidden');
      }
      parseWorkbookSheet(workbook.SheetNames[0]);
    } catch (err) {
      console.error(err);
      displayToast("Could not read the Excel/CSV file. Please check the format.", "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseWorkbookSheet(sheetName) {
  if (!state.excelWorkbook) return;
  const sheet = state.excelWorkbook.Sheets[sheetName];
  if (!sheet) return;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const colKeyFor = (row, aliases) => Object.keys(row).find(k => aliases.includes(k.trim().toLowerCase()));
  const parsed = [];
  let validCount = 0, errorCount = 0;

  rows.forEach((row, i) => {
    const qKey = colKeyFor(row, ['question', 'questions', 'q', 'question text']);
    const aKey = colKeyFor(row, ['a', 'option a', 'optiona']);
    const bKey = colKeyFor(row, ['b', 'option b', 'optionb']);
    const cKey = colKeyFor(row, ['c', 'option c', 'optionc']);
    const dKey = colKeyFor(row, ['d', 'option d', 'optiond']);
    const ansKey = colKeyFor(row, ['answer', 'correct', 'correct answer', 'ans']);

    const text = qKey ? String(row[qKey]).trim() : '';
    const a = aKey ? String(row[aKey]).trim() : '';
    const b = bKey ? String(row[bKey]).trim() : '';
    const c = cKey ? String(row[cKey]).trim() : '';
    const d = dKey ? String(row[dKey]).trim() : '';
    let answer = ansKey ? String(row[ansKey]).trim().toUpperCase() : '';
    if (answer.length > 1) {
      if (answer === a) answer = 'A'; else if (answer === b) answer = 'B';
      else if (answer === c) answer = 'C'; else if (answer === d) answer = 'D'; else answer = answer.charAt(0);
    }

    const errors = [];
    if (!text) errors.push('Missing question text');
    if (!a || !b) errors.push('Missing option A/B');
    if (!['A', 'B', 'C', 'D'].includes(answer)) errors.push('Invalid/missing answer');

    const valid = errors.length === 0;
    if (valid) validCount++; else errorCount++;

    parsed.push({ row: i + 2, text, a, b, c, d, answer, valid, errors });
  });

  state.excelParsedRows = parsed;
  renderExcelPreview(rows.length, validCount, errorCount);
}

function renderExcelPreview(total, validCount, errorCount) {
  const wrap = document.getElementById('excelPreviewWrap');
  const tbody = document.getElementById('excelPreviewTableBody');
  const summary = document.getElementById('excelImportSummary');
  if (!wrap || !tbody) return;

  wrap.classList.remove('hidden');
  summary.innerHTML = `Imported: <b>${total}</b> &nbsp;|&nbsp; Valid: <b style="color:var(--success)">${validCount}</b> &nbsp;|&nbsp; Errors: <b style="color:var(--danger)">${errorCount}</b>`;

  tbody.innerHTML = state.excelParsedRows.map(r => `
    <tr style="${r.valid ? '' : 'background:rgba(239,68,68,0.08);'}">
      <td>${r.row}</td>
      <td>${stripHtml(r.text) || '<i style="color:var(--danger)">missing</i>'}</td>
      <td>${stripHtml(r.a)}</td><td>${stripHtml(r.b)}</td><td>${stripHtml(r.c)}</td><td>${stripHtml(r.d)}</td>
      <td>${r.answer || '-'}</td>
      <td>${r.valid ? '<span style="color:var(--success);font-weight:700;">OK</span>' : `<span style="color:var(--danger);font-weight:700;">${r.errors.join(', ')}</span>`}</td>
    </tr>`).join('');

  document.getElementById('btnConfirmExcelImport').classList.toggle('hidden', validCount === 0);
}

function confirmExcelImport() {
  const validRows = state.excelParsedRows.filter(r => r.valid);
  if (!validRows.length) return displayToast("No valid questions to import.", "error");
  validRows.forEach(r => {
    state.creatorQuestions.push({ text: sanitize(r.text), a: sanitize(r.a), b: sanitize(r.b), c: sanitize(r.c), d: sanitize(r.d), answer: r.answer });
  });
  document.getElementById('pendingQuestionsCount').textContent = state.creatorQuestions.length;
  displayToast(`${validRows.length} question(s) added to draft. Click "Save Assessment to Library" to finish.`, "success");
  resetExcelImportUI(true);
}

function resetExcelImportUI(keepDraftCount) {
  const wrap = document.getElementById('excelPreviewWrap');
  if (wrap) wrap.classList.add('hidden');
  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) fileInput.value = '';
  state.excelParsedRows = []; state.excelWorkbook = null;
}

function downloadExcelTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Question', 'A', 'B', 'C', 'D', 'Answer'],
    ['What is the capital of Tamil Nadu?', 'Chennai', 'Madurai', 'Coimbatore', 'Trichy', 'A']
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'QuizMasterPro_Import_Template.xlsx');
}

/* ============================================================
   COMBINED EXAM BUILDER
============================================================ */
function registerGroupEvents() {
  const btn = document.getElementById('groupCommitBtn');
  if (btn) btn.onclick = commitCombinedExam;
}

function renderGroupInventory() {
  const box = document.getElementById('groupInventoryContainer');
  if (!box) return;
  if (!state.quizzes.length) { box.innerHTML = `<div class="empty-state-msg">No saved quizzes yet. Create one first.</div>`; return; }
  box.innerHTML = state.quizzes.map(q => `
    <label style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:8px; cursor:pointer;">
      <input type="checkbox" class="group-select-cb" value="${q.id}" ${state.groupSelectedIds.has(q.id) ? 'checked' : ''} style="width:18px;height:18px;" />
      <div><strong>${q.title}</strong><br/><span class="subtext" style="font-size:0.78rem;color:var(--text-light);">${(q.questions || []).length} Questions ${q.metaClass ? '· ' + q.metaClass : ''} ${q.subject ? '· ' + q.subject : ''}</span></div>
    </label>`).join('');
  box.querySelectorAll('.group-select-cb').forEach(cb => {
    cb.onchange = () => { if (cb.checked) state.groupSelectedIds.add(cb.value); else state.groupSelectedIds.delete(cb.value); };
  });
}

async function commitCombinedExam() {
  const ids = [...state.groupSelectedIds];
  if (ids.length < 2) return displayToast("Select at least 2 quizzes to combine.", "error");
  const title = document.getElementById('groupNameInput').value.trim() || "Combined Examination";
  const duration = document.getElementById('groupDurationInput').value || 60;
  const metaClass = document.getElementById('groupClassInput').value.trim();
  const subject = document.getElementById('groupSubjectInput').value.trim();

  let combinedQuestions = [];
  ids.forEach(id => {
    const q = state.quizzes.find(qz => qz.id === id);
    if (q && Array.isArray(q.questions)) combinedQuestions = combinedQuestions.concat(q.questions);
  });
  if (!combinedQuestions.length) return displayToast("Selected quizzes contain no questions.", "error");

  const newQuiz = {
    id: `QZ-${Date.now()}`, title, metaClass, subject, questions: combinedQuestions,
    isGroup: true, sourceRefs: ids, durationMinutes: parseInt(duration) || 60, createdAt: nowMs()
  };
  await saveQuizToCloud(newQuiz);
  state.groupSelectedIds.clear();
  document.getElementById('groupNameInput').value = ''; document.getElementById('groupClassInput').value = ''; document.getElementById('groupSubjectInput').value = '';
  displayToast(`Combined exam saved with ${combinedQuestions.length} questions.`, "success");
  switchViewport('librarySection');
}

/* ============================================================
   ASSESSMENT LIBRARY
============================================================ */
function registerLibraryEvents() {
  const refreshBtn = document.getElementById('btnRefreshLibrary');
  if (refreshBtn) refreshBtn.onclick = async () => { await loadQuizzesFromCloud(); displayToast("Library refreshed.", "success"); };
}

function renderLibrary() {
  const grid = document.getElementById('libraryGridContainer');
  if (!grid) return;
  if (!state.quizzes.length) {
    grid.innerHTML = `<div class="empty-state-msg">No saved assessments yet. Create or import a quiz to get started.</div>`;
    return;
  }
  grid.innerHTML = state.quizzes.map(q => `
    <div class="glass-card library-item-card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div>
          <h3 style="margin-bottom:4px;">${q.title} ${q.isGroup ? '<span class="status-badge status-submitted">COMBINED</span>' : ''}</h3>
          <p class="subtext" style="color:var(--text-light); font-size:0.85rem;">${(q.questions || []).length} Questions ${q.metaClass ? '· ' + q.metaClass : ''} ${q.subject ? '· ' + q.subject : ''}</p>
        </div>
      </div>
      <div class="library-actions-row" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:14px;">
        <button class="btn-success btn-sm" onclick="window.appEngineAPI.playFromLibrary('${q.id}')"><i class="ri-play-fill"></i> Play Exam</button>
        <button class="btn-secondary btn-sm" onclick="window.appEngineAPI.shareFromLibrary('${q.id}')"><i class="ri-share-line"></i> Share Link</button>
        <button class="btn-secondary btn-sm" onclick="window.appEngineAPI.copyLibraryLink('${q.id}')"><i class="ri-file-copy-line"></i> Copy Link</button>
        <button class="btn-secondary btn-sm" onclick="window.appEngineAPI.showLibraryQr('${q.id}')"><i class="ri-qr-code-line"></i> QR</button>
        <button class="btn-secondary btn-sm" onclick="window.appEngineAPI.downloadQuestionPaper('${q.id}')"><i class="ri-file-text-line"></i> Question Paper PDF</button>
        <button class="btn-secondary btn-sm" onclick="window.appEngineAPI.downloadAnswerKey('${q.id}')"><i class="ri-key-2-line"></i> Answer Key PDF</button>
        <button class="btn-secondary btn-sm" onclick="window.appEngineAPI.viewLibraryResults('${q.id}')"><i class="ri-bar-chart-box-line"></i> Results</button>
        <button class="btn-icon btn-danger btn-sm" onclick="window.appEngineAPI.deleteQuiz('${q.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>
      <div class="qr-inline-box hidden" id="qrBox-${q.id}" style="margin-top:12px; width:130px; height:130px; background:white; padding:6px; border-radius:8px;"></div>
    </div>`).join('');
}

/* ============================================================
   GATEWAY (Scheduled Exam page + Library Share/Play entry point)
============================================================ */
function registerGatewayEvents() {
  document.getElementById('gwCopyLinkBtn').onclick = () => {
    navigator.clipboard.writeText(getShareUrl(state.gateway.contextId));
    displayToast("Link copied to clipboard!", "success");
  };
  document.getElementById('gwCancelBtn').onclick = async () => {
    if (!confirm("Cancel this scheduled exam?")) return;
    await createExamContext({ ...state.contexts.find(c => c.id === state.gateway.contextId), cancelled: true });
    displayToast("Exam cancelled.", "info");
    switchViewport('homeSection');
  };
  document.getElementById('gwStartBtn').onclick = handleGatewayStart;
}

async function openGateway(contextId, mode, opts = {}) {
  const ctx = await getContextById(contextId);
  if (!ctx) { displayToast("This exam link is invalid or no longer available.", "error"); return; }
  state.gateway.contextId = contextId;
  state.gateway.mode = mode;

  switchViewport('examGatewaySection');
  document.getElementById('gwTitle').textContent = ctx.title;
  document.getElementById('gwMeta').textContent = `${ctx.class ? ctx.class + ' · ' : ''}${ctx.subject ? ctx.subject + ' · ' : ''}${ctx.type === 'scheduled' ? fmtDateLong(ctx.windowStart) + ' · ' + fmtTime12(ctx.windowStart) + ' · Duration: ' + fmtDurationLabel(ctx.durationMinutes) : 'Practice Assessment · Duration: ' + fmtDurationLabel(ctx.durationMinutes)}`;

  const isTeacher = mode === 'teacher' || (state.currentUser.role === 'teacher' && !document.body.classList.contains('student-mode'));
  document.getElementById('gwShareBox').classList.toggle('hidden', !isTeacher);
  document.getElementById('gwCancelBtn').classList.toggle('hidden', !(isTeacher && ctx.type === 'scheduled'));

  if (isTeacher) {
    document.getElementById('gwPinCode').textContent = `PIN: ${ctx.pin}`;
    document.getElementById('gwLinkText').innerHTML = `Link: <a href="${getShareUrl(contextId)}" target="_blank">${getShareUrl(contextId)}</a>`;
    const qrBox = document.getElementById('gwQrBox');
    qrBox.innerHTML = '';
    try { new QRCode(qrBox, { text: getShareUrl(contextId), width: 120, height: 120 }); } catch (e) {}
    attachTeacherMonitor(contextId);
  }

  if (opts.prefillName) document.getElementById('gwNameInput').value = opts.prefillName;
  if (opts.prefillRoll) document.getElementById('gwRollInput').value = opts.prefillRoll;

  if (state.gateway.tickerId) clearInterval(state.gateway.tickerId);
  const tick = () => renderGatewayPhase(contextId);
  tick();
  state.gateway.tickerId = setInterval(tick, 1000);

  if (opts.autoJoin && mode === 'student') {
    setTimeout(() => { if (getContextPhase(ctx) === 'open') handleGatewayStart(); }, 300);
  }
}

async function renderGatewayPhase(contextId) {
  const ctx = await getContextById(contextId);
  if (!ctx) return;
  const phase = getContextPhase(ctx);
  const badge = document.getElementById('gwPhaseBadge');
  const countdownBox = document.getElementById('gwCountdownBox');
  const joinForm = document.getElementById('gwJoinForm');

  countdownBox.classList.add('hidden'); joinForm.classList.add('hidden');
  badge.className = 'gw-phase-badge';

  if (phase === 'cancelled') { badge.textContent = 'EXAM CANCELLED'; badge.classList.add('phase-closed'); }
  else if (phase === 'upcoming') {
    badge.textContent = 'EXAM HAS NOT STARTED YET'; badge.classList.add('phase-upcoming');
    countdownBox.classList.remove('hidden');
    document.getElementById('gwCountdown').textContent = fmtCountdownParts(ctx.windowStart - nowMs());
  } else if (phase === 'open') {
    badge.textContent = '🔴 EXAM IS LIVE — JOIN NOW'; badge.classList.add('phase-live');
    if (state.gateway.mode === 'student') {
      const pid = getOrCreateParticipantId(contextId);
      const existing = await getParticipantDoc(contextId, pid);
      if (existing && existing.status === 'submitted') {
        badge.textContent = 'YOU HAVE ALREADY SUBMITTED THIS EXAM';
      } else {
        joinForm.classList.remove('hidden');
      }
    }
  } else if (phase === 'closed') { badge.textContent = 'EXAM CLOSED'; badge.classList.add('phase-closed'); }
}

async function handleGatewayStart() {
  const contextId = state.gateway.contextId;
  const ctx = await getContextById(contextId);
  if (!ctx || getContextPhase(ctx) !== 'open') return displayToast("This exam is not currently open.", "error");

  const name = document.getElementById('gwNameInput').value.trim();
  if (!name) return displayToast("Please enter your full name.", "error");
  const rollNo = document.getElementById('gwRollInput').value.trim();

  const quiz = await fetchQuizById(ctx.quizId);
  if (!quiz || !quiz.questions || !quiz.questions.length) return displayToast("Exam content is unavailable. Please contact your teacher.", "error");

  const participantId = getOrCreateParticipantId(contextId);
  const participant = await joinOrResumeParticipant(ctx, participantId, name, rollNo);

  if (participant.status === 'submitted') return displayToast("You have already submitted this exam.", "info");

  state.studentMeta = { name: participant.name, rollNo: participant.rollNo, contextId, participantId, deadlineAt: participant.deadlineAt, startedAt: participant.joinedAt };

  const savedAnswers = await loadSavedAnswers(contextId, participantId);
  state.userAnswers = {};
  Object.keys(savedAnswers).forEach(k => state.userAnswers[k] = savedAnswers[k]);

  if (state.gateway.tickerId) clearInterval(state.gateway.tickerId);
  const resumeIndex = Math.min(participant.currentQuestionIndex || 0, (quiz.questions.length - 1));
  launchQuizRunner(quiz, ctx, resumeIndex);
}

/* ============================================================
   TEACHER MONITOR (used inside Gateway for scheduled/practice exams)
============================================================ */
function attachTeacherMonitor(contextId) {
  if (state.gateway.monitorUnsub) { state.gateway.monitorUnsub(); state.gateway.monitorUnsub = null; }
  if (!db) return;
  const tbody = document.getElementById('gwMonitorTableBody');
  if (!tbody) return;
  state.gateway.monitorUnsub = onSnapshot(collection(db, 'exam_contexts', contextId, 'participants'), (snap) => {
    const rows = []; snap.forEach(d => rows.push(d.data()));
    renderMonitorTable(rows, 'gwMonitorTableBody', 'gwStatJoined', 'gwStatAnswering', 'gwStatSubmitted');
  });
}

function computeLiveStatus(p) {
  if (p.status === 'submitted') return 'SUBMITTED';
  if (p.status === 'expired') return 'TIME EXPIRED';
  const staleMs = nowMs() - (p.lastSeenAt || p.joinedAt || 0);
  if (staleMs > 20000) return 'DISCONNECTED';
  if (p.status === 'answering') return 'ANSWERING';
  if (p.status === 'joined') return 'WAITING';
  return (p.status || 'WAITING').toUpperCase();
}
function statusBadgeClass(label) {
  const map = { 'WAITING': 'status-joined', 'JOINED': 'status-joined', 'ANSWERING': 'status-answering', 'SUBMITTED': 'status-submitted', 'TIME EXPIRED': 'status-danger', 'DISCONNECTED': 'status-danger' };
  return map[label] || 'status-joined';
}

function renderMonitorTable(rows, tbodyId, joinedStatId, answeringStatId, submittedStatId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const joinedEl = document.getElementById(joinedStatId), answeringEl = document.getElementById(answeringStatId), submittedEl = document.getElementById(submittedStatId);
  if (joinedEl) joinedEl.textContent = rows.length;
  if (submittedEl) submittedEl.textContent = rows.filter(p => p.status === 'submitted').length;
  if (answeringEl) answeringEl.textContent = rows.filter(p => computeLiveStatus(p) === 'ANSWERING').length;

  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8" class="text-center">No students joined yet. Share the PIN or link.</td></tr>`; return; }

  tbody.innerHTML = rows.map(p => {
    const label = computeLiveStatus(p);
    const secsAgo = Math.max(0, Math.floor((nowMs() - (p.lastSeenAt || 0)) / 1000));
    return `<tr>
      <td><span class="status-badge ${statusBadgeClass(label)}">${label}</span></td>
      <td><strong>${p.name || '-'}</strong></td>
      <td>${p.rollNo || '-'}</td>
      <td>Q ${(p.currentQuestionIndex || 0) + 1}</td>
      <td>${p.answeredCount || 0}</td>
      <td><b>${p.score || 0}</b></td>
      <td>${secsAgo}s ago</td>
    </tr>`;
  }).join('');
}

/* ============================================================
   LIVE EXAM ROOM (Instant "Start Now" flow) — keeps original UI structure
============================================================ */
function registerLiveEvents() {
  document.getElementById('btnModeStartNow').onclick = () => {
    populateSelects();
    document.getElementById('liveSetupPanel').classList.remove('hidden');
  };
  document.getElementById('btnModeSchedule').onclick = () => window.appEngineAPI.openScheduler();
  document.getElementById('btnConfirmStartNow').onclick = startLiveExamNow;
  document.getElementById('btnLiveConclude').onclick = concludeLiveExam;
  const copyPinBtn = document.getElementById('btnCopyLivePin');
  if (copyPinBtn) copyPinBtn.onclick = () => {
    const pin = document.getElementById('liveHostPinCode').textContent.trim();
    navigator.clipboard.writeText(pin);
    displayToast("PIN copied!", "success");
  };
}

async function startLiveExamNow() {
  const qId = document.getElementById('liveSetupQuizSelect').value;
  const quiz = state.quizzes.find(q => q.id === qId);
  if (!quiz || !quiz.questions || quiz.questions.length === 0) return displayToast("Select a valid exam with questions.", "error");

  const duration = parseInt(document.getElementById('liveSetupDuration').value) || 30;
  const contextId = `SCH-${Date.now()}`;
  const now = nowMs();
  const ctx = await createExamContext({
    id: contextId, quizId: quiz.id, title: quiz.title, class: quiz.metaClass, subject: quiz.subject,
    type: 'scheduled', durationMinutes: duration, windowStart: now, windowEnd: now + duration * 60000
  });

  state.liveRoom = { active: true, contextId, pin: ctx.pin, title: quiz.title, durationMinutes: duration, participants: [], sourceQuizId: quiz.id };

  document.getElementById('liveSetupPanel').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.remove('hidden');
  document.getElementById('liveHostPinCode').textContent = ctx.pin;
  document.getElementById('liveHostExamTitle').textContent = quiz.title;
  document.getElementById('globalLiveBadge').classList.remove('hidden');

  const joinUrl = getShareUrl(contextId);
  document.getElementById('liveHostShareUrl').innerHTML = `Link: <a href="${joinUrl}" target="_blank" style="color:var(--primary);text-decoration:none;font-weight:bold;">${joinUrl}</a> <i class="ri-clipboard-line" style="cursor:pointer; margin-left:8px;" title="Copy Link" onclick="navigator.clipboard.writeText('${joinUrl}'); window.appEngineAPI.displayToast('Link Copied!', 'success')"></i>`;

  const qrBox = document.getElementById('liveRoomQrBox');
  if (qrBox) { qrBox.innerHTML = ''; try { new QRCode(qrBox, { text: joinUrl, width: 100, height: 100 }); } catch (e) {} }

  switchViewport('liveQuizSection');
  displayToast("Live Exam Room Opened! Students can join instantly.", "success");

  if (state.liveRoom.unsub) state.liveRoom.unsub();
  if (db) {
    state.liveRoom.unsub = onSnapshot(collection(db, 'exam_contexts', contextId, 'participants'), (snap) => {
      const rows = []; snap.forEach(d => rows.push(d.data()));
      state.liveRoom.participants = rows;
      renderMonitorTable(rows, 'liveParticipantsTableBody', 'liveStatJoined', 'liveStatAnswering', 'liveStatCompleted');
    });
  }

  if (state.liveRoom.tickerId) clearInterval(state.liveRoom.tickerId);
  state.liveRoom.tickerId = setInterval(() => {
    const remaining = ctx.windowEnd - nowMs();
    document.getElementById('liveHostTimer').textContent = remaining > 0 ? fmtClockFromSeconds(remaining / 1000) : '00:00:00';
  }, 1000);
}

function concludeLiveExam() {
  if (state.liveRoom.tickerId) clearInterval(state.liveRoom.tickerId);
  if (state.liveRoom.unsub) state.liveRoom.unsub();
  if (state.liveRoom.contextId) createExamContext({ ...state.contexts.find(c => c.id === state.liveRoom.contextId), windowEnd: nowMs() });
  state.liveRoom.active = false;
  document.getElementById('globalLiveBadge').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.add('hidden');
  switchViewport('homeSection');
  displayToast("Live Exam Concluded.", "info");
}

/* ============================================================
   SCHEDULE EXAM MODAL (AM/PM friendly form -> epoch timestamps)
============================================================ */
function populateSelects() {
  const opts = '<option value="">-- Select Exam / Assessment --</option>' + state.quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('');
  document.getElementById('liveSetupQuizSelect').innerHTML = opts;
  document.getElementById('schedQuizSelect').innerHTML = opts;
}
function populateMarksheetAndPdfSelects() {
  const opts = '<option value="">-- Select Exam --</option>' + state.quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('');
  const m = document.getElementById('marksheetExamSelect'); if (m) m.innerHTML = opts;
  const p = document.getElementById('pdfExamSelect'); if (p) p.innerHTML = opts;
}

window.appEngineAPI = {
  switchContext: switchViewport, displayToast,
  startTutorial: () => { displayToast("Guided tour: use the sidebar to explore Create Quiz, Schedule Exam and Assessment Library.", "info"); switchViewport('creatorSection'); },
  toggleCreatorTab: (tab) => {
    document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab !== 'manual');
    document.getElementById('creatorExcelForm').classList.toggle('hidden', tab !== 'excel');
    document.getElementById('tabManual').classList.toggle('active', tab === 'manual');
    document.getElementById('tabExcel').classList.toggle('active', tab === 'excel');
  },
  selectAnswer: (opt) => {
    state.userAnswers[state.currentQuestionIndex] = opt;
    if (state.studentMeta.contextId) saveAnswerAutoSave(state.studentMeta.contextId, state.studentMeta.participantId, state.currentQuestionIndex, opt);
    renderActiveQuestion();
  },
  openScheduler: () => { populateSelects(); document.getElementById('schedDate').valueAsDate = new Date(); document.getElementById('scheduleModal').classList.remove('hidden'); },
  closeScheduler: () => document.getElementById('scheduleModal').classList.add('hidden'),

  saveSchedule: async () => {
    const sel = document.getElementById('schedQuizSelect');
    if (!sel.value) return displayToast("Select an exam to schedule.", "error");

    const quiz = state.quizzes.find(q => q.id === sel.value);
    const date = document.getElementById('schedDate').value;
    let h = parseInt(document.getElementById('schedHour').value);
    let m = parseInt(document.getElementById('schedMinute').value) || 0;
    const ampm = document.getElementById('schedAmPm').value;
    const duration = parseInt(document.getElementById('schedDuration').value) || 45;
    const metaClass = document.getElementById('schedClass').value.trim();

    if (!date || !h) return displayToast("Date and Time are required.", "error");

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const startDate = new Date(date + 'T00:00:00');
    startDate.setHours(h, m, 0, 0);
    const windowStart = startDate.getTime();
    const windowEnd = windowStart + duration * 60000;

    if (isNaN(windowStart)) return displayToast("Invalid date/time selected.", "error");

    const contextId = `SCH-${Date.now()}`;
    await createExamContext({
      id: contextId, quizId: quiz.id, title: quiz.title, class: metaClass, subject: quiz.subject,
      type: 'scheduled', durationMinutes: duration, windowStart, windowEnd
    });

    window.appEngineAPI.closeScheduler();
    renderDashboardData();
    displayToast("Exam Scheduled! Opening the Scheduled Exam page…", "success");
    openGateway(contextId, 'teacher');
  },

  cancelSchedule: async (contextId) => {
    if (!confirm("Cancel this scheduled exam?")) return;
    const ctx = state.contexts.find(c => c.id === contextId);
    await createExamContext({ ...ctx, cancelled: true });
    renderDashboardData();
    displayToast("Scheduled exam cancelled.", "info");
  },
  openManageSchedule: (contextId) => openGateway(contextId, 'teacher'),
  shareSchedule: (contextId) => { navigator.clipboard.writeText(getShareUrl(contextId)); displayToast("Share link copied!", "success"); },

  // --- Assessment Library actions ---
  playFromLibrary: async (quizId) => {
    const contextId = await ensurePracticeContext(quizId);
    if (!contextId) return displayToast("Could not open this assessment.", "error");
    openGateway(contextId, state.currentUser.role === 'teacher' ? 'student' : 'student');
  },
  shareFromLibrary: async (quizId) => {
    const contextId = await ensurePracticeContext(quizId);
    if (!contextId) return;
    if (navigator.share) {
      navigator.share({ title: 'Quiz Master Pro Exam', url: getShareUrl(contextId) }).catch(() => {});
    } else {
      navigator.clipboard.writeText(getShareUrl(contextId));
      displayToast("Sharing not supported on this browser — link copied instead!", "info");
    }
  },
  copyLibraryLink: async (quizId) => {
    const contextId = await ensurePracticeContext(quizId);
    if (!contextId) return;
    navigator.clipboard.writeText(getShareUrl(contextId));
    displayToast("Link copied to clipboard!", "success");
  },
  showLibraryQr: async (quizId) => {
    const contextId = await ensurePracticeContext(quizId);
    if (!contextId) return;
    const box = document.getElementById(`qrBox-${quizId}`);
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) { box.innerHTML = ''; try { new QRCode(box, { text: getShareUrl(contextId), width: 118, height: 118 }); } catch (e) {} }
  },
  viewLibraryResults: (quizId) => {
    switchViewport('marksheetSection');
    const sel = document.getElementById('marksheetExamSelect');
    sel.value = quizId;
    loadMarksheetForExam(quizId);
  },
  deleteQuiz: async (quizId) => {
    if (!confirm("Delete this assessment permanently?")) return;
    await deleteQuizEverywhere(quizId);
    displayToast("Assessment deleted.", "info");
  },

  downloadQuestionPaper: async (quizId) => {
    const quiz = await fetchQuizById(quizId);
    if (!quiz) return displayToast("Assessment not found.", "error");
    generateQuestionPaperPdf(quiz);
  },
  downloadAnswerKey: async (quizId) => {
    const quiz = await fetchQuizById(quizId);
    if (!quiz) return displayToast("Assessment not found.", "error");
    generateAnswerKeyPdf(quiz);
  },

  // --- Instant Student PDF Logic (post-submission) ---
  downloadStudentMarksheet: async () => {
    if (!window.jspdf) return displayToast("PDF engine initializing…", "error");
    const sub = state.submissions[state.submissions.length - 1];
    if (!sub) return displayToast("Result data missing.", "error");
    generateIndividualMarksheetPdf(sub, state.studentMeta, state.activeQuiz ? state.activeQuiz.title : 'Examination');
  },
  downloadStudentResponse: async () => {
    if (!window.jspdf) return displayToast("PDF engine initializing…", "error");
    generateResponseSheetPdf();
  },
};

/* ============================================================
   DASHBOARD RENDERING
============================================================ */
function renderDashboardData() {
  document.getElementById('statTotalQuizzes').textContent = state.quizzes.length;
  const totalQ = state.quizzes.reduce((sum, q) => sum + ((q.questions || []).length), 0);
  const statQEl = document.getElementById('statTotalQuestions'); if (statQEl) statQEl.textContent = totalQ;
  const scheduled = state.contexts.filter(c => c.type === 'scheduled' && !c.cancelled);
  document.getElementById('statTotalScheduled').textContent = scheduled.length;
  const statSubEl = document.getElementById('statTotalUsers'); if (statSubEl) statSubEl.textContent = state.submissions.length;

  const calBox = document.getElementById('dashboardCalendarList');
  if (!scheduled.length) {
    calBox.innerHTML = `<div class="empty-state-msg"><p>You have no scheduled examinations.</p><button class="btn-sm btn-primary mt-10" onclick="window.appEngineAPI.openScheduler()">Schedule Exam</button></div>`;
  } else {
    calBox.innerHTML = scheduled.sort((a, b) => a.windowStart - b.windowStart).map(ctx => {
      const phase = getContextPhase(ctx);
      const phaseLabel = phase === 'upcoming' ? `STARTS IN: <b data-countdown="${ctx.windowStart}">${fmtCountdownParts(ctx.windowStart - nowMs())}</b>`
        : phase === 'open' ? `🔴 LIVE NOW` : `✓ COMPLETED`;
      return `
      <div class="agenda-item">
        <div class="agenda-date">${new Date(ctx.windowStart).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</div>
        <div class="agenda-body" style="flex:1;">
            <strong style="display:block; margin-bottom:4px;">${ctx.title}</strong>
            <p style="font-size:0.8rem; color:var(--text-light); margin:0;">${fmtTime12(ctx.windowStart)} · ${fmtDurationLabel(ctx.durationMinutes)}</p>
            <div style="margin-top:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="background:var(--primary-light); color:var(--primary-dark); padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.85rem;">PIN: ${ctx.pin}</span>
                <span style="font-size:0.8rem; font-weight:700;">${phaseLabel}</span>
            </div>
        </div>
        <button class="btn-sm btn-secondary" onclick="window.appEngineAPI.openManageSchedule('${ctx.id}')"><i class="ri-eye-line"></i> Manage</button>
        <button class="btn-sm btn-icon" onclick="window.appEngineAPI.shareSchedule('${ctx.id}')" title="Copy Link"><i class="ri-file-copy-line"></i></button>
        <button class="btn-sm btn-icon btn-danger" onclick="window.appEngineAPI.cancelSchedule('${ctx.id}')" title="Cancel"><i class="ri-delete-bin-line"></i></button>
      </div>`;
    }).join('');
  }
}

setInterval(() => {
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const target = parseInt(el.getAttribute('data-countdown'));
    el.textContent = fmtCountdownParts(target - nowMs());
  });
}, 1000);

/* ============================================================
   CONSOLIDATED MARKSHEET
============================================================ */
function registerMarksheetEvents() {
  const loadBtn = document.getElementById('btnLoadMarksheet');
  if (loadBtn) loadBtn.onclick = () => {
    const id = document.getElementById('marksheetExamSelect').value;
    if (!id) return displayToast("Select an exam first.", "error");
    loadMarksheetForExam(id);
  };
  const exportBtn = document.getElementById('btnExportMarksheetPdf');
  if (exportBtn) exportBtn.onclick = () => {
    if (!state.marksheetRows.length) return displayToast("Load results before exporting.", "error");
    generateConsolidatedMarksheetPdf(state.marksheetExamTitle, state.marksheetRows);
  };
}

async function loadMarksheetForExam(quizId) {
  const quiz = state.quizzes.find(q => q.id === quizId);
  if (!quiz) return;
  state.marksheetExamTitle = quiz.title;

  const contexts = state.contexts.filter(c => c.quizId === quizId);
  let allSubs = [];
  for (const ctx of contexts) {
    const subs = await fetchSubmissions(ctx.id);
    allSubs = allSubs.concat(subs);
  }
  const rows = allSubs.map(s => ({ ...s, timeSeconds: s.timeSeconds || 0 }));
  const ranked = computeDenseRanking(rows);
  state.marksheetRows = ranked;
  renderMarksheetTable(ranked);
}

function renderMarksheetTable(rows) {
  const tbody = document.getElementById('marksheetTableBody');
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="10" class="text-center">No submissions yet for this exam.</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><b>${r.rank}</b></td>
      <td>${r.name}</td>
      <td>${r.rollNo || '-'}</td>
      <td>${r.correct}</td>
      <td>${r.wrong}</td>
      <td>${r.unanswered}</td>
      <td><b>${r.correct}/${r.total}</b></td>
      <td>${r.percentage}%</td>
      <td>${fmtClockFromSeconds(r.timeSeconds)}</td>
      <td>${r.percentage >= 40 ? '<span style="color:var(--success);font-weight:700;">PASS</span>' : '<span style="color:var(--danger);font-weight:700;">FAIL</span>'}</td>
    </tr>`).join('');
}

/* ============================================================
   PDF TOOLS SECTION ("TN A4 Exam Papers")
============================================================ */
function registerPdfToolEvents() {
  const qBtn = document.getElementById('btnGenQuestionPaper');
  if (qBtn) qBtn.onclick = async () => {
    const id = document.getElementById('pdfExamSelect').value;
    if (!id) return displayToast("Select an exam first.", "error");
    const quiz = await fetchQuizById(id);
    generateQuestionPaperPdf(quiz);
  };
  const aBtn = document.getElementById('btnGenAnswerKey');
  if (aBtn) aBtn.onclick = async () => {
    const id = document.getElementById('pdfExamSelect').value;
    if (!id) return displayToast("Select an exam first.", "error");
    const quiz = await fetchQuizById(id);
    generateAnswerKeyPdf(quiz);
  };
}

/* ============================================================
   PDF GENERATION (robust direct-draw jsPDF — no offscreen html())
============================================================ */
function newA4Doc() {
  if (!window.jspdf) { displayToast("PDF engine still loading — please try again in a moment.", "error"); return null; }
  const { jsPDF } = window.jspdf;
  return new jsPDF('p', 'mm', 'a4');
}
function pdfHeader(docPdf, lines) {
  let y = 18;
  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16);
  docPdf.text("SCHOOL EXAMINATION", 105, y, { align: "center" }); y += 8;
  docPdf.setFontSize(13);
  docPdf.text(lines.title, 105, y, { align: "center" }); y += 8;
  docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(10);
  docPdf.text(lines.meta, 105, y, { align: "center" }); y += 6;
  docPdf.setLineWidth(0.5); docPdf.line(15, y, 195, y); y += 8;
  return y;
}

function generateQuestionPaperPdf(quiz) {
  if (!quiz || !quiz.questions || !quiz.questions.length) return displayToast("This exam has no questions to print.", "error");
  const docPdf = newA4Doc(); if (!docPdf) return;
  let y = pdfHeader(docPdf, {
    title: quiz.title,
    meta: `Class: ${quiz.metaClass || '-'}   Subject: ${quiz.subject || '-'}   Date: ${fmtDateLong(nowMs())}   Duration: ${fmtDurationLabel(quiz.durationMinutes || 60)}   Total Questions: ${quiz.questions.length}   Max Marks: ${quiz.questions.length}`
  });

  docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(11);
  quiz.questions.forEach((q, i) => {
    const qText = `${i + 1}. ${stripHtml(q.text)}`;
    const qLines = docPdf.splitTextToSize(qText, 175);
    if (y + qLines.length * 6 + 24 > 285) { docPdf.addPage(); y = 18; }
    docPdf.setFont("helvetica", "bold");
    docPdf.text(qLines, 18, y); y += qLines.length * 6 + 2;

    docPdf.setFont("helvetica", "normal");
    ['a', 'b', 'c', 'd'].forEach((k, idx) => {
      if (!q[k]) return;
      const optText = `(${String.fromCharCode(65 + idx)}) ${stripHtml(q[k])}`;
      const optLines = docPdf.splitTextToSize(optText, 165);
      if (y + optLines.length * 5.5 > 285) { docPdf.addPage(); y = 18; }
      docPdf.text(optLines, 24, y); y += optLines.length * 5.5;
    });
    y += 4;
  });

  docPdf.save(`${quiz.title.replace(/\s+/g, '_')}_Question_Paper.pdf`);
  displayToast("Question Paper PDF downloaded.", "success");
}

function generateAnswerKeyPdf(quiz) {
  if (!quiz || !quiz.questions || !quiz.questions.length) return displayToast("This exam has no questions.", "error");
  const docPdf = newA4Doc(); if (!docPdf) return;
  let y = pdfHeader(docPdf, { title: quiz.title + " — Answer Key", meta: `Class: ${quiz.metaClass || '-'}   Subject: ${quiz.subject || '-'}   Total Questions: ${quiz.questions.length}` });

  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(11);
  docPdf.text("Q. No.", 20, y); docPdf.text("Correct Answer", 80, y); y += 6;
  docPdf.setLineWidth(0.2); docPdf.line(15, y, 195, y); y += 6;

  docPdf.setFont("helvetica", "normal");
  quiz.questions.forEach((q, i) => {
    if (y > 280) { docPdf.addPage(); y = 18; }
    docPdf.text(String(i + 1), 20, y);
    docPdf.text(q.answer || 'A', 80, y);
    y += 8;
  });

  docPdf.save(`${quiz.title.replace(/\s+/g, '_')}_Answer_Key.pdf`);
  displayToast("Answer Key PDF downloaded.", "success");
}

function generateConsolidatedMarksheetPdf(examTitle, rows) {
  const docPdf = newA4Doc(); if (!docPdf) return;
  let y = pdfHeader(docPdf, { title: examTitle + " — Consolidated Marksheet", meta: `Total Participants: ${rows.length}   Generated: ${fmtDateLong(nowMs())}` });

  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
  const headers = ['Rank', 'Student', 'Roll No', 'Correct', 'Wrong', 'Unans.', 'Marks', '%', 'Time', 'Status'];
  const colX = [16, 30, 75, 95, 112, 129, 146, 164, 178, 192];
  headers.forEach((h, i) => docPdf.text(h, colX[i], y));
  y += 5; docPdf.setLineWidth(0.2); docPdf.line(15, y, 195, y); y += 5;

  docPdf.setFont("helvetica", "normal");
  rows.forEach(r => {
    if (y > 280) {
      docPdf.addPage(); y = 18;
      docPdf.setFont("helvetica", "bold");
      headers.forEach((h, i) => docPdf.text(h, colX[i], y));
      y += 5; docPdf.line(15, y, 195, y); y += 5;
      docPdf.setFont("helvetica", "normal");
    }
    docPdf.text(String(r.rank), colX[0], y);
    docPdf.text(String(r.name).slice(0, 22), colX[1], y);
    docPdf.text(String(r.rollNo || '-'), colX[2], y);
    docPdf.text(String(r.correct), colX[3], y);
    docPdf.text(String(r.wrong), colX[4], y);
    docPdf.text(String(r.unanswered), colX[5], y);
    docPdf.text(`${r.correct}/${r.total}`, colX[6], y);
    docPdf.text(`${r.percentage}%`, colX[7], y);
    docPdf.text(fmtClockFromSeconds(r.timeSeconds), colX[8], y);
    docPdf.text(r.percentage >= 40 ? 'PASS' : 'FAIL', colX[9], y);
    y += 7;
  });

  docPdf.save(`${examTitle.replace(/\s+/g, '_')}_Consolidated_Marksheet.pdf`);
  displayToast("Consolidated Marksheet PDF downloaded.", "success");
}

function generateIndividualMarksheetPdf(sub, meta, examTitle) {
  const docPdf = newA4Doc(); if (!docPdf) return;
  let y = pdfHeader(docPdf, { title: "INDIVIDUAL MARKSHEET", meta: examTitle });

  docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(12);
  docPdf.text(`Candidate Name: ${meta.name}`, 20, y); y += 9;
  docPdf.text(`Roll Number: ${meta.rollNo || '-'}`, 20, y); y += 9;
  docPdf.text(`Exam Title: ${examTitle}`, 20, y); y += 9;
  docPdf.text(`Exam Date: ${fmtDateLong(nowMs())}`, 20, y); y += 12;

  docPdf.setLineWidth(0.4); docPdf.line(20, y, 190, y); y += 12;

  docPdf.text(`Total Questions: ${sub.total}`, 20, y); y += 9;
  docPdf.text(`Correct: ${sub.correct}`, 20, y); y += 9;
  docPdf.text(`Wrong: ${sub.wrong}`, 20, y); y += 9;
  docPdf.text(`Unanswered: ${sub.unanswered}`, 20, y); y += 9;
  docPdf.text(`Marks Secured: ${sub.correct} / ${sub.total}`, 20, y); y += 9;
  docPdf.text(`Percentage: ${sub.percentage}%`, 20, y); y += 9;
  docPdf.text(`Time Taken: ${fmtClockFromSeconds(sub.timeSeconds)}`, 20, y); y += 9;
  if (sub.rank) { docPdf.text(`Rank: ${sub.rank}`, 20, y); y += 9; }

  y += 8;
  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16);
  const pass = sub.percentage >= 40;
  docPdf.setTextColor(pass ? 16 : 239, pass ? 185 : 68, pass ? 129 : 68);
  docPdf.text(`RESULT: ${pass ? 'PASS' : 'FAIL'}`, 20, y);

  docPdf.save(`${meta.name.replace(/\s+/g, '_')}_Marksheet.pdf`);
  displayToast("Marksheet Downloaded.", "success");
}

function generateResponseSheetPdf() {
  const docPdf = newA4Doc(); if (!docPdf) return;
  let y = 20;
  docPdf.setFontSize(18); docPdf.setFont("helvetica", "bold");
  docPdf.text("EXAM RESPONSE SHEET", 105, y, { align: "center" }); y += 15;
  docPdf.setFontSize(11); docPdf.setFont("helvetica", "normal");
  docPdf.text(`Candidate: ${state.studentMeta.name} | Exam: ${state.activeQuiz ? state.activeQuiz.title : '-'}`, 20, y); y += 15;

  state.activeQuestions.forEach((q, i) => {
    if (y > 265) { docPdf.addPage(); y = 20; }
    const chosen = state.userAnswers[i] || 'None';
    const correct = q.answer || 'A';
    const isCorrect = chosen === correct;

    docPdf.setFont("helvetica", "bold"); docPdf.setTextColor(0, 0, 0);
    const qLines = docPdf.splitTextToSize(`Q${i + 1}. ${stripHtml(q.text)}`, 170);
    docPdf.text(qLines, 20, y); y += qLines.length * 6 + 2;

    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Your Answer: Option ${chosen} - ${stripHtml(q[chosen.toLowerCase()] || '')}`, 25, y); y += 7;

    if (!isCorrect) {
      docPdf.setTextColor(220, 38, 38);
      docPdf.text(`Correct Answer: Option ${correct} - ${stripHtml(q[correct.toLowerCase()] || '')}`, 25, y); y += 7;
    }

    docPdf.setFont("helvetica", "bold");
    docPdf.setTextColor(isCorrect ? 16 : 220, isCorrect ? 185 : 38, isCorrect ? 129 : 38);
    docPdf.text(`Marks: ${isCorrect ? '+1 Correct' : '0 Wrong'}`, 25, y); y += 12;
    docPdf.setTextColor(0, 0, 0);
  });

  docPdf.save(`${state.studentMeta.name.replace(/\s+/g, '_')}_Response_Sheet.pdf`);
  displayToast("Response Sheet Downloaded.", "success");
}

/* ============================================================
   QUIZ RUNNER (timestamp-based timer + auto-save + heartbeat)
============================================================ */
function launchQuizRunner(quiz, ctx, resumeIndex) {
  state.activeQuiz = quiz;
  state.activeQuestions = quiz.questions || [];
  state.currentQuestionIndex = resumeIndex || 0;

  if (state.runnerTimerId) clearInterval(state.runnerTimerId);
  if (state.runnerHeartbeatId) clearInterval(state.runnerHeartbeatId);

  document.getElementById('runnerQuizTitle').textContent = quiz.title;
  document.getElementById('runnerCandidateBadge').textContent = `Candidate: ${state.studentMeta.name}`;

  document.body.classList.add('student-mode');
  document.getElementById('welcomeGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  switchViewport('quizSection');
  renderActiveQuestion();

  state.runnerTimerId = setInterval(() => {
    const remainingMs = state.studentMeta.deadlineAt - nowMs();
    const label = document.getElementById('runnerTimer');
    if (remainingMs <= 0) {
      label.textContent = "TIME LEFT: 00:00";
      clearInterval(state.runnerTimerId);
      submitExam(true);
    } else {
      label.textContent = `TIME LEFT: ${fmtClockFromSeconds(remainingMs / 1000)}`;
    }
  }, 1000);

  state.runnerHeartbeatId = setInterval(() => {
    heartbeatTick(state.studentMeta.contextId, state.studentMeta.participantId);
  }, 8000);
  heartbeatTick(state.studentMeta.contextId, state.studentMeta.participantId);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
}

function handleVisibilityChange() {
  if (!state.studentMeta.contextId) return;
  if (document.hidden) {
    updateParticipantProgress(state.studentMeta.contextId, state.studentMeta.participantId, { status: 'answering' });
  } else {
    heartbeatTick(state.studentMeta.contextId, state.studentMeta.participantId);
    updateParticipantProgress(state.studentMeta.contextId, state.studentMeta.participantId, { status: 'answering' });
  }
}
function handleBeforeUnload() {
  if (state.studentMeta.contextId) heartbeatTick(state.studentMeta.contextId, state.studentMeta.participantId);
}

function renderActiveQuestion() {
  const q = state.activeQuestions[state.currentQuestionIndex];
  document.getElementById('runnerQuestionMeta').textContent = `Question ${state.currentQuestionIndex + 1} of ${state.activeQuestions.length}`;
  document.getElementById('runnerQuestionText').innerHTML = q.text;

  const prog = ((state.currentQuestionIndex + 1) / state.activeQuestions.length) * 100;
  document.getElementById('runnerProgressBar').style.width = `${prog}%`;

  document.getElementById('runnerOptionsGrid').innerHTML = ['A', 'B', 'C', 'D'].filter(opt => q[opt.toLowerCase()]).map(opt => `
    <div class="glass-card option-card" style="padding:14px; cursor:pointer; border:2px solid ${state.userAnswers[state.currentQuestionIndex] === opt ? 'var(--primary)' : 'var(--border)'}; background:${state.userAnswers[state.currentQuestionIndex] === opt ? 'var(--primary-light)' : 'transparent'}" onclick="window.appEngineAPI.selectAnswer('${opt}')">
      <b>${opt}:</b> <span>${q[opt.toLowerCase()]}</span>
    </div>
  `).join('');

  const isLast = state.currentQuestionIndex === state.activeQuestions.length - 1;
  document.getElementById('runnerPrevBtn').disabled = state.currentQuestionIndex === 0;
  document.getElementById('runnerNextBtn').classList.toggle('hidden', isLast);
  document.getElementById('runnerSubmitBtn').classList.toggle('hidden', !isLast);

  const answeredCount = Object.keys(state.userAnswers).length;
  if (state.studentMeta.contextId) {
    updateParticipantProgress(state.studentMeta.contextId, state.studentMeta.participantId, {
      status: 'answering', currentQuestionIndex: state.currentQuestionIndex, answeredCount
    });
  }
}

document.getElementById('runnerSubmitBtn').onclick = () => submitExam(false);

async function submitExam(timeExpired) {
  if (state.runnerTimerId) clearInterval(state.runnerTimerId);
  if (state.runnerHeartbeatId) clearInterval(state.runnerHeartbeatId);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  let correct = 0, wrong = 0, unanswered = 0;
  state.activeQuestions.forEach((q, i) => {
    const chosen = state.userAnswers[i];
    if (!chosen) unanswered++;
    else if (chosen === (q.answer || 'A')) correct++;
    else wrong++;
  });

  const total = state.activeQuestions.length;
  const percentage = total ? Math.round((correct / total) * 100) : 0;
  const timeSeconds = Math.max(0, Math.round((nowMs() - (state.studentMeta.startedAt || nowMs())) / 1000));

  const submission = {
    participantId: state.studentMeta.participantId, contextId: state.studentMeta.contextId,
    examId: state.activeQuiz.id, name: state.studentMeta.name, rollNo: state.studentMeta.rollNo || '-',
    correct, wrong, unanswered, total, percentage, timeSeconds, timeExpired: !!timeExpired, submittedAt: nowMs()
  };

  await recordSubmission(state.studentMeta.contextId, submission);

  const allSubs = await fetchSubmissions(state.studentMeta.contextId);
  const ranked = computeDenseRanking(allSubs.map(s => ({ ...s, timeSeconds: s.timeSeconds || 0 })));
  const mine = ranked.find(r => r.participantId === submission.participantId);
  submission.rank = mine ? mine.rank : 1;

  state.submissions.push({ ...submission, time: fmtClockFromSeconds(timeSeconds) });

  document.getElementById('reviewScoreText').textContent = `${correct} / ${total}`;
  document.getElementById('reviewPercentageText').textContent = `${percentage}%`;
  document.getElementById('reviewTimeText').textContent = fmtClockFromSeconds(timeSeconds);

  const pfBadge = document.getElementById('passFailText');
  pfBadge.textContent = percentage >= 40 ? "PASS" : "FAIL";
  pfBadge.style.color = percentage >= 40 ? "var(--success)" : "var(--danger)";
  pfBadge.style.background = percentage >= 40 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";

  const rankEl = document.getElementById('reviewRankText');
  if (rankEl) rankEl.textContent = `Rank: ${submission.rank}`;

  switchViewport('reviewSection');
  if (timeExpired) displayToast("Time is up — your exam was submitted automatically.", "info");
}
