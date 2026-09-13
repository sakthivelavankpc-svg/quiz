import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc, 
  onSnapshot, query, where, updateDoc, arrayUnion, getDoc
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

const state = {
  quizzes: [], 
  scheduledExams: [], 
  submissions: [], 
  currentUser: { uid: 'GUEST', role: 'guest', name: 'Guest' },
  liveRoom: { active: false, pin: '', title: '', durationMinutes: 30, elapsedSeconds: 0, timerId: null, participants: [], sourceQuizId: null },
  activeQuiz: null, activeQuestions: [], userAnswers: {}, currentQuestionIndex: 0, runnerTimerId: null, runnerElapsedSeconds: 0,
  studentMeta: { name: '', rollNo: '', school: '', pin: '', startTime: null },
  creatorQuestions: [], tutStep: 1, studentWaitInterval: null, studentWaitSeconds: 0
};

document.addEventListener('DOMContentLoaded', async () => {
  setupThemeAndPalette();
  registerNavigationEvents();
  registerAuthEvents();
  registerCreatorEvents();
  registerLiveEvents();

  await checkPersistedSession();
  await loadAndMigrateCloudState();

  // URL checking to isolate student view mode
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  
  if (pinFromUrl) {
      document.getElementById('studentPinInput').value = pinFromUrl;
      // Isolate Student View: hide the teacher gates completely
      document.getElementById('teacherAuthGates').style.display = 'none';
      document.body.classList.add('student-mode'); // Applied class for CSS locking
  }
});

function setupThemeAndPalette() {
  const html = document.documentElement;
  document.getElementById('themeToggleBtn').onclick = () => {
    const nextMode = html.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-mode', nextMode);
  };
}

function registerAuthEvents() {
  document.getElementById('btnEnterGuest').onclick = () => authorizeSession({ uid: 'GUEST', role: 'guest', name: 'Guest' });
  document.getElementById('btnLogin').onclick = () => authorizeSession({ uid: 'TEACHER', role: 'teacher', name: 'Educator' }); 
  document.getElementById('btnStudentEnterLive').onclick = handleStudentLiveJoin;
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
}

// --- SECURE STUDENT EXAM JOIN & WAITING ROOM ---
async function handleStudentLiveJoin() {
  const pin = document.getElementById('studentPinInput').value.trim().toUpperCase();
  const name = document.getElementById('studentNameInput').value.trim();
  const rollNo = document.getElementById('studentRollInput').value.trim();
  
  if (!pin || !name) return displayToast("Exam PIN and Name are required.", "error");

  let targetRoom = null;
  
  // Fetch room data from Cloud (which contains the securely uploaded quiz data)
  if(db) {
    try {
        const docRef = doc(db, "live_rooms", pin);
        const docSnap = await getDoc(docRef);
        if(docSnap.exists()) {
            targetRoom = docSnap.data();
        }
    } catch(e) { console.warn("Firebase fetch failed", e); }
  }

  if (!targetRoom) {
      return displayToast("PIN invalid or exam not found.", "error");
  }

  // Set the environment specifically for the student
  document.body.classList.add('student-mode');
  document.getElementById('welcomeGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  
  state.studentMeta = { name, rollNo, pin, startTime: Date.now() };
  
  // Cloud fetch provides the questions directly, preventing missing data on student devices
  const quizAsset = targetRoom.quizData; 
  if(!quizAsset) return displayToast("Exam data corrupted. Teacher must restart the room.", "error");

  const participantRecord = { name, rollNo, status: 'joined', score: 0, currentQuestion: 1, completionTime: '-' };

  // Wait Room Logic
  if (targetRoom.status === 'scheduled') {
      switchViewport('waitingRoomSection');
      
      // Elapsed wait timer logic
      state.studentWaitSeconds = 0;
      if(state.studentWaitInterval) clearInterval(state.studentWaitInterval);
      state.studentWaitInterval = setInterval(() => {
          state.studentWaitSeconds++;
          const m = String(Math.floor(state.studentWaitSeconds/60)).padStart(2,'0');
          const s = String(state.studentWaitSeconds%60).padStart(2,'0');
          document.getElementById('studentWaitTimer').textContent = `${m}:${s}`;
      }, 1000);

      // Listen for the teacher to manually click "Start Live"
      const unsub = onSnapshot(doc(db, "live_rooms", pin), (docSnap) => {
          if(docSnap.exists() && docSnap.data().status === 'active') {
              clearInterval(state.studentWaitInterval);
              unsub(); // Stop listening
              syncStudentJoined(pin, participantRecord);
              launchLiveQuizRunner(quizAsset, docSnap.data().durationMinutes);
          }
      });
      return;
  } 

  // If already active, jump straight into the exam
  if (targetRoom.status === 'active') {
      syncStudentJoined(pin, participantRecord);
      launchLiveQuizRunner(quizAsset, targetRoom.durationMinutes);
  } else {
      displayToast("Exam is no longer active.", "error");
  }
}

async function syncStudentJoined(pin, record) {
    if(!db) return;
    try {
        await updateDoc(doc(db, "live_rooms", pin), { participants: arrayUnion(record) });
    } catch(e) { console.warn("Could not sync participant to cloud."); }
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
  const quiz = state.quizzes.find(q => q.id === qId);
  if(!quiz || !quiz.questions || quiz.questions.length === 0) return displayToast("Select a valid exam with questions.", "error");

  const pin = `TN${Math.floor(1000 + Math.random() * 9000)}`;
  const duration = parseInt(document.getElementById('liveSetupDuration').value) || 30;
  
  if(state.liveRoom.timerId) clearInterval(state.liveRoom.timerId);

  state.liveRoom = { active: true, pin, title: quiz.title, durationMinutes: duration, elapsedSeconds: 0, participants: [], sourceQuizId: quiz.id };

  document.getElementById('liveSetupPanel').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.remove('hidden');
  document.getElementById('liveHostPinCode').textContent = pin;
  document.getElementById('liveHostExamTitle').textContent = state.liveRoom.title;
  document.getElementById('globalLiveBadge').classList.remove('hidden');

  const joinUrl = window.location.origin + window.location.pathname + "?pin=" + pin;
  document.getElementById('liveHostShareUrl').innerHTML = `Link: <a href="${joinUrl}" target="_blank" style="color:var(--primary);text-decoration:none;font-weight:bold;">${joinUrl}</a> <i class="ri-clipboard-line" style="cursor:pointer; margin-left:8px;" title="Copy Link" onclick="window.appEngineAPI.displayToast('Link Copied!', 'success'); navigator.clipboard.writeText('${joinUrl}')"></i>`;
  
  renderProctoringTable(); 

  // Push full Quiz Data to Firestore so students on other devices can render it
  if (db) {
      try { 
          setDoc(doc(db, "live_rooms", pin), { 
              pinCode: pin, status: "active", sourceQuizId: quiz.id, durationMinutes: duration,
              participants: [],
              quizData: quiz // Critical payload
          }); 
          onSnapshot(doc(db, "live_rooms", pin), (docSnap) => {
              if(docSnap.exists()) {
                  state.liveRoom.participants = docSnap.data().participants || [];
                  renderProctoringTable();
              }
          });
      } catch(e) { console.warn("Firebase unreachable."); }
  }
  
  state.liveRoom.timerId = setInterval(() => {
    state.liveRoom.elapsedSeconds++;
    const m = String(Math.floor(state.liveRoom.elapsedSeconds/60)).padStart(2,'0');
    const s = String(state.liveRoom.elapsedSeconds%60).padStart(2,'0');
    document.getElementById('liveHostTimer').textContent = `${m}:${s}`;
  }, 1000);
  
  displayToast("Live Exam Room Opened!", "success");
}

function concludeLiveExam() {
  if(state.liveRoom.timerId) clearInterval(state.liveRoom.timerId);
  state.liveRoom.active = false;
  document.getElementById('globalLiveBadge').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.add('hidden');
  switchViewport('homeSection');
  displayToast("Live Exam Concluded.", "info");
}

function renderProctoringTable() {
  const tbody = document.getElementById('liveParticipantsTableBody');
  document.getElementById('liveStatJoined').textContent = state.liveRoom.participants.length;
  document.getElementById('liveStatCompleted').textContent = state.liveRoom.participants.filter(p=>p.status==='submitted').length;
  
  if(!state.liveRoom.participants.length) { 
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No students joined yet. Share the PIN.</td></tr>`; 
      return; 
  }
  tbody.innerHTML = state.liveRoom.participants.map(p => `<tr><td><span class="status-badge status-${p.status}">${p.status.toUpperCase()}</span></td><td><strong>${p.name}</strong></td><td>${p.rollNo||'-'}</td><td>Q${p.currentQuestion||1}</td><td><b>${p.score||0}</b></td><td>${p.completionTime||'-'}</td></tr>`).join('');
}

async function updateCloudParticipantProgress(newStatus, score = 0, completionTime = '-') {
    if(!db || !state.studentMeta.pin) return;
    try {
        const roomRef = doc(db, "live_rooms", state.studentMeta.pin);
        const docSnap = await getDoc(roomRef);
        if(docSnap.exists()) {
            let parts = docSnap.data().participants || [];
            let meIndex = parts.findIndex(p => p.name === state.studentMeta.name && p.rollNo === state.studentMeta.rollNo);
            if(meIndex > -1) {
                parts[meIndex].status = newStatus;
                parts[meIndex].currentQuestion = state.currentQuestionIndex + 1;
                if (newStatus === 'submitted') {
                    parts[meIndex].score = score;
                    parts[meIndex].completionTime = completionTime;
                }
                await updateDoc(roomRef, { participants: parts });
            }
        }
    } catch(e) { console.warn("Progress sync failed"); }
}

// --- CREATOR STUDIO ---
function registerCreatorEvents() {
  document.getElementById('creatorAppendQuestionBtn').onclick = () => {
    const text = document.getElementById('qFormText').value.trim();
    const a = document.getElementById('qFormOptA').value.trim();
    const b = document.getElementById('qFormOptB').value.trim();
    if (!text || !a || !b) return displayToast("Question and at least Options A & B required.", "error");

    const sanitize = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    state.creatorQuestions.push({ 
        text: sanitize(text), a: sanitize(a), b: sanitize(b), 
        c: sanitize(document.getElementById('qFormOptC').value.trim()), 
        d: sanitize(document.getElementById('qFormOptD').value.trim()), 
        answer: document.getElementById('qFormAnswer').value 
    });
    
    document.getElementById('pendingQuestionsCount').textContent = state.creatorQuestions.length;
    document.querySelectorAll('#creatorQuestionForm input[type="text"]').forEach(i=>i.value='');
    displayToast("Question added to draft.", "success");
  };

  document.getElementById('creatorToWorkspaceBtn').onclick = () => {
    const title = document.getElementById('creatorQuizTitle').value.trim() || "New Examination";
    if (state.creatorQuestions.length === 0) return displayToast("Cannot save an empty quiz.", "error");

    const newQuiz = { 
        id: `QZ-${Date.now()}`, title, 
        metaClass: document.getElementById('creatorClass').value.trim(),
        subject: document.getElementById('creatorSubject').value.trim(),
        questions: [...state.creatorQuestions]
    };
    
    state.quizzes.push(newQuiz);
    state.creatorQuestions = []; 
    document.getElementById('pendingQuestionsCount').textContent = '0';
    document.getElementById('creatorQuizTitle').value = '';
    
    saveLocalState();
    displayToast("Quiz saved successfully!", "success");
    switchViewport('homeSection');
  };
}

// --- STUDENT RUNNER ---
function launchLiveQuizRunner(asset, durationMins) {
  state.activeQuiz = asset;
  state.activeQuestions = asset.questions || [];
  state.currentQuestionIndex = 0;
  state.userAnswers = {};
  state.runnerElapsedSeconds = 0;
  
  if(state.runnerTimerId) clearInterval(state.runnerTimerId);
  
  document.getElementById('runnerQuizTitle').textContent = asset.title;
  document.getElementById('runnerCandidateBadge').textContent = `Candidate: ${state.studentMeta.name}`;
  
  switchViewport('quizSection');
  renderActiveQuestion();
  
  state.runnerTimerId = setInterval(() => {
    state.runnerElapsedSeconds++;
    const m = String(Math.floor(state.runnerElapsedSeconds/60)).padStart(2,'0');
    const s = String(state.runnerElapsedSeconds%60).padStart(2,'0');
    document.getElementById('runnerTimer').textContent = `Elapsed: ${m}:${s}`;
  }, 1000);
}

function renderActiveQuestion() {
  const q = state.activeQuestions[state.currentQuestionIndex];
  document.getElementById('runnerQuestionMeta').textContent = `Question ${state.currentQuestionIndex + 1} of ${state.activeQuestions.length}`;
  document.getElementById('runnerQuestionText').innerHTML = q.text; 
  
  const prog = ((state.currentQuestionIndex + 1) / state.activeQuestions.length) * 100;
  document.getElementById('runnerProgressBar').style.width = `${prog}%`;
  
  document.getElementById('runnerOptionsGrid').innerHTML = ['A','B','C','D'].filter(opt=>q[opt.toLowerCase()]).map(opt=>`
    <div class="glass-card option-card" style="padding:14px; cursor:pointer; border:2px solid ${state.userAnswers[state.currentQuestionIndex]===opt?'var(--primary)':'var(--border)'}; background:${state.userAnswers[state.currentQuestionIndex]===opt?'var(--primary-light)':'transparent'}" onclick="window.appEngineAPI.selectAnswer('${opt}')">
      <b>${opt}:</b> <span>${q[opt.toLowerCase()]}</span>
    </div>
  `).join('');
  
  const isLast = state.currentQuestionIndex === state.activeQuestions.length - 1;
  document.getElementById('runnerPrevBtn').disabled = state.currentQuestionIndex === 0;
  document.getElementById('runnerNextBtn').classList.toggle('hidden', isLast);
  document.getElementById('runnerSubmitBtn').classList.toggle('hidden', !isLast);

  updateCloudParticipantProgress('answering');
}

document.getElementById('runnerSubmitBtn').onclick = () => {
  if(state.runnerTimerId) clearInterval(state.runnerTimerId);
  let correct = 0;
  
  state.activeQuestions.forEach((q, i) => { 
      if (state.userAnswers[i] === (q.answer||'A')) correct++;
  });
  
  const total = state.activeQuestions.length;
  const perc = Math.round((correct / total) * 100);
  
  // Format MM:SS for completion time display
  const m = String(Math.floor(state.runnerElapsedSeconds/60)).padStart(2,'0');
  const s = String(state.runnerElapsedSeconds%60).padStart(2,'0');
  const timeStr = `${m}:${s}`;
  
  updateCloudParticipantProgress('submitted', correct, timeStr);

  // Store final submission locally in student's device for PDF generation
  state.submissions.push({
      examId: state.activeQuiz.id, studentName: state.studentMeta.name,
      rollNo: state.studentMeta.rollNo || '-', correct, wrong: total - correct, total, perc, time: timeStr
  });
  
  document.getElementById('reviewScoreText').textContent = `${correct} / ${total}`;
  document.getElementById('reviewPercentageText').textContent = `${perc}%`;
  document.getElementById('reviewTimeText').textContent = timeStr;
  
  const pfBadge = document.getElementById('passFailText');
  pfBadge.textContent = perc >= 40 ? "PASS" : "FAIL";
  pfBadge.style.color = perc >= 40 ? "var(--success)" : "var(--danger)";
  pfBadge.style.background = perc >= 40 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
  
  switchViewport('reviewSection');
};


// --- STATE MANAGEMENT ---
function saveLocalState() {
  const safeData = { quizzes: state.quizzes, scheduled: state.scheduledExams };
  localStorage.setItem('QMP_STATE', JSON.stringify(safeData));
  renderDashboardData(); populateSelects();
}

async function loadAndMigrateCloudState() {
  try {
      const raw = localStorage.getItem('QMP_STATE');
      if (raw) {
          const cached = JSON.parse(raw);
          state.quizzes = Array.isArray(cached.quizzes) ? cached.quizzes : [];
          state.scheduledExams = Array.isArray(cached.scheduled) ? cached.scheduled : [];
      }
  } catch(e) {}
  renderDashboardData(); populateSelects();
}

function renderDashboardData() {
  document.getElementById('statTotalQuizzes').textContent = state.quizzes.length;
  document.getElementById('statTotalScheduled').textContent = state.scheduledExams.length;
  
  const calBox = document.getElementById('dashboardCalendarList');
  if(state.scheduledExams.length === 0) {
    calBox.innerHTML = `<div class="empty-state-msg"><p>No scheduled examinations.</p><button class="btn-sm btn-primary mt-10" onclick="window.appEngineAPI.openScheduler()">Schedule Exam</button></div>`;
  } else {
    calBox.innerHTML = state.scheduledExams.map(s => `
      <div class="agenda-item">
        <div class="agenda-date">${new Date(s.date).toLocaleDateString('en-GB',{month:'short',day:'numeric'})}</div>
        <div class="agenda-body" style="flex:1;">
            <strong style="display:block; margin-bottom:4px;">${s.title}</strong>
            <p style="font-size:0.8rem; color:var(--text-light); margin:0;">${s.time} | <b>${s.status.toUpperCase()}</b></p>
            <div style="margin-top:8px; display:flex; align-items:center; gap:8px;">
                <span style="background:var(--primary-light); color:var(--primary-dark); padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.85rem;">PIN: ${s.pin}</span>
            </div>
        </div>
        <!-- Teacher Manual Control to START the exam -->
        <button class="btn-sm btn-success" onclick="window.appEngineAPI.launchScheduled('${s.pin}', '${s.examId}', '${s.duration}')"><i class="ri-play-fill"></i> Start Live</button>
        <button class="btn-sm btn-icon btn-danger" onclick="window.appEngineAPI.deleteSchedule('${s.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>`
    ).join('');
  }
}

function populateSelects() {
  const opts = '<option value="">-- Select Exam / Assessment --</option>' + state.quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('');
  document.getElementById('liveSetupQuizSelect').innerHTML = opts;
  document.getElementById('schedQuizSelect').innerHTML = opts;
}

// --- GLOBAL API & ROUTING ---
function switchViewport(targetId) {
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(targetId).classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('data-target')===targetId));
  window.scrollTo({top:0, behavior: 'smooth'});
}

function registerNavigationEvents() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => { e.preventDefault(); switchViewport(link.getAttribute('data-target')); };
  });
  document.getElementById('sidebarToggle').onclick = () => {
    document.getElementById('appSidebar').classList.toggle('hidden');
    document.querySelector('.main-content').classList.toggle('expanded');
  };
  document.getElementById('runnerNextBtn').onclick = () => { if(state.currentQuestionIndex < state.activeQuestions.length - 1) { state.currentQuestionIndex++; renderActiveQuestion(); } };
  document.getElementById('runnerPrevBtn').onclick = () => { if(state.currentQuestionIndex > 0) { state.currentQuestionIndex--; renderActiveQuestion(); } };
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

window.appEngineAPI = {
  switchContext: switchViewport, displayToast,
  toggleCreatorTab: (tab) => {
    document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab !== 'manual');
    document.getElementById('creatorExcelForm').classList.toggle('hidden', tab !== 'excel');
    document.getElementById('tabManual').classList.toggle('active', tab === 'manual');
    document.getElementById('tabExcel').classList.toggle('active', tab === 'excel');
  },
  selectAnswer: (opt) => { state.userAnswers[state.currentQuestionIndex] = opt; renderActiveQuestion(); },
  openScheduler: () => { populateSelects(); document.getElementById('scheduleModal').classList.remove('hidden'); },
  closeScheduler: () => document.getElementById('scheduleModal').classList.add('hidden'),
  
  saveSchedule: async () => {
    const sel = document.getElementById('schedQuizSelect');
    if(!sel.value) return displayToast("Select an exam to schedule.", "error");
    
    const quiz = state.quizzes.find(q => q.id === sel.value);
    const date = document.getElementById('schedDate').value;
    const time = document.getElementById('schedTime').value;
    const duration = document.getElementById('schedDuration').value;
    
    if(!date || !time) return displayToast("Date and Time are required.", "error");
    
    const pin = `TN${Math.floor(1000 + Math.random() * 9000)}`;
    const newSchedule = { id:`SCH-${Date.now()}`, examId: sel.value, title: quiz.title, date, time, duration, status: 'scheduled', pin: pin };
    state.scheduledExams.push(newSchedule);
    
    // Securely Sync Room to Firebase in 'scheduled' state so students can wait
    if (db) {
        try {
            await setDoc(doc(db, "live_rooms", pin), { 
                pinCode: pin, status: "scheduled", sourceQuizId: quiz.id, durationMinutes: parseInt(duration),
                participants: [],
                quizData: quiz // Ensures questions are securely available to students
            }); 
        } catch(e) { console.error("Could not sync schedule to cloud", e); }
    }

    saveLocalState();
    window.appEngineAPI.closeScheduler();
    displayToast("Exam Scheduled! Students can join and wait.", "success");
  },
  
  deleteSchedule: (id) => {
      if(confirm("Cancel this scheduled exam?")) {
          state.scheduledExams = state.scheduledExams.filter(s => s.id !== id);
          saveLocalState();
      }
  },

  // Manual Trigger to start a scheduled exam
  launchScheduled: async (pin, examId, duration) => {
      if(!db) return displayToast("Firebase required to launch.", "error");
      try {
          await updateDoc(doc(db, "live_rooms", pin), { status: "active" });
          
          const quiz = state.quizzes.find(q => q.id === examId);
          state.liveRoom = { active: true, pin, title: quiz.title, durationMinutes: duration, elapsedSeconds: 0, participants: [], sourceQuizId: examId };

          document.getElementById('liveRoomActiveContainer').classList.remove('hidden');
          document.getElementById('liveHostPinCode').textContent = pin;
          document.getElementById('liveHostExamTitle').textContent = quiz.title;
          
          switchViewport('liveQuizSection');
          displayToast("Exam Started! Students are now unblocked.", "success");

          // Start Host Timer and Monitor Listener
          onSnapshot(doc(db, "live_rooms", pin), (docSnap) => {
              if(docSnap.exists()) {
                  state.liveRoom.participants = docSnap.data().participants || [];
                  renderProctoringTable();
              }
          });
          state.liveRoom.timerId = setInterval(() => {
            state.liveRoom.elapsedSeconds++;
            const m = String(Math.floor(state.liveRoom.elapsedSeconds/60)).padStart(2,'0');
            const s = String(state.liveRoom.elapsedSeconds%60).padStart(2,'0');
            document.getElementById('liveHostTimer').textContent = `${m}:${s}`;
          }, 1000);

      } catch(e) {
          console.error(e);
          displayToast("Failed to launch.", "error");
      }
  },

  // Instant Student PDF Logic
  downloadStudentMarksheet: async () => {
      if(!window.jspdf) return displayToast("PDF engine initializing...", "error");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.text("STUDENT EXAM MARKSHEET", 105, 30, { align: "center" });
      
      const sub = state.submissions[state.submissions.length - 1]; // Current submission
      if(!sub) return displayToast("Data missing.", "error");

      doc.setFontSize(14); doc.setFont("helvetica", "normal");
      doc.text(`Candidate Name: ${state.studentMeta.name}`, 20, 50);
      doc.text(`Roll Number: ${state.studentMeta.rollNo || '-'}`, 20, 60);
      doc.text(`Exam Title: ${state.activeQuiz.title}`, 20, 70);
      
      doc.setLineWidth(0.5); doc.line(20, 75, 190, 75);
      
      doc.text(`Marks Secured: ${sub.correct} / ${sub.total}`, 20, 90);
      doc.text(`Percentage: ${sub.perc}%`, 20, 100);
      doc.text(`Completion Time: ${sub.time}`, 20, 110);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(sub.perc >= 40 ? 16 : 239, sub.perc >= 40 ? 185 : 68, sub.perc >= 40 ? 129 : 68);
      doc.text(`RESULT: ${sub.perc >= 40 ? 'PASS' : 'FAIL'}`, 20, 130);
      
      doc.save(`${state.studentMeta.name.replace(/\s+/g, '_')}_Marksheet.pdf`);
      displayToast("Marksheet Downloaded", "success");
  },
  
  downloadStudentResponse: async () => {
      if(!window.jspdf) return displayToast("PDF engine initializing...", "error");
      displayToast("Generating Full Response Sheet...", "info");
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      let y = 20;

      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text("EXAM RESPONSE SHEET", 105, y, { align: "center" }); y += 15;
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      doc.text(`Candidate: ${state.studentMeta.name} | Exam: ${state.activeQuiz.title}`, 20, y); y += 15;

      state.activeQuestions.forEach((q, i) => {
          if (y > 270) { doc.addPage(); y = 20; }
          const chosen = state.userAnswers[i] || 'None';
          const correct = q.answer || 'A';
          const isCorrect = chosen === correct;

          doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0);
          doc.text(`Q${i+1}. ${q.text.replace(/<[^>]+>/g, '')}`, 20, y); y += 8; // Strip HTML logic purely for PDF readability
          
          doc.setFont("helvetica", "normal");
          doc.text(`Your Answer: Option ${chosen} - ${q[chosen.toLowerCase()] || ''}`, 25, y); y += 7;
          
          if (!isCorrect) {
              doc.setTextColor(220, 38, 38);
              doc.text(`Correct Answer: Option ${correct} - ${q[correct.toLowerCase()] || ''}`, 25, y); y += 7;
          }
          
          doc.setFont("helvetica", "bold");
          doc.setTextColor(isCorrect ? 16 : 220, isCorrect ? 185 : 38, isCorrect ? 129 : 38);
          doc.text(`Marks: ${isCorrect ? '+1 Correct' : '0 Wrong'}`, 25, y); y += 12;
      });

      doc.save(`${state.studentMeta.name.replace(/\s+/g, '_')}_Response_Sheet.pdf`);
      displayToast("Response Sheet Downloaded", "success");
  }
};