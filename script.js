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
try { 
    app = initializeApp(firebaseConfig); 
    db = getFirestore(app); 
} catch (err) { 
    console.warn("Offline fallback mode initialized safely."); 
}

// Unified State Model
const state = {
  quizzes: [], 
  scheduledExams: [], 
  submissions: [], // Global submission tracking for leaderboard/marksheets
  currentUser: { uid: 'GUEST', role: 'guest', name: 'Guest' },
  liveRoom: { active: false, pin: '', title: '', durationMinutes: 30, elapsedSeconds: 0, timerId: null, participants: [], sourceQuizId: null },
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
  const rollNo = document.getElementById('studentRollInput').value.trim();
  
  if (!pin || !name) return displayToast("Exam PIN and Name are required.", "error");

  let targetRoom = (state.liveRoom.active && state.liveRoom.pin === pin) ? state.liveRoom : null;
  
  // If not local host room, fallback to Firebase check if online
  if(!targetRoom && db) {
    try {
        const snap = await getDocs(query(collection(db, "live_rooms"), where("pinCode", "==", pin)));
        if(!snap.empty) targetRoom = snap.docs[0].data();
    } catch(e) { console.warn("Firebase fetch failed"); }
  }

  if (!targetRoom || (targetRoom.status !== 'active' && targetRoom.active !== true)) {
      return displayToast("PIN invalid or exam is not currently active.", "error");
  }

  state.studentMeta = { name, rollNo, pin, startTime: Date.now() };
  const quizAsset = state.quizzes.find(q => q.id === targetRoom.sourceQuizId);
  
  if(!quizAsset) return displayToast("Exam data unavailable locally. Host must share properly.", "error");

  // Log participant locally
  if (state.liveRoom.active && state.liveRoom.pin === pin) {
      state.liveRoom.participants.push({ name, rollNo, status: 'joined', score: 0, currentQuestion: 1 });
      renderProctoringTable();
  }

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
  const quiz = state.quizzes.find(q => q.id === qId);
  if(!quiz) return displayToast("Please select a valid exam.", "error");
  if(!quiz.questions || quiz.questions.length === 0) return displayToast("Selected exam has no questions.", "error");

  const pin = `TN${Math.floor(1000 + Math.random() * 9000)}`;
  const duration = parseInt(document.getElementById('liveSetupDuration').value) || 30;
  
  if(state.liveRoom.timerId) clearInterval(state.liveRoom.timerId);

  state.liveRoom = { 
      active: true, pin, title: quiz.title, durationMinutes: duration, 
      elapsedSeconds: 0, participants: [], sourceQuizId: quiz.id 
  };

  document.getElementById('liveSetupPanel').classList.add('hidden');
  document.getElementById('liveRoomActiveContainer').classList.remove('hidden');
  document.getElementById('liveHostPinCode').textContent = pin;
  document.getElementById('liveHostExamTitle').textContent = state.liveRoom.title;
  document.getElementById('globalLiveBadge').classList.remove('hidden');

  renderProctoringTable(); // clear table

  if (db) {
      try { setDoc(doc(db, "live_rooms", pin), { pinCode: pin, status: "active", sourceQuizId: quiz.id, durationMinutes: duration }); } 
      catch(e) { console.warn("Firebase unreachable, running locally."); }
  }
  
  state.liveRoom.timerId = setInterval(() => {
    state.liveRoom.elapsedSeconds++;
    const m = String(Math.floor(state.liveRoom.elapsedSeconds/60)).padStart(2,'0');
    const s = String(state.liveRoom.elapsedSeconds%60).padStart(2,'0');
    document.getElementById('liveHostTimer').textContent = `${m}:${s}`;
  }, 1000);
  
  displayToast("Live Exam Room Opened Successfully!", "success");
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
    if (!text) return displayToast("Question text is required.", "error");
    
    const a = document.getElementById('qFormOptA').value.trim();
    const b = document.getElementById('qFormOptB').value.trim();
    if(!a || !b) return displayToast("At least Option A and B are required.", "error");

    state.creatorQuestions.push({ 
        text, a, b, 
        c: document.getElementById('qFormOptC').value.trim(), 
        d: document.getElementById('qFormOptD').value.trim(), 
        answer: document.getElementById('qFormAnswer').value 
    });
    
    document.getElementById('pendingQuestionsCount').textContent = state.creatorQuestions.length;
    document.querySelectorAll('#creatorQuestionForm input[type="text"]').forEach(i=>i.value='');
    displayToast("Question added to draft.", "success");
  };

  // EXCEL IMPORT PARSER
  document.getElementById('excelFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if(!file) return;

      if (state.creatorQuestions.length > 0) {
          if (!confirm(`You already have ${state.creatorQuestions.length} unsaved questions.\nImporting another Excel file will replace this draft.\nContinue?`)) {
              e.target.value = ''; // Reset input to allow re-selection
              return;
          }
      }

      try {
          const data = await file.arrayBuffer();
          const wb = XLSX.read(data);
          
          if (wb.SheetNames.length === 0) {
              displayToast("Excel file has no sheets.", "error");
              e.target.value = '';
              return;
          }

          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: '' }); // Fetch rows keeping empty cells as string literals
          
          if(json.length === 0) {
              displayToast("Excel file is empty or missing data.", "error");
              e.target.value = '';
              return;
          }

          const headerMap = {
              'question': 'text', 'questions': 'text', 'questiontext': 'text',
              'a': 'a', 'optiona': 'a',
              'b': 'b', 'optionb': 'b',
              'c': 'c', 'optionc': 'c',
              'd': 'd', 'optiond': 'd',
              'answer': 'answer', 'correctanswer': 'answer', 'key': 'answer', 'options': 'answer'
          };

          const safeString = (val) => {
              if (val === null || val === undefined || Number.isNaN(val)) return '';
              return String(val).trim();
          };

          const normalizeAnswer = (val) => {
              let v = safeString(val).toUpperCase();
              if (v === 'OPTION A' || v === '1') return 'A';
              if (v === 'OPTION B' || v === '2') return 'B';
              if (v === 'OPTION C' || v === '3') return 'C';
              if (v === 'OPTION D' || v === '4') return 'D';
              return v;
          };

          const escapeHTML = (str) => {
              const div = document.createElement('div');
              div.textContent = str;
              return div.innerHTML;
          };
          
          state.creatorQuestions = []; // Reset for new import
          
          let validCount = 0;
          let errorCount = 0;
          
          json.forEach((row) => {
              let mappedData = { text: '', a: '', b: '', c: '', d: '', answer: '' };
              let isEmptyRow = true;

              // Dynamically map headers irrespective of visual column order
              Object.keys(row).forEach(k => {
                  const val = safeString(row[k]);
                  if (val !== '') isEmptyRow = false;
                  const normKey = k.toLowerCase().replace(/\s+/g, '');
                  const targetKey = headerMap[normKey];
                  if (targetKey) {
                      mappedData[targetKey] = val;
                  }
              });

              if (isEmptyRow) return;

              const text = mappedData.text;
              const a = mappedData.a;
              const b = mappedData.b;
              const c = mappedData.c;
              const d = mappedData.d;
              const ans = normalizeAnswer(mappedData.answer);

              // Row Validation (Must have valid question, A, B, and valid A/B/C/D answer)
              if (text && a && b && ['A','B','C','D'].includes(ans)) {
                  state.creatorQuestions.push({ text, a, b, c, d, answer: ans });
                  validCount++;
              } else {
                  errorCount++;
              }
          });
          
          // Generate strictly matched HTML preview directly from state.creatorQuestions preventing any XSS payload execution
          const tableElement = document.getElementById('excelPreviewTable');
          let previewHTML = '';
          
          state.creatorQuestions.forEach((q, idx) => {
              previewHTML += `<tr>
                  <td>${idx + 1}</td>
                  <td title="${escapeHTML(q.text)}">${escapeHTML(q.text.length > 35 ? q.text.substring(0,35) + '...' : q.text)}</td>
                  <td>${escapeHTML(q.a)}</td>
                  <td>${escapeHTML(q.b)}</td>
                  <td>${escapeHTML(q.c)}</td>
                  <td>${escapeHTML(q.d)}</td>
                  <td><strong>${escapeHTML(q.answer)}</strong></td>
                  <td><span style="color:var(--success);font-weight:bold;">Ready</span></td>
              </tr>`;
          });

          tableElement.innerHTML = `
              <thead>
                  <tr>
                      <th>No.</th>
                      <th>Question</th>
                      <th>A</th>
                      <th>B</th>
                      <th>C</th>
                      <th>D</th>
                      <th>Answer</th>
                      <th>Status</th>
                  </tr>
              </thead>
              <tbody>
                  ${previewHTML}
              </tbody>
          `;
          
          document.getElementById('excelPreviewContainer').classList.remove('hidden');
          document.getElementById('pendingQuestionsCount').textContent = state.creatorQuestions.length;

          if (errorCount > 0) {
              displayToast(`Import completed. ${validCount} valid questions are ready to save. ${errorCount} Excel rows contained errors and were excluded.`, "warning");
          } else {
              displayToast(`Successfully imported ${validCount} valid questions.`, "success");
          }

      } catch(err) {
          console.error(err);
          displayToast("Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.", "error");
      } finally {
          e.target.value = ''; // Ensure the file input is cleanly reset
      }
  });
  
  // SAVE QUIZ
  document.getElementById('creatorToWorkspaceBtn').onclick = () => {
    const title = document.getElementById('creatorQuizTitle').value.trim() || "New Examination";
    const metaClass = document.getElementById('creatorClass').value.trim();
    const subject = document.getElementById('creatorSubject').value.trim();
    
    if (state.creatorQuestions.length === 0) return displayToast("Cannot save an empty quiz. Please add valid questions.", "error");

    const newQuiz = { 
        id: `QZ-${Date.now()}`, 
        title, 
        metaClass,
        subject,
        // Structurally map fields safely for persistence to guarantee stability
        questions: state.creatorQuestions.map(q => ({
            text: q.text,
            a: q.a,
            b: q.b,
            c: q.c,
            d: q.d,
            answer: q.answer
        })), 
        createdAt: Date.now() 
    };
    
    state.quizzes.push(newQuiz);
    
    // Clear draft and UI states strictly after successful array insertion
    state.creatorQuestions = []; 
    document.getElementById('pendingQuestionsCount').textContent = '0';
    document.getElementById('creatorQuizTitle').value = '';
    document.getElementById('creatorClass').value = '';
    document.getElementById('creatorSubject').value = '';
    
    const tableElement = document.getElementById('excelPreviewTable');
    if (tableElement) {
        tableElement.innerHTML = '<thead><tr><th>Q</th><th>A</th><th>B</th><th>C</th><th>D</th><th>Ans</th></tr></thead><tbody></tbody>';
    }
    document.getElementById('excelPreviewContainer').classList.add('hidden');
    
    saveLocalState();
    displayToast("Quiz saved successfully!", "success");
    switchViewport('librarySection');
  };
}

// --- COMBINED EXAMS ---
function registerGroupEvents() {
  document.getElementById('groupInventoryContainer').addEventListener('change', (e) => {
    if(e.target.classList.contains('group-chk')){
        let count = 0;
        document.querySelectorAll('.group-chk:checked').forEach(c => {
            const q = state.quizzes.find(x => x.id === c.value);
            if(q && q.questions) count += q.questions.length;
        });
        document.getElementById('groupMetricCount').textContent = count;
    }
  });

  document.getElementById('groupCommitBtn').onclick = () => {
    const title = document.getElementById('groupNameInput').value.trim();
    const duration = document.getElementById('groupDurationInput').value;
    const metaClass = document.getElementById('groupClassInput').value.trim();
    const subject = document.getElementById('groupSubjectInput').value.trim();
    
    if(!title) return displayToast("Combined Exam Title is required", "error");
    
    const selectedRefs = Array.from(document.querySelectorAll('.group-chk:checked')).map(c=>c.value);
    if(selectedRefs.length === 0) return displayToast("Please select at least one source quiz.", "error");

    let combinedQuestions = [];
    selectedRefs.forEach(id => {
        const sq = state.quizzes.find(q => q.id === id);
        if(sq && sq.questions) {
            combinedQuestions = combinedQuestions.concat(sq.questions);
        }
    });

    const combinedExam = { 
        id: `GRP-${Date.now()}`, 
        title, 
        metaClass,
        subject,
        durationMinutes: duration,
        isGroup: true, 
        sourceRefs: selectedRefs,
        questions: combinedQuestions,
        createdAt: Date.now()
    };
    
    state.quizzes.push(combinedExam);
    saveLocalState();
    displayToast(`Combined Exam created with ${combinedQuestions.length} questions.`, "success");
    
    document.getElementById('groupNameInput').value = '';
    document.getElementById('groupMetricCount').textContent = '0';
    document.querySelectorAll('.group-chk').forEach(chk => chk.checked = false);
    
    switchViewport('librarySection');
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
    document.getElementById('runnerTimer').textContent = `${m}:${s}`;
  }, 1000);
}

function renderActiveQuestion() {
  const q = state.activeQuestions[state.currentQuestionIndex];
  document.getElementById('runnerQuestionMeta').textContent = `Question ${state.currentQuestionIndex + 1} of ${state.activeQuestions.length}`;
  document.getElementById('runnerQuestionText').textContent = q.text; // TextContent prevents HTML injection bugs
  
  const prog = ((state.currentQuestionIndex + 1) / state.activeQuestions.length) * 100;
  document.getElementById('runnerProgressBar').style.width = `${prog}%`;
  
  document.getElementById('runnerOptionsGrid').innerHTML = ['A','B','C','D'].filter(opt=>q[opt.toLowerCase()]).map(opt=>`
    <div class="glass-card option-card" style="padding:14px; cursor:pointer; border:2px solid ${state.userAnswers[state.currentQuestionIndex]===opt?'var(--primary)':'var(--border)'}; background:${state.userAnswers[state.currentQuestionIndex]===opt?'var(--primary-light)':'transparent'}" onclick="window.appEngineAPI.selectAnswer('${opt}')">
      <b>${opt}:</b> ${q[opt.toLowerCase()]}
    </div>
  `).join('');
  
  const isLast = state.currentQuestionIndex === state.activeQuestions.length - 1;
  const isFirst = state.currentQuestionIndex === 0;
  
  document.getElementById('runnerPrevBtn').disabled = isFirst;
  document.getElementById('runnerNextBtn').classList.toggle('hidden', isLast);
  document.getElementById('runnerSubmitBtn').classList.toggle('hidden', !isLast);
}

document.getElementById('runnerSubmitBtn').onclick = () => {
  if(state.runnerTimerId) clearInterval(state.runnerTimerId);
  let correct = 0;
  let wrong = 0;
  
  state.activeQuestions.forEach((q, i) => { 
      const ans = state.userAnswers[i];
      if (ans) {
          if (ans === (q.answer||'A')) correct++;
          else wrong++;
      }
  });
  
  const total = state.activeQuestions.length;
  const perc = Math.round((correct / total) * 100);
  const timeStr = document.getElementById('runnerTimer').textContent;
  
  // Update local participant state for host
  const me = state.liveRoom.participants.find(p => p.name === state.studentMeta.name);
  if(me) {
      me.status = 'submitted';
      me.score = correct;
      me.completionTime = timeStr;
      renderProctoringTable();
  }

  // Save to global submissions for marksheet
  state.submissions.push({
      examId: state.activeQuiz.id,
      studentName: state.studentMeta.name,
      rollNo: state.studentMeta.rollNo || '-',
      correct, wrong, total, perc, time: timeStr,
      date: Date.now()
  });
  saveLocalState();
  
  // Render review UI
  document.getElementById('reviewScoreText').textContent = `${correct} / ${total}`;
  document.getElementById('reviewPercentageText').textContent = `${perc}%`;
  document.getElementById('reviewTimeText').textContent = timeStr;
  
  const pfBadge = document.getElementById('passFailText');
  pfBadge.textContent = perc >= 40 ? "PASS" : "FAIL";
  pfBadge.style.color = perc >= 40 ? "var(--success)" : "var(--danger)";
  pfBadge.style.background = perc >= 40 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
  
  switchViewport('reviewSection');
};

// --- PDF GENERATOR ---
function registerPdfEvents() {
  document.getElementById('pdfSourceAssetSelect').addEventListener('change', (e) => {
      const qz = state.quizzes.find(q => q.id === e.target.value);
      if(qz) {
          document.getElementById('pdfClass').value = qz.metaClass || '';
          document.getElementById('pdfSubject').value = qz.subject || '';
      }
  });
  
  document.getElementById('pdfGenerateDownloadBtn').onclick = () => generatePDF('question');
  document.getElementById('pdfGenerateKeyBtn').onclick = () => generatePDF('key');
}

async function generatePDF(type) {
  const assetId = document.getElementById('pdfSourceAssetSelect').value;
  if(!assetId) return displayToast("Please select an exam first.", "error");
  
  const qz = state.quizzes.find(q => q.id === assetId);
  if(!qz) return displayToast("Selected exam could not be found.", "error");
  if(!qz.questions || qz.questions.length === 0) return displayToast("Cannot generate PDF: Assessment has no questions.", "error");
  if(!window.jspdf) return displayToast("PDF engine is initializing, please wait...", "error");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 20;
  const pageHeight = 285; 
  
  const checkPageBreak = (neededSpace) => {
      if (y + neededSpace > pageHeight) {
          doc.addPage();
          y = 20;
      }
  };
  
  // Header Formatting
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(document.getElementById('pdfSchoolHeaderInput').value || 'SCHOOL EXAM', 105, y, {align:"center"}); 
  y += 10;
  
  doc.setFontSize(12);
  doc.text(`EXAM: ${qz.title} | ${type === 'key' ? 'ANSWER KEY' : 'QUESTION PAPER'}`, 105, y, {align:"center"}); 
  y += 8;
  
  doc.setFontSize(11);
  const cls = document.getElementById('pdfClass').value || '-';
  const sub = document.getElementById('pdfSubject').value || '-';
  doc.text(`Class: ${cls} | Subject: ${sub} | Total Questions: ${qz.questions.length}`, 105, y, {align:"center"}); 
  y += 15;
  
  // Render Questions
  doc.setFontSize(11);
  qz.questions.forEach((q, i) => {
    doc.setFont("helvetica", type === 'key' ? 'bold' : 'normal');
    const prefix = `${i+1}. `;
    const qStr = type === 'key' ? `${prefix}${q.text}  [ KEY: ${q.answer||'A'} ]` : `${prefix}${q.text}`;
    
    const qLines = doc.splitTextToSize(qStr, 180);
    checkPageBreak((qLines.length * 6) + 10);
    doc.text(qLines, 15, y);
    y += (qLines.length * 6) + 2;
    
    if (type !== 'key') {
      const optStr = `(A) ${q.a}   (B) ${q.b}   (C) ${q.c}   (D) ${q.d}`;
      const optLines = doc.splitTextToSize(optStr, 175);
      checkPageBreak((optLines.length * 6) + 5);
      doc.setFont("helvetica", "normal");
      doc.text(optLines, 20, y);
      y += (optLines.length * 6) + 6; 
    } else {
        y += 4;
    }
  });
  
  doc.save(`${qz.title.replace(/\s+/g, '_')}_${type.toUpperCase()}.pdf`);
  displayToast("PDF Generated Successfully", "success");
}

// --- STATE MANAGEMENT & SCHEDULING ---
function saveLocalState() {
  const safeData = { 
      quizzes: state.quizzes, 
      scheduled: state.scheduledExams,
      submissions: state.submissions
  };
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
  } catch(e) { console.warn("Failed to parse local state, starting fresh"); }
  
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
    const sorted = [...state.scheduledExams].sort((a,b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    calBox.innerHTML = sorted.map(s => `
      <div class="agenda-item">
        <div class="agenda-date">${new Date(s.date).toLocaleDateString('en-GB',{month:'short',day:'numeric'})}</div>
        <div class="agenda-body" style="flex:1;">
            <strong style="display:block; margin-bottom:4px;">${s.title}</strong>
            <p style="font-size:0.8rem; color:var(--text-light); margin:0;">${s.time} | ${s.duration} mins | Class: ${s.class||'All'} | <b>${s.status.toUpperCase()}</b></p>
        </div>
        <button class="btn-sm btn-icon btn-danger" onclick="window.appEngineAPI.deleteSchedule('${s.id}')" title="Cancel Schedule"><i class="ri-delete-bin-line"></i></button>
      </div>
    `).join('');
  }
}

function populateSelects() {
  const opts = '<option value="">-- Select Exam / Assessment --</option>' + state.quizzes.map(q => `<option value="${q.id}">${q.title} (${q.questions?.length||0} Qs)</option>`).join('');
  document.getElementById('liveSetupQuizSelect').innerHTML = opts;
  document.getElementById('schedQuizSelect').innerHTML = opts;
  document.getElementById('pdfSourceAssetSelect').innerHTML = opts;
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
    if(!examId) { tbody.innerHTML = `<tr><td colspan="8" class="text-center">Select an exam to view results.</td></tr>`; return; }
    
    const relevant = state.submissions.filter(s => s.examId === examId).sort((a,b) => b.score - a.score);
    if(relevant.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="text-center">No submissions yet for this exam.</td></tr>`; return; }
    
    tbody.innerHTML = relevant.map((s, i) => `
        <tr>
            <td><b>#${i+1}</b></td>
            <td>${s.studentName}</td>
            <td>${s.rollNo}</td>
            <td><span style="color:var(--success)">${s.correct}</span></td>
            ${tbodyId==='marksheetTableBody'? `<td><span style="color:var(--danger)">${s.wrong}</span></td>` : ''}
            <td><b>${s.correct}</b></td>
            <td>${s.perc}%</td>
            <td>${s.time}</td>
        </tr>
    `).join('');
}

function checkAutoOpenSchedules() {
  const now = new Date();
  let changed = false;
  state.scheduledExams.forEach(s => {
    if(s.status === 'scheduled') {
      const sDate = new Date(`${s.date}T${s.time}`);
      if(now >= sDate) {
        s.status = 'open';
        changed = true;
        displayToast(`Scheduled Exam "${s.title}" is now Open!`, "success");
      }
    }
  });
  if(changed) saveLocalState();
}

function renderLibrary() {
  const lib = document.getElementById('libraryContainer');
  if(state.quizzes.length === 0) {
      lib.innerHTML = '<div class="empty-state-msg" style="grid-column: 1 / -1;">No assessments saved yet. Head to Quiz Creator Studio.</div>';
      return;
  }
  
  lib.innerHTML = state.quizzes.map(q => `
    <div class="glass-card library-card" style="display:flex; flex-direction:column; justify-content:space-between; padding:20px; border-left:4px solid ${q.isGroup ? 'var(--accent)' : 'var(--primary)'}; height:100%;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3 style="font-size:1.1rem; line-height:1.4; margin-bottom:6px;">${q.title}</h3>
            ${q.isGroup ? '<span style="font-size:0.7rem; background:var(--accent); color:white; padding:2px 6px; border-radius:4px;">COMBINED</span>' : ''}
        </div>
        <p class="subtext" style="font-size:0.85rem; margin-bottom:4px;">Class: ${q.metaClass || 'All'} | Subj: ${q.subject || 'All'}</p>
        <p class="subtext" style="font-size:0.85rem; font-weight:700; color:var(--text-main);"><i class="ri-file-list-3-line"></i> ${q.questions?.length || 0} Questions</p>
      </div>
      <div style="display:flex; gap:8px; margin-top: 16px; padding-top:16px; border-top:1px solid var(--border);">
          <button class="btn-sm btn-primary" onclick="window.appEngineAPI.launchFromLibrary('${q.id}')" style="flex:1;"><i class="ri-play-line"></i> Live</button>
          <button class="btn-sm btn-secondary" onclick="window.appEngineAPI.pdfFromLibrary('${q.id}')" style="flex:1;"><i class="ri-printer-line"></i> PDF</button>
          <button class="btn-sm btn-danger btn-icon" onclick="window.appEngineAPI.deleteQuiz('${q.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>
    </div>
  `).join('');
  
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
  document.getElementById('globalStickyHomeBtn').onclick = () => switchViewport('homeSection');
  document.getElementById('sidebarToggle').onclick = () => {
    document.getElementById('appSidebar').classList.toggle('hidden');
    document.querySelector('.main-content').classList.toggle('expanded');
  };
  document.getElementById('runnerNextBtn').onclick = () => { if(state.currentQuestionIndex < state.activeQuestions.length - 1) { state.currentQuestionIndex++; renderActiveQuestion(); } };
  document.getElementById('runnerPrevBtn').onclick = () => { if(state.currentQuestionIndex > 0) { state.currentQuestionIndex--; renderActiveQuestion(); } };
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
  {t:"3. Share PIN", d:"Give the 4-digit PIN to students. No login needed for them."},
  {t:"4. Watch Students", d:"Monitor who joins and their live answering progress."},
  {t:"5. See Results", d:"Get instant leaderboard rankings upon completion."},
  {t:"6. Download PDF", d:"Export professional Question Papers & Answer Keys."}
];

window.appEngineAPI = {
  switchContext: switchViewport,
  toggleCreatorTab: (tab) => {
    document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab !== 'manual');
    document.getElementById('creatorExcelForm').classList.toggle('hidden', tab !== 'excel');
    document.getElementById('tabManual').classList.toggle('active', tab === 'manual');
    document.getElementById('tabExcel').classList.toggle('active', tab === 'excel');
  },
  downloadExcelTemplate: () => {
    if(!window.XLSX) return displayToast("Excel engine loading, try again in a moment.", "error");
    const ws = XLSX.utils.json_to_sheet([{ Question: "Sample Question Text", A: "Option 1", B: "Option 2", C: "Option 3", D: "Option 4", Answer: "A" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "QuizMaster_Template.xlsx");
  },
  selectAnswer: (opt) => { 
      state.userAnswers[state.currentQuestionIndex] = opt; 
      renderActiveQuestion(); 
  },
  openScheduler: () => { populateSelects(); document.getElementById('scheduleModal').classList.remove('hidden'); },
  closeScheduler: () => document.getElementById('scheduleModal').classList.add('hidden'),
  saveSchedule: () => {
    const sel = document.getElementById('schedQuizSelect');
    if(!sel.value) return displayToast("Select an exam to schedule.", "error");
    
    const title = sel.options[sel.selectedIndex].text;
    const date = document.getElementById('schedDate').value;
    const time = document.getElementById('schedTime').value;
    const duration = document.getElementById('schedDuration').value;
    const cls = document.getElementById('schedClass').value;
    
    if(!date || !time) return displayToast("Date and Time are required.", "error");
    
    state.scheduledExams.push({ id:`SCH-${Date.now()}`, examId: sel.value, title, date, time, duration, class: cls, status: 'scheduled' });
    saveLocalState();
    window.appEngineAPI.closeScheduler();
    displayToast("Exam Scheduled Successfully!", "success");
  },
  deleteSchedule: (id) => {
      if(confirm("Cancel this scheduled exam?")) {
          state.scheduledExams = state.scheduledExams.filter(s => s.id !== id);
          saveLocalState();
      }
  },
  deleteQuiz: (id) => {
      if(confirm("Are you sure you want to delete this assessment? It will be removed permanently.")) {
          state.quizzes = state.quizzes.filter(q => q.id !== id);
          saveLocalState();
          displayToast("Assessment deleted.", "info");
      }
  },
  launchFromLibrary: (id) => {
      switchViewport('liveQuizSection');
      document.getElementById('liveSetupQuizSelect').value = id;
      document.getElementById('liveSetupPanel').classList.remove('hidden');
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
  prevTutorial: () => { if(state.tutStep>1) { state.tutStep--; window.appEngineAPI.renderTut(); } }
};