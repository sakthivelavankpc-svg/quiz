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
  liveRoom: { active: false, sessionId: '', pin: '', title: '', durationMinutes: 60, participants: [], sourceQuizId: null },
  activeQuiz: null, activeQuestions: [], userAnswers: {}, currentQuestionIndex: 0,
  runnerTimerId: null, deadlineAt: 0, heartbeatTimerId: null,
  studentMeta: { name: '', rollNo: '', school: '', pin: '', participantId: '', sessionId: '' },
  creatorQuestions: [], tutStep: 1,
  activeLandingSchedule: null, activeLandingAssessment: null
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

  await loadAndMigrateCloudState();

  const urlParams = new URLSearchParams(window.location.search);
  const examCode = urlParams.get('exam'); // Scheduled Exam URL
  const assessmentCode = urlParams.get('assessment'); // Independent Library Play URL
  const pinFromUrl = urlParams.get('pin'); // Legacy PIN join

  if (examCode || assessmentCode) {
    document.getElementById('welcomeGate').classList.add('hidden');
    handleUrlRouting(examCode, assessmentCode);
  } else if (pinFromUrl) {
    document.getElementById('studentPinInput').value = pinFromUrl;
    await checkPersistedSession();
  } else {
    await checkPersistedSession();
  }

  setInterval(checkAutoOpenSchedules, 10000); // Check every 10s
});

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

function registerAuthEvents() {
  document.getElementById('btnEnterGuest').onclick = () => authorizeSession({ uid: 'GUEST', role: 'guest', name: 'Guest' });
  document.getElementById('btnLogin').onclick = () => authorizeSession({ uid: 'TEACHER', role: 'teacher', name: 'Educator' }); 
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
  document.getElementById('examLandingGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('welcomeUserName').textContent = profile.name;
  
  if(!localStorage.getItem('hasSeenTutorial') && profile.role !== 'guest') {
    window.appEngineAPI.startTutorial();
  }
}

// --- URL ROUTING (SCHEDULED & ASSESSMENT LINKS) ---
async function handleUrlRouting(examCode, assessmentCode) {
  const landingGate = document.getElementById('examLandingGate');
  landingGate.classList.remove('hidden');
  
  if (examCode) {
    let schedule = state.scheduledExams.find(s => s.scheduleId === examCode);
    if (!schedule && db) {
        try {
            const snap = await getDoc(doc(db, "scheduled_exams", examCode));
            if (snap.exists()) schedule = snap.data();
        } catch(e) {}
    }
    if (!schedule) {
        document.getElementById('landingStatusMessage').textContent = "Invalid or expired exam link.";
        document.getElementById('landingStatusMessage').classList.remove('hidden');
        return;
    }
    
    state.activeLandingSchedule = schedule;
    document.getElementById('landingExamTitle').textContent = schedule.title;
    document.getElementById('landingExamMeta').textContent = `Class: ${schedule.class || '-'} | Duration: ${schedule.durationMinutes} mins`;
    
    updateLandingCountdown();
    setInterval(updateLandingCountdown, 1000);

    document.getElementById('btnLandingStartExam').onclick = async () => {
        const name = document.getElementById('landingNameInput').value.trim();
        const roll = document.getElementById('landingRollInput').value.trim();
        if(!name) return displayToast("Name is required", "error");
        
        let qz = state.quizzes.find(q => q.id === schedule.examId);
        if(!qz && db) {
            const qs = await getDoc(doc(db, "quizzes", schedule.examId));
            if(qs.exists()) qz = qs.data();
        }
        if(!qz) return displayToast("Exam data not found.", "error");

        startParticipantSession(name, roll, schedule.scheduleId, qz, schedule.durationMinutes);
    };

  } else if (assessmentCode) {
    let qz = state.quizzes.find(q => q.id === assessmentCode);
    if (!qz && db) {
        try {
            const snap = await getDoc(doc(db, "quizzes", assessmentCode));
            if (snap.exists()) qz = snap.data();
        } catch(e) {}
    }
    if (!qz) {
        document.getElementById('landingStatusMessage').textContent = "Invalid assessment link.";
        document.getElementById('landingStatusMessage').classList.remove('hidden');
        return;
    }
    
    state.activeLandingAssessment = qz;
    document.getElementById('landingExamTitle').textContent = qz.title;
    document.getElementById('landingExamMeta').textContent = `Practice Assessment | ${qz.questions.length} Questions`;
    document.getElementById('landingJoinForm').classList.remove('hidden');
    
    document.getElementById('btnLandingStartExam').onclick = () => {
        const name = document.getElementById('landingNameInput').value.trim();
        const roll = document.getElementById('landingRollInput').value.trim();
        if(!name) return displayToast("Name is required", "error");
        
        const sessionId = "PRAC-" + Date.now(); 
        startParticipantSession(name, roll, sessionId, qz, 60);
    };
  }
}

function updateLandingCountdown() {
    if (!state.activeLandingSchedule) return;
    const s = state.activeLandingSchedule;
    const now = Date.now();
    
    const dStr = new Date(s.scheduledStartAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    const tStr = new Date(s.scheduledStartAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
    document.getElementById('landingScheduledTimeText').textContent = `Scheduled: ${dStr} at ${tStr}`;

    if (now < s.scheduledStartAt) {
        document.getElementById('landingCountdownBox').classList.remove('hidden');
        document.getElementById('landingJoinForm').classList.add('hidden');
        
        const diff = s.scheduledStartAt - now;
        document.getElementById('cdDays').textContent = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(2, '0');
        document.getElementById('cdHours').textContent = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
        document.getElementById('cdMins').textContent = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0');
        document.getElementById('cdSecs').textContent = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
    } else if (now >= s.scheduledStartAt && now <= s.scheduledEndAt) {
        document.getElementById('landingCountdownBox').classList.add('hidden');
        document.getElementById('landingJoinForm').classList.remove('hidden');
    } else {
        document.getElementById('landingCountdownBox').classList.add('hidden');
        document.getElementById('landingJoinForm').classList.add('hidden');
        document.getElementById('landingStatusMessage').textContent = "EXAM CLOSED";
        document.getElementById('landingStatusMessage').classList.remove('hidden');
    }
}

async function handleStudentLiveJoin() {
  const pin = document.getElementById('studentPinInput').value.trim().toUpperCase();
  const name = document.getElementById('studentNameInput').value.trim();
  const rollNo = document.getElementById('studentRollInput').value.trim();
  
  if (!pin || !name) return displayToast("Exam PIN and Name are required.", "error");

  let targetRoom = null;
  if(db) {
    try {
        const snap = await getDocs(query(collection(db, "live_rooms"), where("pinCode", "==", pin)));
        if(!snap.empty) targetRoom = snap.docs[0].data();
    } catch(e) { console.warn("Firebase fetch failed"); }
  }

  if (!targetRoom) {
      return displayToast("PIN invalid or exam is not currently active.", "error");
  }

  let quizAsset = state.quizzes.find(q => q.id === targetRoom.sourceQuizId);
  if(!quizAsset && db) {
      const qSnap = await getDoc(doc(db, "quizzes", targetRoom.sourceQuizId));
      if(qSnap.exists()) quizAsset = qSnap.data();
  }
  
  if(!quizAsset) return displayToast("Exam data unavailable.", "error");

  startParticipantSession(name, rollNo, targetRoom.sessionId, quizAsset, targetRoom.durationMinutes);
}

// --- CORE PARTICIPANT SESSION & AUTO-SAVE ---
async function startParticipantSession(name, rollNo, sessionId, quizAsset, durationMins) {
    const participantId = `P-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
    
    state.studentMeta = { name, rollNo, participantId, sessionId, startTime: Date.now() };
    state.activeQuiz = quizAsset;
    state.activeQuestions = quizAsset.questions || [];
    state.currentQuestionIndex = 0;
    state.userAnswers = {};
    
    const durationMs = durationMins * 60 * 1000;
    state.deadlineAt = Date.now() + durationMs;

    // Check offline resume
    const localRes = localStorage.getItem(`QMP_RESUME_${sessionId}`);
    if (localRes) {
        const resData = JSON.parse(localRes);
        if (resData.deadlineAt > Date.now()) {
            state.userAnswers = resData.answers || {};
            state.deadlineAt = resData.deadlineAt;
            state.studentMeta.participantId = resData.participantId;
        }
    }

    if(db) {
        try {
            await setDoc(doc(db, `exam_sessions/${sessionId}/participants`, state.studentMeta.participantId), {
                name, rollNo, 
                status: 'answering', 
                currentQuestion: 1, 
                lastSeenAt: Date.now(),
                score: 0,
                joinedAt: state.studentMeta.startTime
            }, { merge: true });
        } catch(e) { console.warn("Could not register participant to cloud"); }
    }

    document.getElementById('examLandingGate').classList.add('hidden');
    document.getElementById('welcomeGate').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    
    document.getElementById('runnerQuizTitle').textContent = quizAsset.title;
    document.getElementById('runnerCandidateBadge').textContent = `Candidate: ${name}`;
    
    switchViewport('quizSection');
    renderActiveQuestion();
    
    if(state.runnerTimerId) clearInterval(state.runnerTimerId);
    if(state.heartbeatTimerId) clearInterval(state.heartbeatTimerId);

    state.runnerTimerId = setInterval(updateRunnerTimer, 1000);
    state.heartbeatTimerId = setInterval(sendHeartbeat, 5000);
}

function updateRunnerTimer() {
    const remaining = Math.max(0, state.deadlineAt - Date.now());
    
    const h = String(Math.floor(remaining / (1000 * 60 * 60))).padStart(2,'0');
    const m = String(Math.floor((remaining / 1000 / 60) % 60)).padStart(2,'0');
    const s = String(Math.floor((remaining / 1000) % 60)).padStart(2,'0');
    
    document.getElementById('runnerTimer').textContent = `${h}:${m}:${s}`;
    
    if (remaining <= 0) {
        clearInterval(state.runnerTimerId);
        displayToast("Time Expired! Auto-submitting...", "warning");
        submitExam(true);
    }
}

async function sendHeartbeat() {
    if(!db || !state.studentMeta.sessionId) return;
    try {
        await updateDoc(doc(db, `exam_sessions/${state.studentMeta.sessionId}/participants`, state.studentMeta.participantId), {
            lastSeenAt: Date.now()
        });
    } catch(e) {}
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
  const isFirst = state.currentQuestionIndex === 0;
  
  document.getElementById('runnerPrevBtn').disabled = isFirst;
  document.getElementById('runnerNextBtn').classList.toggle('hidden', isLast);
  document.getElementById('runnerSubmitBtn').classList.toggle('hidden', !isLast);
}

window.appEngineAPI.selectAnswer = async (opt) => {
    state.userAnswers[state.currentQuestionIndex] = opt;
    renderActiveQuestion();

    // Local Auto-save
    localStorage.setItem(`QMP_RESUME_${state.studentMeta.sessionId}`, JSON.stringify({
        answers: state.userAnswers,
        deadlineAt: state.deadlineAt,
        participantId: state.studentMeta.participantId
    }));

    // Cloud Auto-save
    if(db) {
        try {
            await setDoc(doc(db, `exam_sessions/${state.studentMeta.sessionId}/answers`, `${state.studentMeta.participantId}_Q${state.currentQuestionIndex}`), {
                participantId: state.studentMeta.participantId,
                questionIndex: state.currentQuestionIndex,
                selectedAnswer: opt,
                answeredAt: Date.now()
            });
            await updateDoc(doc(db, `exam_sessions/${state.studentMeta.sessionId}/participants`, state.studentMeta.participantId), {
                currentQuestion: state.currentQuestionIndex + 1,
                lastSeenAt: Date.now()
            });
        } catch(e) {}
    }
};

document.getElementById('runnerSubmitBtn').onclick = () => submitExam(false);

async function submitExam(isAutoSubmit = false) {
  if(state.runnerTimerId) clearInterval(state.runnerTimerId);
  if(state.heartbeatTimerId) clearInterval(state.heartbeatTimerId);
  
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  
  state.activeQuestions.forEach((q, i) => { 
      const ans = state.userAnswers[i];
      if (ans) {
          if (ans === (q.answer||'A')) correct++;
          else wrong++;
      } else {
          unanswered++;
      }
  });
  
  const total = state.activeQuestions.length;
  const perc = Math.round((correct / total) * 100);
  
  const elapsedMs = Date.now() - state.studentMeta.startTime;
  const m = String(Math.floor(elapsedMs / 60000)).padStart(2,'0');
  const s = String(Math.floor((elapsedMs % 60000)/1000)).padStart(2,'0');
  const timeStr = `${m}:${s}`;
  
  const submissionData = {
      examId: state.activeQuiz.id,
      sessionId: state.studentMeta.sessionId,
      participantId: state.studentMeta.participantId,
      studentName: state.studentMeta.name,
      rollNo: state.studentMeta.rollNo || '-',
      correct, wrong, unanswered, total, perc, time: timeStr,
      status: isAutoSubmit ? 'time_expired' : 'submitted',
      submittedAt: Date.now()
  };

  state.submissions.push(submissionData);
  saveLocalState();
  localStorage.removeItem(`QMP_RESUME_${state.studentMeta.sessionId}`);

  if(db) {
      try {
          await setDoc(doc(db, "submissions", submissionData.participantId), submissionData);
          await updateDoc(doc(db, `exam_sessions/${state.studentMeta.sessionId}/participants`, state.studentMeta.participantId), {
              status: submissionData.status,
              score: correct,
              completionTime: timeStr,
              lastSeenAt: Date.now()
          });
      } catch(e) {}
  }

  // Calculate Rank instantly from available submissions
  let allSubs = state.submissions.filter(s => s.examId === state.activeQuiz.id).sort((a,b) => b.correct - a.correct);
  let rank = 1;
  let myRank = '-';
  for (let i = 0; i < allSubs.length; i++) {
      if (i > 0 && allSubs[i].correct < allSubs[i-1].correct) rank = i + 1;
      if (allSubs[i].participantId === state.studentMeta.participantId) { myRank = rank; break; }
  }

  document.getElementById('reviewScoreText').textContent = `${correct} / ${total}`;
  document.getElementById('reviewPercentageText').textContent = `${perc}%`;
  document.getElementById('reviewTimeText').textContent = timeStr;
  document.getElementById('reviewRankText').textContent = myRank;
  
  const pfBadge = document.getElementById('passFailText');
  pfBadge.textContent = perc >= 40 ? "PASS" : "FAIL";
  pfBadge.style.color = perc >= 40 ? "var(--success)" : "var(--danger)";
  pfBadge.style.background = perc >= 40 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";

  document.getElementById('btnDownloadIndividualResult').onclick = () => generateRobustPDF('marksheet', state.activeQuiz.id, submissionData, myRank);
  
  switchViewport('reviewSection');
}

// --- LIVE ROOM (TEACHER / HOST) ---
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
  if(!quiz) return displayToast("Please select a valid exam.", "error");
  if(!quiz.questions || quiz.questions.length === 0) return displayToast("Selected exam has no questions.", "error");

  const pin = `TN${Math.floor(1000 + Math.random() * 9000)}`;
  const duration = parseInt(document.getElementById('liveSetupDuration').value) || 60;
  const sessionId = `LIVE-${Date.now()}`;
  
  state.liveRoom = { 
      active: true, sessionId, pin, title: quiz.title, durationMinutes: duration, 
      participants: [], sourceQuizId: quiz.id 
  };

  document.getElementById('liveSetupPanel').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.remove('hidden');
  document.getElementById('liveHostPinCode').textContent = pin;
  document.getElementById('liveHostExamTitle').textContent = state.liveRoom.title;
  document.getElementById('globalLiveBadge').classList.remove('hidden');

  const joinUrl = window.location.origin + window.location.pathname + "?pin=" + pin;
  
  document.getElementById('liveHostShareUrl').innerHTML = `Link: <a href="${joinUrl}" target="_blank" style="color:var(--primary);text-decoration:none;font-weight:bold;">${joinUrl}</a> <i class="ri-clipboard-line" style="cursor:pointer; margin-left:8px; font-size:1.1rem;" title="Copy Link" onclick="window.appEngineAPI.displayToast('Link Copied!', 'success'); navigator.clipboard.writeText('${joinUrl}')"></i>`;
  
  const qrBox = document.getElementById('liveRoomQrBox');
  qrBox.innerHTML = '';
  new QRCode(qrBox, { text: joinUrl, width: 100, height: 100 });
  qrBox.onclick = () => {
      const cvs = qrBox.querySelector('canvas');
      if(cvs) {
          const a = document.createElement('a');
          a.href = cvs.toDataURL("image/png");
          a.download = `Exam_QR_${pin}.png`;
          a.click();
      }
  };

  renderProctoringTable(); 

  if (db) {
      try { 
          setDoc(doc(db, "live_rooms", pin), { 
              sessionId, pinCode: pin, status: "active", sourceQuizId: quiz.id, durationMinutes: duration,
              createdAt: Date.now()
          }); 
          
          onSnapshot(collection(db, `exam_sessions/${sessionId}/participants`), (snap) => {
              state.liveRoom.participants = snap.docs.map(d => ({id: d.id, ...d.data()}));
              renderProctoringTable();
          });
      } 
      catch(e) { console.warn("Firebase unreachable, running locally."); }
  }
  
  const startTime = Date.now();
  setInterval(() => {
    const el = Math.floor((Date.now() - startTime)/1000);
    const m = String(Math.floor(el/60)).padStart(2,'0');
    const s = String(el%60).padStart(2,'0');
    if(document.getElementById('liveHostTimer')) document.getElementById('liveHostTimer').textContent = `${m}:${s}`;
  }, 1000);
  
  displayToast("Live Exam Room Opened Successfully!", "success");
}

function concludeLiveExam() {
  state.liveRoom.active = false;
  document.getElementById('globalLiveBadge').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.add('hidden');
  switchViewport('homeSection');
  displayToast("Live Exam Concluded.", "info");
}

function renderProctoringTable() {
  const tbody = document.getElementById('liveParticipantsTableBody');
  document.getElementById('liveStatJoined').textContent = state.liveRoom.participants.length;
  document.getElementById('liveStatCompleted').textContent = state.liveRoom.participants.filter(p=>p.status==='submitted' || p.status==='time_expired').length;
  
  let answeringCount = 0;
  const now = Date.now();

  if(!state.liveRoom.participants.length) { 
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No students joined yet. Share the PIN or link.</td></tr>`; 
      document.getElementById('liveStatAnswering').textContent = 0;
      return; 
  }
  
  tbody.innerHTML = state.liveRoom.participants.map(p => {
    let displayStatus = p.status;
    let badgeClass = p.status;
    
    if (p.status === 'answering') {
        const isStale = (now - (p.lastSeenAt || now)) > 15000;
        if (isStale) {
            displayStatus = 'disconnected';
            badgeClass = 'disconnected';
        } else {
            answeringCount++;
        }
    }
    
    const lastSeenStr = p.lastSeenAt ? Math.floor((now - p.lastSeenAt)/1000) + 's ago' : '-';

    return `
    <tr>
      <td><span class="status-badge status-${badgeClass}">${displayStatus.toUpperCase()}</span></td>
      <td><strong>${p.name}</strong></td><td>${p.rollNo||'-'}</td>
      <td>Q${p.currentQuestion||1}</td><td><b>${p.score||0}</b></td>
      <td style="font-size:0.8rem; color:var(--text-light);">${['submitted','time_expired'].includes(p.status) ? 'Finished' : lastSeenStr}</td>
    </tr>
  `}).join('');
  
  document.getElementById('liveStatAnswering').textContent = answeringCount;
}

// --- CREATOR & GROUPS ---
function registerCreatorEvents() {
  document.getElementById('creatorAppendQuestionBtn').onclick = () => {
    const text = document.getElementById('qFormText').value.trim();
    if (!text) return displayToast("Question text is required.", "error");
    
    const a = document.getElementById('qFormOptA').value.trim();
    const b = document.getElementById('qFormOptB').value.trim();
    if(!a || !b) return displayToast("At least Option A and B are required.", "error");

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

  document.getElementById('excelFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if(!file) return;

      try {
          const data = await file.arrayBuffer();
          const wb = XLSX.read(data, { type: 'array' });
          if (wb.SheetNames.length === 0) return displayToast("File has no sheets.", "error");
          processWorksheet(wb.Sheets[wb.SheetNames[0]]);
      } catch(err) { displayToast("Failed to parse file.", "error"); } finally { e.target.value = ''; }
  });
  
  function processWorksheet(ws) {
      if(!ws || !ws['!ref']) return displayToast("Selected sheet is empty.", "error");
      const htmlStr = XLSX.utils.sheet_to_html(ws);
      const parser = new DOMParser();
      const rows = Array.from(parser.parseFromString(htmlStr, 'text/html').querySelectorAll('tr'));
      
      let headers = [];
      state.creatorQuestions = [];
      let validCount = 0;
      
      rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          let rowData = {};
          cells.forEach((cell, colIndex) => {
              let textContent = cell.textContent.trim();
              if (rowIndex === 0) headers[colIndex] = textContent.toLowerCase().replace(/\s+/g, '');
              else if (headers[colIndex]) rowData[headers[colIndex]] = textContent;
          });
          
          if (rowIndex > 0) {
              const text = rowData['question'] || rowData['questiontext'];
              const a = rowData['a'] || rowData['optiona'];
              const b = rowData['b'] || rowData['optionb'];
              const c = rowData['c'] || rowData['optionc'];
              const d = rowData['d'] || rowData['optiond'];
              const ansRaw = (rowData['answer'] || rowData['correctanswer'] || '').toUpperCase();
              let ans = ['A','B','C','D'].includes(ansRaw) ? ansRaw : 'A';
              
              if(text && a && b) {
                  state.creatorQuestions.push({ text, a, b, c, d, answer: ans });
                  validCount++;
              }
          }
      });
      
      document.getElementById('pendingQuestionsCount').textContent = state.creatorQuestions.length;
      displayToast(`Successfully imported ${validCount} questions.`, "success");
  }
  
  document.getElementById('creatorToWorkspaceBtn').onclick = async () => {
    const title = document.getElementById('creatorQuizTitle').value.trim() || "New Examination";
    const metaClass = document.getElementById('creatorClass').value.trim();
    const subject = document.getElementById('creatorSubject').value.trim();
    
    if (state.creatorQuestions.length === 0) return displayToast("Cannot save an empty quiz.", "error");

    const newQuiz = { 
        id: `QZ-${Date.now()}`, 
        title, metaClass, subject,
        questions: state.creatorQuestions
    };
    
    state.quizzes.push(newQuiz);
    if(db) { try { await setDoc(doc(db, "quizzes", newQuiz.id), newQuiz); } catch(e){} }
    
    state.creatorQuestions = []; 
    document.getElementById('pendingQuestionsCount').textContent = '0';
    document.getElementById('creatorQuizTitle').value = '';
    
    saveLocalState();
    displayToast("Quiz saved successfully!", "success");
    switchViewport('librarySection');
  };
}

function registerGroupEvents() {
  document.getElementById('groupCommitBtn').onclick = async () => {
    const title = document.getElementById('groupNameInput').value.trim();
    const selectedRefs = Array.from(document.querySelectorAll('.group-chk:checked')).map(c=>c.value);
    
    if(!title) return displayToast("Title required", "error");
    if(selectedRefs.length === 0) return displayToast("Select at least one quiz.", "error");

    let combinedQuestions = [];
    selectedRefs.forEach(id => {
        const sq = state.quizzes.find(q => q.id === id);
        if(sq && sq.questions) combinedQuestions = combinedQuestions.concat(sq.questions);
    });

    const combinedExam = { 
        id: `GRP-${Date.now()}`, 
        title, isGroup: true, sourceRefs: selectedRefs, questions: combinedQuestions
    };
    
    state.quizzes.push(combinedExam);
    if(db) { try { await setDoc(doc(db, "quizzes", combinedExam.id), combinedExam); } catch(e){} }
    saveLocalState();
    displayToast("Combined Exam Created", "success");
    switchViewport('librarySection');
  };
}

// --- PURE JSPDF ROBUST GENERATOR (NO HTML2CANVAS BUGS) ---
function registerPdfEvents() {
  document.getElementById('pdfSourceAssetSelect').addEventListener('change', (e) => {
      const qz = state.quizzes.find(q => q.id === e.target.value);
      if(qz) {
          document.getElementById('pdfClass').value = qz.metaClass || '';
          document.getElementById('pdfSubject').value = qz.subject || '';
      }
  });
  
  document.getElementById('pdfGenerateDownloadBtn').onclick = () => generateRobustPDF('question');
  document.getElementById('pdfGenerateKeyBtn').onclick = () => generateRobustPDF('key');
  document.getElementById('btnExportMarksheetPDF').onclick = () => generateRobustPDF('marksheet', document.getElementById('marksheetExamSelect').value);
}

async function generateRobustPDF(type, sourceId = null, individualSubmission = null, indRank = '-') {
  const assetId = sourceId || document.getElementById('pdfSourceAssetSelect').value;
  if(!assetId) return displayToast("Please select an exam first.", "error");
  
  const qz = state.quizzes.find(q => q.id === assetId);
  if(!qz && type !== 'marksheet') return displayToast("Assessment not found.", "error");
  if(!window.jspdf) return displayToast("PDF engine initializing...", "error");

  displayToast("Generating PDF robustly. Please wait...", "info");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 20;
  const margin = 15;
  const pageWidth = doc.internal.pageSize.width;
  const maxWidth = pageWidth - (margin * 2);

  const addText = (text, size, isBold, color=[0,0,0], align='left', indent=0) => {
     doc.setFontSize(size);
     doc.setFont("helvetica", isBold ? "bold" : "normal");
     doc.setTextColor(...color);
     const lines = doc.splitTextToSize(String(text), maxWidth - indent);
     if (y + (lines.length * 6) > 280) { doc.addPage(); y = 20; }
     doc.text(lines, align === 'center' ? pageWidth/2 : margin + indent, y, { align: align });
     y += lines.length * 6;
  };

  const school = document.getElementById('pdfSchoolHeaderInput')?.value || 'GOVERNMENT HIGH SCHOOL';

  if (type === 'question' || type === 'key') {
      addText(school, 16, true, [0,0,0], 'center');
      y += 5;
      addText(`EXAM: ${qz.title} | ${type === 'key' ? 'ANSWER KEY' : 'QUESTION PAPER'}`, 12, true, [0,0,0], 'center');
      y += 8;
      addText(`Class: ${qz.metaClass||'All'}   Subject: ${qz.subject||'All'}   Total Questions: ${qz.questions.length}`, 10, false, [50,50,50], 'center');
      y += 5; doc.setDrawColor(0); doc.line(margin, y, pageWidth-margin, y); y += 10;

      qz.questions.forEach((q, i) => {
          if (type === 'key') {
              addText(`${i+1}. ${q.text.replace(/<[^>]+>/g, '')}`, 11, true);
              addText(`Answer: [ ${q.answer||'A'} ]`, 11, true, [5, 150, 105], 'left', 10);
              y += 4;
          } else {
              addText(`${i+1}. ${q.text.replace(/<[^>]+>/g, '')}`, 11, true);
              addText(`(A) ${q.a}`, 10, false, [0,0,0], 'left', 10);
              addText(`(B) ${q.b}`, 10, false, [0,0,0], 'left', 10);
              if(q.c) addText(`(C) ${q.c}`, 10, false, [0,0,0], 'left', 10);
              if(q.d) addText(`(D) ${q.d}`, 10, false, [0,0,0], 'left', 10);
              y += 4;
          }
      });
      doc.save(`${qz.title.replace(/\s+/g, '_')}_${type.toUpperCase()}.pdf`);
  
  } else if (type === 'marksheet') {
      if (individualSubmission) {
          addText(school, 18, true, [0,0,0], 'center');
          y += 5; addText(`INDIVIDUAL EXAM MARKSHEET`, 14, true, [5,150,105], 'center');
          y += 5; addText(`Exam: ${qz.title}`, 12, false, [0,0,0], 'center');
          y += 10; doc.line(margin, y, pageWidth-margin, y); y += 10;
          
          addText(`Student Name: ${individualSubmission.studentName}`, 12, true);
          addText(`Roll Number: ${individualSubmission.rollNo}`, 12, false);
          y += 5;
          addText(`Total Questions: ${individualSubmission.total}`, 12, false);
          addText(`Correct Answers: ${individualSubmission.correct}`, 12, false, [5,150,105]);
          addText(`Wrong Answers: ${individualSubmission.wrong}`, 12, false, [239,68,68]);
          addText(`Unanswered: ${individualSubmission.unanswered}`, 12, false);
          y += 5;
          addText(`Marks Secured: ${individualSubmission.correct} / ${individualSubmission.total}`, 14, true);
          addText(`Percentage: ${individualSubmission.perc}%`, 14, true);
          addText(`Time Taken: ${individualSubmission.time}`, 12, false);
          addText(`Rank in Class: ${indRank}`, 14, true, [5,150,105]);
          y += 10; addText(`Result Status: ${individualSubmission.perc >= 40 ? 'PASS' : 'FAIL'}`, 14, true, individualSubmission.perc >= 40 ? [5,150,105] : [239,68,68]);
          
          doc.save(`${individualSubmission.studentName}_Marksheet.pdf`);
      } else {
          // Consolidated
          addText(school, 16, true, [0,0,0], 'center');
          y += 5; addText(`CONSOLIDATED MARKSHEET: ${qz.title}`, 12, true, [0,0,0], 'center');
          y += 10; doc.line(margin, y, pageWidth-margin, y); y += 10;
          
          const relevant = state.submissions.filter(s => s.examId === assetId).sort((a,b) => b.correct - a.correct);
          addText(`Total Participants: ${relevant.length}`, 11, true); y += 5;

          addText("Rank  |  Student Name  |  Score  |  %", 11, true);
          doc.line(margin, y, pageWidth-margin, y); y += 6;

          let rank = 1;
          for (let i = 0; i < relevant.length; i++) {
              if (i > 0 && relevant[i].correct < relevant[i-1].correct) rank = i + 1;
              addText(`#${rank}  |  ${relevant[i].studentName}  |  ${relevant[i].correct}/${relevant[i].total}  |  ${relevant[i].perc}%`, 10, false);
          }
          doc.save(`Consolidated_Marksheet_${qz.title.replace(/\s+/g, '_')}.pdf`);
      }
  }
}

// --- STATE MANAGEMENT & SCHEDULING ---
function saveLocalState() {
  const safeData = { quizzes: state.quizzes, scheduled: state.scheduledExams, submissions: state.submissions };
  localStorage.setItem('QMP_STATE', JSON.stringify(safeData));
  renderLibrary(); 
  renderDashboardData(); 
  populateSelects();
  populateResultSelects();
}

async function loadAndMigrateCloudState() {
  try {
      const raw = localStorage.getItem('QMP_STATE');
      if (raw) {
          const cached = JSON.parse(raw);
          state.quizzes = Array.isArray(cached.quizzes) ? cached.quizzes : [];
          state.scheduledExams = Array.isArray(cached.scheduled) ? cached.scheduled : [];
          state.submissions = Array.isArray(cached.submissions) ? cached.submissions : [];
      }
  } catch(e) {}
  
  if (db) {
      try {
          const qSnap = await getDocs(collection(db, "quizzes"));
          state.quizzes = qSnap.docs.map(d => d.data());
          const sSnap = await getDocs(collection(db, "scheduled_exams"));
          state.scheduledExams = sSnap.docs.map(d => d.data());
          const subSnap = await getDocs(collection(db, "submissions"));
          state.submissions = subSnap.docs.map(d => d.data());
      } catch(e) { console.warn("Offline, using local state"); }
  }

  renderDashboardData(); 
  renderLibrary();
  populateSelects();
  populateResultSelects();
}

function renderDashboardData() {
  document.getElementById('statTotalQuizzes').textContent = state.quizzes.length;
  document.getElementById('statTotalQuestions').textContent = state.quizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0);
  document.getElementById('statTotalScheduled').textContent = state.scheduledExams.length;
  document.getElementById('statTotalUsers').textContent = state.submissions.length;
  
  const calBox = document.getElementById('dashboardCalendarList');
  if(state.scheduledExams.length === 0) {
    calBox.innerHTML = `<div class="empty-state-msg"><p>You have no scheduled examinations.</p><button class="btn-sm btn-primary mt-10" onclick="window.appEngineAPI.openScheduler()">Schedule Exam</button></div>`;
  } else {
    const sorted = [...state.scheduledExams].sort((a,b) => a.scheduledStartAt - b.scheduledStartAt);
    calBox.innerHTML = sorted.map(s => {
      const sUrl = window.location.origin + window.location.pathname + "?exam=" + s.scheduleId;
      const d = new Date(s.scheduledStartAt);
      const isLive = Date.now() >= s.scheduledStartAt && Date.now() <= s.scheduledEndAt;
      const isCompleted = Date.now() > s.scheduledEndAt;

      return `
      <div class="agenda-item">
        <div class="agenda-date">${d.toLocaleDateString('en-GB',{month:'short',day:'numeric'})}</div>
        <div class="agenda-body" style="flex:1;">
            <strong style="display:block; margin-bottom:4px;">${s.title} ${isLive ? '<span style="color:var(--danger);font-size:0.7rem;">🔴 LIVE NOW</span>' : isCompleted ? '<span style="color:var(--success);font-size:0.7rem;">✓ COMPLETED</span>' : ''}</strong>
            <p style="font-size:0.8rem; color:var(--text-light); margin:0;">${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})} | ${s.durationMinutes} mins | Class: ${s.class||'All'}</p>
            <div style="margin-top:8px; display:flex; align-items:center; gap:8px;">
                <button class="btn-sm btn-primary" onclick="window.open('${sUrl}', '_blank')" title="Open Schedule">Open Schedule</button>
                <button class="btn-sm btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="navigator.clipboard.writeText('${sUrl}'); window.appEngineAPI.displayToast('Link Copied!', 'success')" title="Copy Link"><i class="ri-links-line"></i> Copy Link</button>
            </div>
        </div>
        <button class="btn-sm btn-icon btn-danger" onclick="window.appEngineAPI.deleteSchedule('${s.scheduleId}')" title="Cancel Schedule"><i class="ri-delete-bin-line"></i></button>
      </div>`
    }).join('');
  }
}

function populateSelects() {
  const opts = '<option value="">-- Select Exam / Assessment --</option>' + state.quizzes.map(q => `<option value="${q.id}">${q.title} (${q.questions?.length||0} Qs)</option>`).join('');
  if(document.getElementById('liveSetupQuizSelect')) document.getElementById('liveSetupQuizSelect').innerHTML = opts;
  if(document.getElementById('schedQuizSelect')) document.getElementById('schedQuizSelect').innerHTML = opts;
  if(document.getElementById('pdfSourceAssetSelect')) document.getElementById('pdfSourceAssetSelect').innerHTML = opts;
}

function populateResultSelects() {
  const opts = '<option value="">-- Select Exam --</option>' + state.quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('');
  
  const lSel = document.getElementById('leaderboardExamSelect');
  if(lSel) { lSel.innerHTML = opts; lSel.onchange = (e) => renderResultsTable(e.target.value, 'leaderboardTableBody'); }
  
  const mSel = document.getElementById('marksheetExamSelect');
  if(mSel) { mSel.innerHTML = opts; mSel.onchange = (e) => renderResultsTable(e.target.value, 'marksheetTableBody'); }
}

function renderResultsTable(examId, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if(!examId) { tbody.innerHTML = `<tr><td colspan="9" class="text-center">Select an exam to view results.</td></tr>`; return; }
    
    const relevant = state.submissions.filter(s => s.examId === examId).sort((a,b) => b.correct - a.correct);
    if(relevant.length === 0) { tbody.innerHTML = `<tr><td colspan="9" class="text-center">No submissions yet for this exam.</td></tr>`; return; }
    
    let rank = 1;
    tbody.innerHTML = relevant.map((s, i) => {
        if (i > 0 && relevant[i].correct < relevant[i-1].correct) rank = i + 1;
        return `
        <tr>
            <td><b>#${rank}</b></td>
            <td>${s.studentName}</td>
            <td>${s.rollNo}</td>
            <td><span style="color:var(--success)">${s.correct}</span></td>
            ${tbodyId==='marksheetTableBody'? `<td><span style="color:var(--danger)">${s.wrong}</span></td>` : ''}
            <td><b>${s.correct}</b></td>
            <td>${s.perc}%</td>
            <td>${s.time}</td>
            ${tbodyId==='marksheetTableBody'? `<td><span class="status-badge status-submitted">${(s.status||'submitted').toUpperCase()}</span></td>` : ''}
        </tr>
    `}).join('');
}

function checkAutoOpenSchedules() {
    renderDashboardData(); // Re-render handles live tags naturally based on timestamps
}

function renderLibrary() {
  const lib = document.getElementById('libraryContainer');
  if(state.quizzes.length === 0) {
      lib.innerHTML = '<div class="empty-state-msg" style="grid-column: 1 / -1;">No assessments saved yet. Head to Quiz Creator Studio.</div>';
      return;
  }
  
  lib.innerHTML = state.quizzes.map(q => {
    const pUrl = window.location.origin + window.location.pathname + "?assessment=" + q.id;
    return `
    <div class="glass-card library-card" style="display:flex; flex-direction:column; justify-content:space-between; padding:20px; border-left:4px solid ${q.isGroup ? 'var(--accent)' : 'var(--primary)'}; height:100%;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3 style="font-size:1.1rem; line-height:1.4; margin-bottom:6px;">${q.title}</h3>
            ${q.isGroup ? '<span style="font-size:0.7rem; background:var(--accent); color:white; padding:2px 6px; border-radius:4px;">COMBINED</span>' : ''}
        </div>
        <p class="subtext" style="font-size:0.85rem; margin-bottom:4px;">Class: ${q.metaClass || 'All'} | Subj: ${q.subject || 'All'}</p>
        <p class="subtext" style="font-size:0.85rem; font-weight:700; color:var(--text-main);"><i class="ri-file-list-3-line"></i> ${q.questions?.length || 0} Questions</p>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top: 16px; padding-top:16px; border-top:1px solid var(--border);">
          <button class="btn-sm btn-success" onclick="window.open('${pUrl}', '_blank')" style="flex:1;"><i class="ri-play-line"></i> Play Exam</button>
          <button class="btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${pUrl}'); window.appEngineAPI.displayToast('Share Link Copied', 'success')" title="Copy Share Link"><i class="ri-links-line"></i> Link</button>
          <button class="btn-sm btn-secondary" onclick="window.appEngineAPI.pdfFromLibrary('${q.id}')" title="PDF"><i class="ri-printer-line"></i></button>
          <button class="btn-sm btn-danger btn-icon" onclick="window.appEngineAPI.deleteQuiz('${q.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>
    </div>
  `}).join('');
  
  const gi = document.getElementById('groupInventoryContainer');
  if(gi) {
      gi.innerHTML = state.quizzes.filter(q => !q.isGroup).map(q => `
          <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px;">
              <input type="checkbox" value="${q.id}" class="group-chk" style="width:18px; height:18px; accent-color:var(--primary);"/> 
              <span style="font-size:0.9rem; font-weight:600;">${q.title}</span> 
              <span style="margin-left:auto; font-size:0.8rem; color:var(--text-light);">${q.questions?.length||0} Qs</span>
          </div>
      `).join('');
  }
}

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
  document.getElementById('globalStickyHomeBtn').onclick = () => switchViewport('homeSection');
  document.getElementById('sidebarToggle').onclick = () => {
    document.getElementById('appSidebar').classList.toggle('hidden');
    document.querySelector('.main-content').classList.toggle('expanded');
  };
  document.getElementById('runnerNextBtn').onclick = () => { if(state.currentQuestionIndex < state.activeQuestions.length - 1) { state.currentQuestionIndex++; renderActiveQuestion(); } };
  document.getElementById('runnerPrevBtn').onclick = () => { if(state.currentQuestionIndex > 0) { state.currentQuestionIndex--; renderActiveQuestion(); } };
}

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
  {t:"1. Choose Quiz", d:"Create a quiz manually or import from an exported Excel/Google Sheet."},
  {t:"2. Schedule or Start Now", d:"Set a date for later or launch live immediately."},
  {t:"3. Share PIN", d:"Give the 4-digit PIN to students. No login needed for them."},
  {t:"4. Watch Students", d:"Monitor who joins and their live answering progress."},
  {t:"5. See Results", d:"Get instant leaderboard rankings upon completion."},
  {t:"6. Download PDF", d:"Export professional Question Papers & Answer Keys."}
];

window.appEngineAPI = {
  switchContext: switchViewport,
  displayToast: displayToast,
  toggleCreatorTab: (tab) => {
    document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab !== 'manual');
    document.getElementById('creatorExcelForm').classList.toggle('hidden', tab !== 'excel');
    document.getElementById('tabManual').classList.toggle('active', tab === 'manual');
    document.getElementById('tabExcel').classList.toggle('active', tab === 'excel');
  },
  downloadExcelTemplate: () => {
    if(!window.XLSX) return displayToast("Sheet engine loading...", "error");
    const ws = XLSX.utils.json_to_sheet([{ Question: "Sample Question Text", A: "Option 1", B: "Option 2", C: "Option 3", D: "Option 4", Answer: "A" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "QuizMaster_Template.xlsx");
  },
  openScheduler: () => { populateSelects(); document.getElementById('scheduleModal').classList.remove('hidden'); },
  closeScheduler: () => document.getElementById('scheduleModal').classList.add('hidden'),
  saveSchedule: async () => {
    const sel = document.getElementById('schedQuizSelect');
    if(!sel.value) return displayToast("Select an exam to schedule.", "error");
    
    const title = sel.options[sel.selectedIndex].text;
    const dDate = document.getElementById('schedDate').value;
    const h = parseInt(document.getElementById('schedHour').value);
    const m = parseInt(document.getElementById('schedMinute').value);
    const ampm = document.getElementById('schedAmpm').value;
    const duration = parseInt(document.getElementById('schedDuration').value) || 60;
    const metaClass = document.getElementById('schedClass').value;
    
    if(!dDate) return displayToast("Date is required.", "error");
    
    let hour24 = h;
    if (ampm === 'PM' && h !== 12) hour24 += 12;
    if (ampm === 'AM' && h === 12) hour24 = 0;
    
    const [yy, mm, dd] = dDate.split('-');
    const scheduleDate = new Date(yy, mm - 1, dd, hour24, m, 0);
    const scheduledStartAt = scheduleDate.getTime();
    const scheduledEndAt = scheduledStartAt + (duration * 60000);

    const scheduleObj = {
        scheduleId: `SCH-${Date.now()}`,
        examId: sel.value, title,
        scheduledStartAt, scheduledEndAt,
        durationMinutes: duration,
        class: metaClass,
        status: 'scheduled'
    };

    state.scheduledExams.push(scheduleObj);
    saveLocalState();
    if(db) { try { await setDoc(doc(db, "scheduled_exams", scheduleObj.scheduleId), scheduleObj); } catch(e){} }
    
    window.appEngineAPI.closeScheduler();
    displayToast("Exam Scheduled Successfully!", "success");

    // Auto-open Scheduled Exam page dynamically immediately after creation per requirements
    const sUrl = window.location.origin + window.location.pathname + "?exam=" + scheduleObj.scheduleId;
    window.open(sUrl, '_blank');
  },
  deleteSchedule: async (id) => {
      if(confirm("Cancel this scheduled exam?")) {
          state.scheduledExams = state.scheduledExams.filter(s => s.scheduleId !== id);
          saveLocalState();
          if(db) { try { await deleteDoc(doc(db, "scheduled_exams", id)); } catch(e){} }
      }
  },
  deleteQuiz: async (id) => {
      if(confirm("Delete this assessment permanently?")) {
          state.quizzes = state.quizzes.filter(q => q.id !== id);
          saveLocalState();
          if(db) { try { await deleteDoc(doc(db, "quizzes", id)); } catch(e){} }
          displayToast("Assessment deleted.", "info");
      }
  },
  pdfFromLibrary: (id) => {
      switchViewport('pdfSection');
      document.getElementById('pdfSourceAssetSelect').value = id;
      document.getElementById('pdfSourceAssetSelect').dispatchEvent(new Event('change'));
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
  prevTutorial: () => { if(state.tutStep>1) { state.tutStep--; window.appEngineAPI.renderTut(); } },
  downloadSchemaPDF: () => {
    if(!window.jspdf) return displayToast("PDF engine is initializing...", "error");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let y = 20;
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("Quiz Master Pro - Database Schema Blueprint", 105, y, {align:"center"}); y += 15;
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    const schemaText = [
      "This document outlines the JSON document structures for the application state.", "",
      "1. Quizzes & Assessments (Firestore: quizzes)",
      "  - id: String (Primary Key)", "  - title: String", "  - questions: Array of Objects", "",
      "2. Scheduled Exams (Firestore: scheduled_exams)",
      "  - scheduleId: String", "  - examId: String", "  - scheduledStartAt: Number (Timestamp)", "  - scheduledEndAt: Number (Timestamp)", "",
      "3. Exam Sessions (Firestore: exam_sessions/{sessionId})",
      "  - Participants Subcollection: { name, rollNo, status, score, lastSeenAt }",
      "  - Answers Subcollection: { participantId, questionIndex, selectedAnswer }", "",
      "4. Submissions (Firestore: submissions)",
      "  - participantId: String", "  - correct, wrong, unanswered, perc: Number"
    ];
    schemaText.forEach(line => {
      if (y > 280) { doc.addPage(); y = 20; }
      if(line.match(/^[1-4]\./)) { doc.setFont("helvetica", "bold"); doc.setTextColor(5, 150, 105); } 
      else { doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42); }
      doc.text(line, 20, y); y += 7;
    });
    doc.save("Database_Neural_Schema.pdf");
    displayToast("Schema PDF Generated Successfully", "success");
  }
};