import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc, 
  onSnapshot, query, where 
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
try { app = initializeApp(firebaseConfig); db = getFirestore(app); } catch (err) { console.warn("Offline fallback mode."); }

const state = {
  quizzes: [], examGroups: [], scheduledExams: [], questionBank: [],
  currentUser: { uid: 'GUEST', role: 'guest', name: 'Guest' },
  liveRoom: { active: false, pin: '', title: '', durationMinutes: 30, elapsedSeconds: 0, timerId: null, participants: [] },
  activeQuiz: null, activeQuestions: [], userAnswers: {}, currentQuestionIndex: 0, runnerTimerId: null, runnerElapsedSeconds: 0,
  studentMeta: { name: '', rollNo: '', school: '', pin: '', startTime: null },
  creatorQuestions: [], tutStep: 1
};

document.addEventListener('DOMContentLoaded', async () => {
  setupThemeAndPalette();
  registerNavigationEvents();
  registerAuthEvents();
  registerCreatorEvents();
  registerLiveEvents();
  registerGroupEvents();
  registerPdfEvents();
  setupTooltips();

  await checkPersistedSession();
  await loadAndMigrateCloudState();
  checkAutoOpenSchedules();
  setInterval(checkAutoOpenSchedules, 60000);
});

// --- THEME & UI ---
function setupThemeAndPalette() {
  const html = document.documentElement;
  document.getElementById('themeToggleBtn').onclick = () => {
    const nextMode = html.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-mode', nextMode);
  };
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.onclick = () => {
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      html.setAttribute('data-theme', dot.getAttribute('data-palette'));
    };
  });
}

// --- AUTHENTICATION & PORTAL ---
function registerAuthEvents() {
  document.getElementById('btnEnterGuest').onclick = () => authorizeSession({ uid: 'GUEST', role: 'guest', name: 'Guest' });
  document.getElementById('btnLogin').onclick = () => {
    authorizeSession({ uid: 'TEACHER', role: 'teacher', name: 'Educator' }); // Simplified for UI demonstration
  };
  document.getElementById('btnStudentEnterLive').onclick = handleStudentLiveJoin;
  document.getElementById('logoutBtn').onclick = () => { localStorage.clear(); location.reload(); };
}

async function checkPersistedSession() {
  const session = await localforage.getItem('activeSession');
  if (session) authorizeSession(session);
  else document.getElementById('welcomeGate').classList.remove('hidden');
}

async function authorizeSession(profile) {
  state.currentUser = profile;
  await localforage.setItem('activeSession', profile);
  document.getElementById('welcomeGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('welcomeUserName').textContent = profile.name;
  
  if(!localStorage.getItem('hasSeenTutorial') && profile.role !== 'guest') {
    window.appEngineAPI.startTutorial();
  }
}

// --- STUDENT JOIN ---
async function handleStudentLiveJoin() {
  const pin = document.getElementById('studentPinInput').value.trim().toUpperCase();
  const name = document.getElementById('studentNameInput').value.trim();
  if (!pin || !name) return displayToast("Enter PIN and Name.", "error");

  let targetRoom = (state.liveRoom.active && state.liveRoom.pin === pin) ? state.liveRoom : null;
  if(!targetRoom && db) {
    const snap = await getDocs(query(collection(db, "live_rooms"), where("pinCode", "==", pin)));
    if(!snap.empty) targetRoom = snap.docs[0].data();
  }

  if (!targetRoom || targetRoom.status !== 'active') return displayToast("PIN invalid or exam not active.", "error");

  state.studentMeta = { name, pin, startTime: Date.now() };
  const quizAsset = state.quizzes.find(q => q.id === targetRoom.sourceQuizId) || state.quizzes[0];
  
  if(db) await addDoc(collection(db, "participants"), { pinCode: pin, name, status: "joined", joinedAt: Date.now(), score: 0 });
  
  launchLiveQuizRunner(quizAsset, targetRoom.durationMinutes);
}

// --- LIVE ROOM (TEACHER) ---
function registerLiveEvents() {
  document.getElementById('btnModeStartNow').onclick = () => {
    populateSelects();
    document.getElementById('liveSetupPanel').classList.remove('hidden');
  };
  document.getElementById('btnModeSchedule').onclick = () => window.appEngineAPI.openScheduler();
  document.getElementById('btnConfirmStartNow').onclick = startLiveExam;
  document.getElementById('btnLiveConclude').onclick = concludeLiveExam;
}

function startLiveExam() {
  const qId = document.getElementById('liveSetupQuizSelect').value;
  const quiz = state.quizzes.find(q => q.id === qId) || state.examGroups.find(g=>g.id===qId);
  if(!quiz) return displayToast("Select a valid exam.", "error");

  const pin = `TN${Math.floor(1000 + Math.random() * 9000)}`;
  state.liveRoom = { active: true, pin, title: quiz.title||quiz.name, durationMinutes: document.getElementById('liveSetupDuration').value, elapsedSeconds: 0, participants: [] };

  document.getElementById('liveSetupPanel').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.remove('hidden');
  document.getElementById('liveHostPinCode').textContent = pin;
  document.getElementById('liveHostExamTitle').textContent = state.liveRoom.title;
  document.getElementById('globalLiveBadge').classList.remove('hidden');

  if (db) setDoc(doc(db, "live_rooms", pin), { pinCode: pin, status: "active", sourceQuizId: quiz.id, durationMinutes: state.liveRoom.durationMinutes });
  
  state.liveRoom.timerId = setInterval(() => {
    state.liveRoom.elapsedSeconds++;
    const m = String(Math.floor(state.liveRoom.elapsedSeconds/60)).padStart(2,'0');
    const s = String(state.liveRoom.elapsedSeconds%60).padStart(2,'0');
    document.getElementById('liveHostTimer').textContent = `${m}:${s}`;
  }, 1000);
}

function concludeLiveExam() {
  clearInterval(state.liveRoom.timerId);
  state.liveRoom.active = false;
  document.getElementById('globalLiveBadge').classList.add('hidden');
  displayToast("Exam concluded.", "info");
}

function renderProctoringTable() {
  const tbody = document.getElementById('liveParticipantsTableBody');
  document.getElementById('liveStatJoined').textContent = state.liveRoom.participants.length;
  document.getElementById('liveStatCompleted').textContent = state.liveRoom.participants.filter(p=>p.status==='submitted').length;
  
  if(!state.liveRoom.participants.length) { tbody.innerHTML = `<tr><td colspan="6" class="text-center">No students joined yet.</td></tr>`; return; }
  
  tbody.innerHTML = state.liveRoom.participants.map(p => `
    <tr>
      <td><span class="status-badge status-${p.status}">${p.status.toUpperCase()}</span></td>
      <td><strong>${p.name}</strong></td><td>${p.rollNo||'-'}</td>
      <td>Q${p.currentQuestion||1}</td><td><b>${p.score||0}</b></td><td>${p.completionTime||'-'}</td>
    </tr>
  `).join('');
}

// --- CREATOR & GROUPS ---
function registerCreatorEvents() {
  document.getElementById('creatorAppendQuestionBtn').onclick = () => {
    const text = document.getElementById('qFormText').value.trim();
    if (!text) return displayToast("Enter question.", "error");
    state.creatorQuestions.push({ text, a: document.getElementById('qFormOptA').value, b: document.getElementById('qFormOptB').value, c: document.getElementById('qFormOptC').value, d: document.getElementById('qFormOptD').value, answer: document.getElementById('qFormAnswer').value });
    document.getElementById('pendingQuestionsCount').textContent = state.creatorQuestions.length;
    document.querySelectorAll('#creatorQuestionForm input[type="text"]').forEach(i=>i.value='');
    displayToast("Added to draft.", "success");
  };
  
  document.getElementById('creatorToWorkspaceBtn').onclick = () => {
    const title = document.getElementById('creatorQuizTitle').value || "New Quiz";
    const newQuiz = { id: `QZ-${Date.now()}`, title, questions: [...state.creatorQuestions], metaClass: document.getElementById('creatorClass').value };
    state.quizzes.push(newQuiz);
    saveLocalState();
    displayToast("Quiz saved!", "success");
    switchViewport('librarySection');
    renderLibrary();
  };
}

function registerGroupEvents() {
  document.getElementById('groupCommitBtn').onclick = () => {
    const title = document.getElementById('groupNameInput').value;
    if(!title) return displayToast("Title required", "error");
    state.examGroups.push({ id: `GRP-${Date.now()}`, name: title, isGroup: true, refs: Array.from(document.querySelectorAll('.group-chk:checked')).map(c=>c.value) });
    saveLocalState();
    displayToast("Combined exam saved.", "success");
    switchViewport('librarySection');
  };
}

// --- STUDENT RUNNER ---
function launchLiveQuizRunner(asset, durationMins) {
  state.activeQuestions = asset.questions || [];
  state.currentQuestionIndex = 0;
  state.userAnswers = {};
  state.runnerElapsedSeconds = 0;
  
  document.getElementById('runnerQuizTitle').textContent = asset.title||asset.name;
  switchViewport('quizSection');
  renderActiveQuestion();
  
  state.runnerTimerId = setInterval(() => {
    state.runnerElapsedSeconds++;
    const m = String(Math.floor(state.runnerElapsedSeconds/60)).padStart(2,'0');
    const s = String(state.runnerElapsedSeconds%60).padStart(2,'0');
    document.getElementById('runnerTimer').textContent = `${m}:${s}`;
  }, 1000);
}

function renderActiveQuestion() {
  const q = state.activeQuestions[state.currentQuestionIndex];
  document.getElementById('runnerQuestionMeta').textContent = `Question ${state.currentQuestionIndex + 1} of ${state.activeQuestions.length}`;
  document.getElementById('runnerQuestionText').innerHTML = q.text;
  
  document.getElementById('runnerOptionsGrid').innerHTML = ['A','B','C','D'].filter(opt=>q[opt.toLowerCase()]).map(opt=>`
    <div class="glass-card" style="padding:14px; cursor:pointer; border:2px solid ${state.userAnswers[state.currentQuestionIndex]===opt?'var(--primary)':'var(--border)'}" onclick="window.appEngineAPI.selectAnswer('${opt}')">
      <b>${opt}:</b> ${q[opt.toLowerCase()]}
    </div>
  `).join('');
  
  const isLast = state.currentQuestionIndex === state.activeQuestions.length - 1;
  document.getElementById('runnerNextBtn').classList.toggle('hidden', isLast);
  document.getElementById('runnerSubmitBtn').classList.toggle('hidden', !isLast);
}

document.getElementById('runnerSubmitBtn').onclick = () => {
  clearInterval(state.runnerTimerId);
  let correct = 0;
  state.activeQuestions.forEach((q, i) => { if(state.userAnswers[i] === (q.answer||'A')) correct++; });
  const perc = Math.round((correct / state.activeQuestions.length) * 100);
  const timeStr = document.getElementById('runnerTimer').textContent;
  
  document.getElementById('reviewScoreText').textContent = `${correct} / ${state.activeQuestions.length}`;
  document.getElementById('reviewPercentageText').textContent = `${perc}%`;
  document.getElementById('reviewTimeText').textContent = timeStr;
  document.getElementById('passFailText').textContent = perc >= 40 ? "PASS" : "FAIL";
  document.getElementById('passFailText').style.color = perc >= 40 ? "var(--success)" : "var(--danger)";
  
  switchViewport('reviewSection');
};

// --- PDF GENERATOR (Fixing text wrapping) ---
function registerPdfEvents() {
  document.getElementById('pdfGenerateDownloadBtn').onclick = () => generatePDF('question');
  document.getElementById('pdfGenerateKeyBtn').onclick = () => generatePDF('key');
}

async function generatePDF(type) {
  const assetId = document.getElementById('pdfSourceAssetSelect').value;
  const qz = state.quizzes.find(q => q.id === assetId) || state.quizzes[0];
  if(!qz || !window.jspdf) return displayToast("Select valid exam / wait for PDF engine.", "error");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  
  doc.setFont("helvetica", "bold");
  doc.text(document.getElementById('pdfSchoolHeaderInput').value, 105, y, {align:"center"}); y+=10;
  doc.text(`EXAM: ${qz.title} | ${type === 'key' ? 'ANSWER KEY' : 'QUESTION PAPER'}`, 105, y, {align:"center"}); y+=15;
  
  qz.questions.forEach((q, i) => {
    if(y > 270) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    
    if(type === 'key') {
      const qText = doc.splitTextToSize(`${i+1}. ${q.text}  --> [ KEY: ${q.answer||'A'} ]`, 180);
      doc.text(qText, 15, y);
      y += (qText.length * 6) + 4;
    } else {
      const qText = doc.splitTextToSize(`${i+1}. ${q.text}`, 180);
      doc.text(qText, 15, y);
      y += (qText.length * 6);
      doc.setFont("helvetica", "normal");
      const optText = doc.splitTextToSize(`(A) ${q.a}  (B) ${q.b}  (C) ${q.c}  (D) ${q.d}`, 180);
      doc.text(optText, 20, y);
      y += (optText.length * 6) + 4;
    }
  });
  
  doc.save(`${qz.title}_${type}.pdf`);
  displayToast("PDF Generated Successfully", "success");
}

// --- STATE MANAGEMENT & SCHEDULING ---
function saveLocalState() {
  localStorage.setItem('QMP_STATE', JSON.stringify({ quizzes: state.quizzes, examGroups: state.examGroups, scheduled: state.scheduledExams }));
  renderLibrary(); renderDashboardData(); populateSelects();
}

async function loadAndMigrateCloudState() {
  const cached = JSON.parse(localStorage.getItem('QMP_STATE') || '{"quizzes":[], "examGroups":[], "scheduled":[]}');
  state.quizzes = cached.quizzes || []; state.examGroups = cached.examGroups || []; state.scheduledExams = cached.scheduled || [];
  if(!state.quizzes.length) {
    state.quizzes.push({ id:'QZ1', title:'Sample Science Test', metaClass:'Class 10', questions: [{text:"Inertia depends on?", a:"Weight", b:"Mass", c:"Volume", d:"Density", answer:"B"}] });
    saveLocalState();
  }
  renderDashboardData(); populateSelects();
}

function renderDashboardData() {
  document.getElementById('statTotalQuizzes').textContent = state.quizzes.length;
  document.getElementById('statTotalQuestions').textContent = state.quizzes.reduce((a,c)=>a+(c.questions?.length||0),0);
  document.getElementById('statTotalScheduled').textContent = state.scheduledExams.length;
  
  const calBox = document.getElementById('dashboardCalendarList');
  if(!state.scheduledExams.length) {
    calBox.innerHTML = `<div class="empty-state-msg"><p>No scheduled exams.</p><button class="btn-sm btn-primary mt-10" onclick="window.appEngineAPI.openScheduler()">Schedule Exam</button></div>`;
  } else {
    calBox.innerHTML = state.scheduledExams.map(s => `
      <div class="agenda-item">
        <div class="agenda-date">${new Date(s.date).toLocaleDateString('en-GB',{month:'short',day:'numeric'})}</div>
        <div class="agenda-body"><strong>${s.title}</strong><p>${s.time} | ${s.duration} mins | Status: ${s.status}</p></div>
      </div>
    `).join('');
  }
}

function populateSelects() {
  let opts = '<option value="">-- Select Exam --</option>' + state.quizzes.map(q=>`<option value="${q.id}">${q.title}</option>`).join('');
  document.getElementById('liveSetupQuizSelect').innerHTML = opts;
  document.getElementById('schedQuizSelect').innerHTML = opts;
  document.getElementById('pdfSourceAssetSelect').innerHTML = opts;
}

function checkAutoOpenSchedules() {
  const now = new Date();
  state.scheduledExams.forEach(s => {
    if(s.status === 'scheduled') {
      const sDate = new Date(`${s.date}T${s.time}`);
      if(now >= sDate) {
        s.status = 'open';
        displayToast(`Scheduled Exam ${s.title} is now Open!`, "success");
        saveLocalState();
      }
    }
  });
}

function renderLibrary() {
  const lib = document.getElementById('libraryContainer');
  lib.innerHTML = state.quizzes.map(q=>`
    <div class="glass-card" style="padding:20px; border-left:4px solid var(--primary);">
      <h3>${q.title}</h3><p class="subtext">${q.metaClass} | ${q.questions.length} Questions</p>
    </div>
  `).join('');
  
  const gi = document.getElementById('groupInventoryContainer');
  if(gi) gi.innerHTML = state.quizzes.map(q=>`<div><input type="checkbox" value="${q.id}" class="group-chk"/> ${q.title}</div>`).join('');
}

// --- GLOBAL API & ROUTING ---
function switchViewport(targetId) {
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(targetId).classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('data-target')===targetId));
  window.scrollTo({top:0});
}

function registerNavigationEvents() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => { e.preventDefault(); switchViewport(link.getAttribute('data-target')); };
  });
  document.getElementById('globalStickyHomeBtn').onclick = () => switchViewport('homeSection');
  document.getElementById('sidebarToggle').onclick = () => {
    document.getElementById('appSidebar').classList.toggle('hidden');
    document.querySelector('.main-content').classList.toggle('expanded');
  };
  document.getElementById('runnerNextBtn').onclick = () => { state.currentQuestionIndex++; renderActiveQuestion(); };
  document.getElementById('runnerPrevBtn').onclick = () => { state.currentQuestionIndex--; renderActiveQuestion(); };
}

// --- TOOLTIPS ---
function setupTooltips() {
  const tt = document.getElementById('globalTooltip');
  const ttC = document.getElementById('ttContent');
  document.querySelectorAll('.explain-btn').forEach(btn => {
    btn.onmouseenter = (e) => {
      ttC.textContent = btn.getAttribute('data-tooltip');
      tt.style.left = e.pageX + 10 + 'px';
      tt.style.top = e.pageY + 10 + 'px';
      tt.classList.remove('hidden');
    };
    btn.onmouseleave = () => tt.classList.add('hidden');
  });
}

function displayToast(msg, type="info") {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast-message`;
  t.style.borderLeftColor = type==='error'?'var(--danger)':type==='success'?'var(--success)':'var(--primary)';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(()=>t.remove(), 4000);
}

const tutSteps = [
  {t:"1. Choose Quiz", d:"Create a quiz manually or import from Excel."},
  {t:"2. Schedule or Start Now", d:"Set a date for later or launch live immediately."},
  {t:"3. Share PIN", d:"Give the 6-digit PIN to students. No login needed for them."},
  {t:"4. Watch Students", d:"Monitor who joins and their live answering progress."},
  {t:"5. See Results", d:"Get instant leaderboard rankings upon completion."},
  {t:"6. Download Marksheet", d:"Export professional PDF or Excel class registers."}
];

window.appEngineAPI = {
  switchContext: switchViewport,
  toggleCreatorTab: (tab) => {
    document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab !== 'manual');
    document.getElementById('creatorExcelForm').classList.toggle('hidden', tab !== 'excel');
    document.getElementById('tabManual').classList.toggle('active', tab === 'manual');
    document.getElementById('tabExcel').classList.toggle('active', tab === 'excel');
  },
  selectAnswer: (opt) => { state.userAnswers[state.currentQuestionIndex] = opt; renderActiveQuestion(); },
  openScheduler: () => { populateSelects(); document.getElementById('scheduleModal').classList.remove('hidden'); },
  closeScheduler: () => document.getElementById('scheduleModal').classList.add('hidden'),
  saveSchedule: () => {
    const title = document.getElementById('schedQuizSelect').options[document.getElementById('schedQuizSelect').selectedIndex].text;
    state.scheduledExams.push({ id:`SCH-${Date.now()}`, title, date: document.getElementById('schedDate').value, time: document.getElementById('schedTime').value, duration: document.getElementById('schedDuration').value, status: 'scheduled' });
    saveLocalState();
    window.appEngineAPI.closeScheduler();
    displayToast("Exam Scheduled Successfully!", "success");
  },
  startTutorial: () => { state.tutStep=1; window.appEngineAPI.renderTut(); document.getElementById('tutorialModal').classList.remove('hidden'); },
  closeTutorial: () => { localStorage.setItem('hasSeenTutorial','true'); document.getElementById('tutorialModal').classList.add('hidden'); },
  renderTut: () => {
    const s = tutSteps[state.tutStep-1];
    document.getElementById('tutStepNum').textContent = state.tutStep;
    document.getElementById('tutTitle').textContent = s.t;
    document.getElementById('tutDesc').textContent = s.d;
    document.getElementById('tutBackBtn').disabled = state.tutStep===1;
    document.getElementById('tutNextBtn').textContent = state.tutStep===6?'Finish':'Next';
  },
  nextTutorial: () => { if(state.tutStep<6) { state.tutStep++; window.appEngineAPI.renderTut(); } else window.appEngineAPI.closeTutorial(); },
  prevTutorial: () => { if(state.tutStep>1) { state.tutStep--; window.appEngineAPI.renderTut(); } }
};