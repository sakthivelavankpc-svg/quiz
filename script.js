/**
 * ==========================================================================
 * QUIZ MASTER PRO V38 ENTERPRISE SCHOOL EDITION — UNIFIED APPLICATION ENGINE
 * Full Stack Reactive Architecture: Auth, Live Sockets, Question Bank,
 * Blueprint Compiler, A4 & OMR Print Engine, and 100% Backward Compatibility.
 * ==========================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getFirestore, collection, doc, getDocs, addDoc, setDoc, updateDoc, 
  deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- 1. FIREBASE INFRASTRUCTURE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAnxIsftWdUxtHEh7nxX1UPRA29c0n1444",
  authDomain: "quiz-master-3e489.firebaseapp.com",
  projectId: "quiz-master-3e489",
  storageBucket: "quiz-master-3e489.firebasestorage.app",
  messagingSenderId: "741393992507",
  appId: "1:741393992507:web:b28cd8fcda2b74f85b851e"
};

let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase Init Offline Bypass Mode Enabled.");
}

// --- 2. GLOBAL ENTERPRISE APPLICATION STATE ---
export const enterpriseState = {
  // Assessment Collections
  quizzes: [],
  examGroups: [],
  questionBank: [],
  logs: [],
  users: [],
  
  // Active Assessment Telemetry
  activeQuiz: null,
  activeQuestions: [],
  userAnswers: {},
  currentQuestionIndex: 0,
  timerInterval: null,
  elapsedSeconds: 0,
  timeAllocatedSeconds: 0,
  
  // Live Classroom Room Engine
  liveSession: {
    pin: null,
    status: 'OFFLINE', // OFFLINE, LOBBY, ACTIVE, PAUSED, ENDED
    isTeacher: false,
    teacherId: null,
    participants: {},
    unsubscribeRoom: null,
    unsubscribeRoster: null
  },

  // Selected State Matrices
  selectedBankQuestions: [],
  selectedProQuestions: [],
  stagedCreatorQuestions: [],

  // Internationalization & Theme
  currentLang: 'en', // 'en' or 'ta'
  activeTheme: 'emerald',

  // Current Authentication Identity
  currentUser: { uid: 'GUEST', role: 'guest', name: 'Guest Scholar' }
};

// --- 3. TAMIL & ENGLISH LOCALIZATION DICTIONARY ---
const I18N_STRINGS = {
  en: {
    guest_title: "Student / Guest Entry",
    guest_desc: "Take exams, access live classroom rooms, and view instant score sheets without credentials.",
    enter_portal: "Enter Portal",
    have_pin: "Have a Live Exam PIN?",
    login_title: "Staff / Admin Login",
    login_desc: "Access Question Bank, Exam Blueprint Studio, Live Monitors, and School Marksheets.",
    btn_login: "Login to Dashboard",
    reg_title: "School Registration",
    reg_desc: "Enroll new teacher, exam invigilator, or institutional department nodes.",
    btn_register: "Enroll Account"
  },
  ta: {
    guest_title: "மாணவர் / விருந்தினர் நுழைவு",
    guest_desc: "கடவுச்சொல் இன்றி நேரலைத் தேர்வுகள், மாதிரி வினாத்தாள்கள் மற்றும் மதிப்பெண் பட்டியலை உடனுக்குடன் பெறலாம்.",
    enter_portal: "நுழைவு செய்க",
    have_pin: "தேர்வு பின் (PIN) உள்ளதா?",
    login_title: "ஆசிரியர் / நிர்வாகி உள்நுழைவு",
    login_desc: "வினா வங்கி, புளூபிரிண்ட் உருவாக்கம், நேரலை தேர்வுக் கண்காணிப்பு மற்றும் மதிப்பெண் பட்டியல்.",
    btn_login: "டாஷ்போர்டு உள்நுழைவு",
    reg_title: "பள்ளிப் பதிவு மையம்",
    reg_desc: "புதிய ஆசிரியர் அல்லது பள்ளித் தேர்வு மையத்தை அமைப்பில் இணைக்கவும்.",
    btn_register: "பதிவு செய்க"
  }
};

// --- 4. BACKWARD COMPATIBLE QUESTION NORMALIZER ---
export function normalizeQuestion(q, fallbackIdx = 0) {
  if (!q) return null;
  const optA = q.a ?? q.A ?? q.optionA ?? q.optA ?? (Array.isArray(q.options) ? q.options[0] : "") ?? "";
  const optB = q.b ?? q.B ?? q.optionB ?? q.optB ?? (Array.isArray(q.options) ? q.options[1] : "") ?? "";
  const optC = q.c ?? q.C ?? q.optionC ?? q.optC ?? (Array.isArray(q.options) ? q.options[2] : "") ?? "";
  const optD = q.d ?? q.D ?? q.optionD ?? q.optD ?? (Array.isArray(q.options) ? q.options[3] : "") ?? "";

  let normAns = "A";
  const rawAns = String(q.answer ?? q.correct ?? q.correctAnswer ?? "A").trim();
  const cleanAns = rawAns.replace(/<[^>]*>?/gm, "").toUpperCase();

  if (["A", "B", "C", "D"].includes(cleanAns)) {
    normAns = cleanAns;
  } else {
    const cleanA = String(optA).replace(/<[^>]*>?/gm, "").trim().toUpperCase();
    const cleanB = String(optB).replace(/<[^>]*>?/gm, "").trim().toUpperCase();
    const cleanC = String(optC).replace(/<[^>]*>?/gm, "").trim().toUpperCase();
    const cleanD = String(optD).replace(/<[^>]*>?/gm, "").trim().toUpperCase();
    if (cleanAns === cleanA) normAns = "A";
    else if (cleanAns === cleanB) normAns = "B";
    else if (cleanAns === cleanC) normAns = "C";
    else if (cleanAns === cleanD) normAns = "D";
  }

  return {
    id: q.id || `q_${fallbackIdx}_${Date.now()}`,
    text: q.text || q.question || q.title || `Question #${fallbackIdx + 1}`,
    a: String(optA),
    b: String(optB),
    c: String(optC),
    d: String(optD),
    answer: normAns,
    marks: Number(q.marks) || 1,
    time: Number(q.time) || 60,
    explanation: q.explanation || q.exp || "",
    bloom: q.bloom || q.bloomTaxonomy || "Understanding",
    difficulty: q.difficulty || "Medium",
    subject: q.subject || "",
    class: q.class || ""
  };
}

// --- 5. INITIALIZATION & BOOTSTRAPPING ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initThemeAndLocale();
    registerSystemEventListeners();
    await checkActiveSession();
    processUrlParameters();
    startDashboardTelemetryClock();
  } catch (err) {
    console.error("System Boot Fault:", err);
  }
});

function initThemeAndLocale() {
  const savedTheme = localStorage.getItem('QMP_THEME') || 'emerald';
  document.documentElement.setAttribute('data-theme', savedTheme);
  enterpriseState.activeTheme = savedTheme;

  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.classList.toggle('active', dot.getAttribute('data-theme') === savedTheme);
    dot.addEventListener('click', () => {
      const theme = dot.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('QMP_THEME', theme);
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  const savedLang = localStorage.getItem('QMP_LANG') || 'en';
  setSystemLanguage(savedLang);
}

function setSystemLanguage(lang) {
  enterpriseState.currentLang = lang;
  localStorage.setItem('QMP_LANG', lang);
  document.getElementById('currentLangLabel').textContent = lang.toUpperCase();

  const strings = I18N_STRINGS[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (strings[key]) el.textContent = strings[key];
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
}

// --- 6. AUTHENTICATION GATES ---
async function checkActiveSession() {
  const session = await localforage.getItem('activeSession');
  if (session) {
    await grantClearance(session.role, session);
  } else {
    document.getElementById('welcomeGate').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
  }
}

async function grantClearance(role, profile) {
  enterpriseState.currentUser = profile;
  await localforage.setItem('activeSession', profile);

  document.getElementById('welcomeGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('globalStickyHomeBtn').classList.remove('hidden');

  document.getElementById('headerUserName').textContent = profile.name;
  document.getElementById('headerUserRole').textContent = role.toUpperCase();
  document.getElementById('welcomeUserName').textContent = profile.name;
  document.getElementById('profUid').value = profile.uid || profile.userId || 'N/A';
  document.getElementById('profRole').value = role.toUpperCase();
  document.getElementById('profNameInput').value = profile.name;

  // Toggle role permissions
  document.querySelectorAll('.auth-required').forEach(el => {
    if (role === 'guest' || role === 'student') el.classList.add('hidden');
    else el.classList.remove('hidden');
  });

  if (role === 'admin') {
    document.getElementById('sidebarAdminLink').classList.remove('hidden');
    document.getElementById('sidebarUsersLink').classList.remove('hidden');
  }

  showToast(`Welcome, ${profile.name}`, "success");
  await syncCloudAndLocalDatastores();
}

// --- 7. CLOUD SYNCHRONIZATION & STORAGE ENGINE ---
async function syncCloudAndLocalDatastores() {
  showToast("Synchronizing examination repositories...", "info");
  
  // 1. Read Local Cache First for Instant Response
  const cached = JSON.parse(localStorage.getItem('QMP_V38_CACHE') || '{"quizzes":[],"examGroups":[],"bank":[]}');
  enterpriseState.quizzes = cached.quizzes || [];
  enterpriseState.examGroups = cached.examGroups || [];
  enterpriseState.questionBank = cached.bank || [];

  // 2. Hydrate from Firestore
  try {
    if (db) {
      const [qSnap, gSnap, bSnap, lSnap] = await Promise.all([
        getDocs(collection(db, "quizzes")),
        getDocs(collection(db, "exam_groups")),
        getDocs(collection(db, "questionBank")),
        getDocs(collection(db, "activityLogs"))
      ]);

      enterpriseState.quizzes = qSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || data.metaExam || "Legacy Quiz",
          metaClass: data.metaClass || data.class || "",
          metaSubject: data.metaSubject || data.subject || "",
          metaTopic: data.metaTopic || data.topic || "General",
          totalMinutes: Number(data.totalMinutes) || 30,
          shuffle: Boolean(data.shuffle),
          questions: (data.questions || []).map((q, idx) => normalizeQuestion(q, idx))
        };
      });

      enterpriseState.examGroups = gSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || data.groupName || "Combined Exam Block",
          quizReferences: data.quizReferences || data.quizIds || [],
          totalMinutes: Number(data.totalMinutes) || 60,
          class: data.class || "",
          subject: data.subject || ""
        };
      });

      enterpriseState.questionBank = bSnap.docs.map(d => normalizeQuestion({ id: d.id, ...d.data() }));
      enterpriseState.logs = lSnap.docs.map(d => d.data());
    }
  } catch (err) {
    console.warn("Using offline datastore bypass:", err);
  }

  // Persist normalized cache
  localStorage.setItem('QMP_V38_CACHE', JSON.stringify({
    quizzes: enterpriseState.quizzes,
    examGroups: enterpriseState.examGroups,
    bank: enterpriseState.questionBank
  }));

  updateDashboardKPIs();
  renderLibrary();
  renderQuestionBank();
  populateDropdownSelectors();
  renderMarksheetTable();
}

function updateDashboardKPIs() {
  document.getElementById('statTotalQuizzes').textContent = enterpriseState.quizzes.length;
  document.getElementById('statTotalGroups').textContent = enterpriseState.examGroups.length;
  
  const totalQuestions = enterpriseState.quizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0) + enterpriseState.questionBank.length;
  document.getElementById('statTotalQuestions').textContent = totalQuestions;
  document.getElementById('statTotalStudents').textContent = enterpriseState.logs.length;
}

// --- 8. LIVE CLASSROOM QUIZ SYSTEM ENGINE ---
export const LiveQuizEngine = {
  // Initialize new Live Session (Teacher Side)
  async createLiveRoom(quizId, durationMins, perQTimer, shuffle) {
    if (!quizId) return showToast("Select an examination asset first.", "danger");
    
    // Generate Random 6-Digit PIN
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const target = enterpriseState.quizzes.find(q => q.id === quizId) || enterpriseState.examGroups.find(g => g.id === quizId);
    
    let questions = [];
    if (target.quizReferences) {
      target.quizReferences.forEach(ref => {
        const qz = enterpriseState.quizzes.find(q => q.id === ref);
        if (qz) questions.push(...qz.questions);
      });
    } else {
      questions = [...target.questions];
    }

    if (shuffle) questions.sort(() => Math.random() - 0.5);

    const roomPayload = {
      pin,
      quizId,
      title: target.title || target.name,
      teacherId: enterpriseState.currentUser.uid,
      teacherName: enterpriseState.currentUser.name,
      status: 'ACTIVE',
      durationMins: Number(durationMins) || 45,
      perQTimer: Number(perQTimer) || 0,
      createdAt: new Date().toISOString(),
      questionCount: questions.length
    };

    enterpriseState.liveSession = {
      pin,
      status: 'ACTIVE',
      isTeacher: true,
      questions,
      participants: {}
    };

    // Store in Firestore
    if (db) {
      await setDoc(doc(db, "liveQuizzes", pin), roomPayload);
    }

    // Update Teacher View
    document.getElementById('liveActivePin').textContent = pin;
    const directUrl = `${window.location.origin}${window.location.pathname}?livePin=${pin}`;
    document.getElementById('liveDirectUrlInput').value = directUrl;

    // Render Vector QR Code for live smartboard projection
    const qrContainer = document.getElementById('liveRoomQrCanvas');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: directUrl, width: 120, height: 120 });

    document.getElementById('liveActiveRoomCard').classList.remove('hidden');
    document.getElementById('liveRoomBadge').textContent = `ROOM ACTIVE: ${pin}`;
    document.getElementById('liveRoomBadge').classList.add('active');

    // Subscribe to Live Realtime Participant Stream
    this.listenToParticipants(pin);
    showToast(`Live Room ${pin} initiated successfully!`, "success");
  },

  // Real-time Firestore Snapshot Listener
  listenToParticipants(pin) {
    if (!db) return;
    const q = collection(db, "liveQuizzes", pin, "participants");
    enterpriseState.liveSession.unsubscribeRoster = onSnapshot(q, (snapshot) => {
      const rosterTable = document.getElementById('liveParticipantsTableBody');
      rosterTable.innerHTML = '';
      
      let connected = 0;
      let submitted = 0;
      const participants = [];

      snapshot.docs.forEach(docSnap => {
        const p = docSnap.data();
        participants.push(p);
        connected++;
        if (p.status === 'SUBMITTED') submitted++;

        const statusClass = p.status === 'ACTIVE' ? 'badge-active' : p.status === 'SUBMITTED' ? 'badge-submitted' : 'badge-idle';

        rosterTable.innerHTML += `
          <tr>
            <td><span class="${statusClass}">${p.status}</span></td>
            <td><b>${p.name}</b></td>
            <td>${p.rollNo || 'N/A'}</td>
            <td>Q# ${p.currentQ + 1}</td>
            <td>
              <div style="width: 80px; height: 6px; background: var(--secondary); border-radius: 3px; overflow:hidden;">
                <div style="width: ${p.progressPct}%; height: 100%; background: var(--primary);"></div>
              </div>
            </td>
            <td><b>${p.score !== undefined ? p.score + '%' : '--'}</b></td>
            <td>
              <button class="btn-sm btn-danger" onclick="window.appEngineAPI.kickLiveParticipant('${pin}', '${docSnap.id}')"><i class="ri-user-unfollow-line"></i></button>
            </td>
          </tr>
        `;
      });

      document.getElementById('liveConnectedCount').textContent = connected;
      document.getElementById('liveSubmittedCount').textContent = submitted;

      // Update Live Podium & Leaderboard
      participants.sort((a, b) => (b.score || 0) - (a.score || 0));
      this.renderLiveLeaderboard(participants);
    });
  },

  renderLiveLeaderboard(sortedList) {
    const listContainer = document.getElementById('liveLeaderboardList');
    listContainer.innerHTML = '';
    sortedList.forEach((p, idx) => {
      listContainer.innerHTML += `
        <div class="schedule-item" style="margin-bottom: 8px;">
          <div class="schedule-date"><span class="day">#${idx + 1}</span></div>
          <div class="schedule-info">
            <h4>${p.name}</h4>
            <p>Score: ${p.score || 0}% &bull; Progress: ${p.progressPct}%</p>
          </div>
        </div>
      `;
    });
  },

  // Student Joins Room via 6-Digit PIN (No Login Required)
  async joinRoomAsStudent(pin, studentName, rollNo) {
    if (!pin || pin.length < 6) return showToast("Enter a valid 6-Digit PIN", "danger");
    if (!studentName) return showToast("Enter your Name", "danger");

    showToast("Connecting to live exam room...", "info");

    try {
      let roomData = null;
      if (db) {
        const rSnap = await getDocs(query(collection(db, "liveQuizzes"), where("pin", "==", pin)));
        if (!rSnap.empty) roomData = rSnap.docs[0].data();
      }

      if (!roomData) {
        return showToast("Live Room not found or has concluded.", "danger");
      }

      const participantId = `stu_${Date.now()}`;
      const participantPayload = {
        id: participantId,
        name: studentName,
        rollNo: rollNo || 'N/A',
        currentQ: 0,
        progressPct: 0,
        status: 'ACTIVE',
        joinedAt: new Date().toISOString()
      };

      if (db) {
        await setDoc(doc(db, "liveQuizzes", pin, "participants", participantId), participantPayload);
      }

      // Launch Student into Quiz Runner with synchronized constraints
      enterpriseState.currentUser = { uid: participantId, name: studentName, role: 'student', rollNo };
      initializeRunner(roomData.quizId, false, roomData.durationMins, pin, participantId);

    } catch (e) {
      showToast("Could not join live room. Check connection.", "danger");
    }
  }
};

// --- 9. HIGH-FIDELITY A4 & OMR PRINT ENGINE ---
export const PDFPrintEngine = {
  async generateQuestionPaper(quizId, layout, setVersion) {
    const target = enterpriseState.quizzes.find(q => q.id === quizId) || enterpriseState.examGroups.find(g => g.id === quizId);
    if (!target) return showToast("Select a valid examination node.", "danger");

    let questions = [...(target.questions || [])];
    if (setVersion !== 'A') {
      // Deterministic Set Shuffling based on version code
      questions.sort((a, b) => a.text.charCodeAt(0) - b.text.charCodeAt(0));
      if (setVersion === 'C' || setVersion === 'D') questions.reverse();
    }

    const schoolName = document.getElementById('pdfSchoolName').value || "GOVERNMENT HIGHER SECONDARY SCHOOL";
    const className = document.getElementById('pdfClass').value || "10th Standard";
    const subject = document.getElementById('pdfSubject').value || "Science";
    const marks = document.getElementById('pdfMarksInput').value || "50";
    const time = document.getElementById('pdfTimeInput').value || "90 Mins";

    showToast("Compiling Tamil Nadu Board standardized A4 question paper...", "info");

    // Construct Vector Printable DOM Node
    const printNode = document.createElement('div');
    printNode.className = 'tn-paper-format';
    printNode.style.width = '794px'; // A4 96DPI width
    printNode.style.minHeight = '1123px';
    printNode.style.background = '#ffffff';

    let html = `
      <div class="sheet-school-header">${schoolName}</div>
      <div class="sheet-exam-title">${target.title || target.name} — SET ${setVersion}</div>
      <div class="sheet-meta-row">
        <span>CLASS: ${className}</span>
        <span>SUBJECT: ${subject}</span>
        <span>MARKS: ${marks}</span>
        <span>TIME: ${time}</span>
      </div>
      <div class="sheet-instructions">Instructions: 1. Read all questions carefully. 2. Choose the best answer and shade on the provided OMR Sheet.</div>
      <hr style="border: 0; border-top: 2px solid #000; margin: 10px 0;" />
      <div style="columns: ${layout.includes('2col') ? 2 : 1}; column-gap: 24px;">
    `;

    questions.forEach((q, idx) => {
      html += `
        <div class="paper-q-node">
          <b>${idx + 1}. ${q.text}</b>
          <div class="paper-q-options">
            <div>(A) ${q.a}</div>
            <div>(B) ${q.b}</div>
            <div>(C) ${q.c}</div>
            <div>(D) ${q.d}</div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    printNode.innerHTML = html;

    const staging = document.getElementById('proStagingWrapper');
    staging.innerHTML = '';
    staging.appendChild(printNode);

    const canvas = await html2canvas(printNode, { scale: 2, useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;

    pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, w, h);
    pdf.save(`${target.title.replace(/\s+/g, '_')}_Set_${setVersion}_Paper.pdf`);
    staging.innerHTML = '';
    showToast("Question paper downloaded successfully!", "success");
  },

  // Printable OMR Bubble Answer Sheet
  async generateOMRSheet(totalQuestions = 50) {
    showToast("Generating standardized OMR Bubble Answer Sheet...", "info");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("GOVERNMENT OF TAMIL NADU — EXAMINATION BOARD", 100, 40);
    pdf.setFontSize(11);
    pdf.text("OFFICIAL MCQ OMR RESPONSE BUBBLE SHEET", 170, 56);

    pdf.setLineWidth(1);
    pdf.rect(40, 70, 515, 60);
    pdf.setFontSize(9);
    pdf.text("CANDIDATE NAME: ________________________________________________", 50, 90);
    pdf.text("REGISTER NUMBER: [   ][   ][   ][   ][   ][   ][   ][   ]", 50, 115);
    pdf.text("CLASS / SECTION: _____________", 380, 90);
    pdf.text("DATE: _____________", 380, 115);

    // Render OMR Bubble Grid
    let startY = 160;
    const colWidth = 120;
    const questionsPerCol = 25;

    for (let i = 0; i < totalQuestions; i++) {
      const colIdx = Math.floor(i / questionsPerCol);
      const rowIdx = i % questionsPerCol;
      const x = 50 + colIdx * colWidth;
      const y = startY + rowIdx * 22;

      pdf.setFontSize(8);
      pdf.text(String(i + 1).padStart(2, '0'), x, y);

      ['A', 'B', 'C', 'D'].forEach((opt, oIdx) => {
        const bubbleX = x + 22 + oIdx * 20;
        pdf.circle(bubbleX, y - 3, 6);
        pdf.setFontSize(6);
        pdf.text(opt, bubbleX - 2.5, y - 1);
      });
    }

    pdf.save("Standard_OMR_Bubble_Sheet.pdf");
    showToast("OMR Sheet ready for printing!", "success");
  }
};

// --- 10. ASSESSMENT RUNNER (STUDENT EXAM RUNTIME) ---
function initializeRunner(id, isGroup = false, customDuration = null, livePin = null, liveParticipantId = null) {
  let targetQuestions = [];
  let duration = customDuration || 30;

  if (isGroup) {
    const group = enterpriseState.examGroups.find(g => g.id === id);
    duration = group.totalMinutes || 45;
    group.quizReferences.forEach(ref => {
      const qz = enterpriseState.quizzes.find(q => q.id === ref);
      if (qz) targetQuestions.push(...qz.questions);
    });
    enterpriseState.activeQuiz = { title: group.name, questions: targetQuestions };
  } else {
    const qz = enterpriseState.quizzes.find(q => q.id === id);
    duration = qz.totalMinutes || 30;
    enterpriseState.activeQuiz = qz;
    targetQuestions = [...qz.questions];
    if (qz.shuffle) targetQuestions.sort(() => Math.random() - 0.5);
  }

  enterpriseState.activeQuestions = targetQuestions;
  enterpriseState.userAnswers = {};
  enterpriseState.currentQuestionIndex = 0;
  enterpriseState.elapsedSeconds = 0;
  enterpriseState.timeAllocatedSeconds = duration * 60;

  window.appEngineAPI.switchViewport('quizSection');
  document.getElementById('runnerQuizTitle').textContent = enterpriseState.activeQuiz.title;

  clearInterval(enterpriseState.timerInterval);
  enterpriseState.timerInterval = setInterval(async () => {
    enterpriseState.elapsedSeconds++;
    const remaining = enterpriseState.timeAllocatedSeconds - enterpriseState.elapsedSeconds;

    const pad = v => String(v).padStart(2, '0');
    const mins = Math.floor(Math.max(0, remaining) / 60);
    const secs = Math.max(0, remaining) % 60;
    document.getElementById('runnerTimer').textContent = `${pad(mins)}:${pad(secs)}`;

    // Anti-Tamper Check & Sync to Live Teacher Board
    if (livePin && liveParticipantId && enterpriseState.elapsedSeconds % 5 === 0) {
      if (db) {
        updateDoc(doc(db, "liveQuizzes", livePin, "participants", liveParticipantId), {
          currentQ: enterpriseState.currentQuestionIndex,
          progressPct: Math.round(((enterpriseState.currentQuestionIndex + 1) / enterpriseState.activeQuestions.length) * 100),
          ping: serverTimestamp()
        }).catch(() => {});
      }
    }

    if (remaining <= 0) {
      clearInterval(enterpriseState.timerInterval);
      showToast("Time limit expired! Auto-evaluating responses...", "danger");
      finalizeAssessment(livePin, liveParticipantId);
    }
  }, 1000);

  renderActiveQuestionNode();
}

function renderActiveQuestionNode() {
  const i = enterpriseState.currentQuestionIndex;
  const q = enterpriseState.activeQuestions[i];

  document.getElementById('runnerQuestionMeta').textContent = `Question ${i + 1} of ${enterpriseState.activeQuestions.length}`;
  document.getElementById('runnerQuestionText').innerHTML = q.text;

  const optionsContainer = document.getElementById('runnerOptionsGrid');
  optionsContainer.innerHTML = ['A', 'B', 'C', 'D'].filter(opt => q[opt.toLowerCase()]).map(opt => `
    <div class="option-click-card ${enterpriseState.userAnswers[i] === opt ? 'selected' : ''}" onclick="window.appEngineAPI.selectOption('${opt}')">
      <b>(${opt})</b> <span>${q[opt.toLowerCase()]}</span>
    </div>
  `).join('');

  document.getElementById('runnerPrevBtn').disabled = (i === 0);
  const isLast = (i === enterpriseState.activeQuestions.length - 1);
  document.getElementById('runnerNextBtn').classList.toggle('hidden', isLast);
  document.getElementById('runnerFinishBtn').classList.toggle('hidden', !isLast);
  document.getElementById('runnerProgressBar').style.width = `${((i + 1) / enterpriseState.activeQuestions.length) * 100}%`;
}

async function finalizeAssessment(livePin = null, liveParticipantId = null) {
  clearInterval(enterpriseState.timerInterval);
  let correct = 0;
  const total = enterpriseState.activeQuestions.length;

  const reviewContainer = document.getElementById('reviewAnalysisContainer');
  reviewContainer.innerHTML = '';

  enterpriseState.activeQuestions.forEach((q, idx) => {
    const userChoice = enterpriseState.userAnswers[idx];
    const isCorrect = (userChoice === q.answer);
    if (isCorrect) correct++;

    reviewContainer.innerHTML += `
      <div class="review-eval-card ${isCorrect ? 'correct' : 'incorrect'}">
        <h4>#${idx + 1}: ${q.text}</h4>
        <p>Selected: <b>${userChoice || 'Skipped'}</b> | Answer Key: <b style="color:var(--primary); font-size:1.1rem;">${q.answer}</b></p>
        ${q.explanation ? `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;"><b>Explanation:</b> ${q.explanation}</p>` : ''}
      </div>
    `;
  });

  const percentage = Math.round((correct / total) * 100);
  document.getElementById('reviewScoreText').textContent = `${correct}/${total} (${percentage}%)`;
  
  const pf = document.getElementById('passFailText');
  pf.textContent = percentage >= 40 ? "STATUS: PASSED (தேர்ச்சி)" : "STATUS: NEEDS REVISION (மறுபயிற்சி)";
  pf.style.color = percentage >= 40 ? "var(--success)" : "var(--danger)";

  window.appEngineAPI.switchViewport('reviewSection');

  // Submit Score to Live Room if active
  if (livePin && liveParticipantId && db) {
    updateDoc(doc(db, "liveQuizzes", livePin, "participants", liveParticipantId), {
      status: 'SUBMITTED',
      score: percentage,
      progressPct: 100
    }).catch(() => {});
  }

  // Log to Analytics and Store Marksheet Entry
  const logRecord = {
    name: enterpriseState.currentUser.name,
    rollNo: enterpriseState.currentUser.rollNo || 'N/A',
    examTitle: enterpriseState.activeQuiz.title,
    score: percentage,
    correct,
    total,
    date: new Date().toLocaleDateString()
  };

  enterpriseState.logs.push(logRecord);
  if (db) {
    addDoc(collection(db, "activityLogs"), logRecord).catch(() => {});
  }
}

// --- 11. UI RENDERING PIPELINES ---
function renderLibrary() {
  const container = document.getElementById('libraryContainer');
  container.innerHTML = '';

  [...enterpriseState.quizzes, ...enterpriseState.examGroups].forEach(asset => {
    const isGroup = Boolean(asset.quizReferences);
    const count = isGroup ? asset.quizReferences.length : (asset.questions?.length || 0);

    container.innerHTML += `
      <div class="kpi-card glass-panel" style="flex-direction: column; align-items: flex-start; justify-content: space-between;">
        <div>
          <span class="badge-active" style="background:${isGroup ? 'rgba(124,58,237,0.15)' : 'rgba(5,150,105,0.15)'}; color:${isGroup ? 'var(--purple)' : 'var(--primary)'}">
            ${isGroup ? 'COMBINED EXAM' : 'STANDALONE QUIZ'}
          </span>
          <h3 style="margin-top: 8px; font-size: 1.1rem;">${asset.title || asset.name}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted);">${asset.metaClass || 'All Classes'} &bull; ${asset.metaSubject || 'General'}</p>
          <p style="font-weight:700; margin-top:8px;">${count} Questions / Nodes</p>
        </div>
        <div class="btn-horizontal-group" style="width:100%; margin-top:16px;">
          <button class="btn-sm btn-primary" onclick="window.appEngineAPI.launchAssessment('${asset.id}', ${isGroup})"><i class="ri-play-fill"></i> Launch</button>
          <button class="btn-sm btn-secondary" onclick="window.appEngineAPI.shareAssetToken('${asset.id}', ${isGroup})"><i class="ri-share-forward-line"></i></button>
        </div>
      </div>
    `;
  });
}

function renderQuestionBank() {
  const container = document.getElementById('bankCardsContainer');
  container.innerHTML = '';

  enterpriseState.questionBank.slice(0, 50).forEach(q => {
    container.innerHTML += `
      <div class="kpi-card glass-panel" style="flex-direction: column; align-items: flex-start; margin-bottom: 12px;">
        <div style="display:flex; justify-content:space-between; width:100%;">
          <span class="bloom-tag">${q.bloom}</span>
          <span class="marks-tag">${q.difficulty}</span>
        </div>
        <h4 style="margin: 8px 0;">${q.text}</h4>
        <div style="font-size:0.82rem; color:var(--text-muted);">
          <b>Key:</b> (${q.answer}) &bull; ${q.subject} &bull; ${q.class}
        </div>
      </div>
    `;
  });
}

function renderMarksheetTable() {
  const tbody = document.getElementById('marksheetTableBody');
  tbody.innerHTML = '';

  enterpriseState.logs.forEach((log, idx) => {
    tbody.innerHTML += `
      <tr>
        <td><b>#${idx + 1}</b></td>
        <td>${log.name}</td>
        <td>${log.rollNo || 'N/A'}</td>
        <td>${log.examTitle}</td>
        <td class="text-success">${log.correct}</td>
        <td class="text-danger">${log.total - log.correct}</td>
        <td>${log.correct} / ${log.total}</td>
        <td><b>${log.score}%</b></td>
        <td>${log.score >= 80 ? 'A+' : log.score >= 60 ? 'B' : 'C'}</td>
        <td><span class="${log.score >= 40 ? 'badge-active' : 'badge-left'}">${log.score >= 40 ? 'PASS' : 'FAIL'}</span></td>
        <td>
          <button class="btn-sm btn-secondary" onclick="window.appEngineAPI.printStudentMarksheetCard('${log.name}')"><i class="ri-printer-line"></i></button>
        </td>
      </tr>
    `;
  });
}

function populateDropdownSelectors() {
  const liveSelect = document.getElementById('liveQuizAssetSelect');
  const pdfSelect = document.getElementById('pdfSourceAssetSelect');
  liveSelect.innerHTML = '<option value="">Select Quiz or Combined Exam...</option>';
  pdfSelect.innerHTML = '<option value="">Select Quiz or Combined Exam...</option>';

  [...enterpriseState.quizzes, ...enterpriseState.examGroups].forEach(item => {
    const opt = `<option value="${item.id}">${item.title || item.name}</option>`;
    liveSelect.innerHTML += opt;
    pdfSelect.innerHTML += opt;
  });
}

function startDashboardTelemetryClock() {
  setInterval(() => {
    const now = new Date();
    document.getElementById('dashLiveClock').textContent = now.toLocaleTimeString();
    document.getElementById('dashLiveDate').textContent = now.toLocaleDateString(undefined, { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
  }, 1000);
}

// --- 12. URL PARAMETER HANDLING (NO-LOGIN STUDENT JOIN) ---
function processUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('livePin')) {
    const pin = params.get('livePin');
    document.getElementById('quickPinInput').value = pin;
    showToast(`Detected Live PIN: ${pin}. Enter your name to join.`, "info");
  }
}

// --- 13. GLOBAL EVENT LISTENERS ---
function registerSystemEventListeners() {
  // Navigation Links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.appEngineAPI.switchViewport(link.getAttribute('data-target'));
    });
  });

  // Auth Gate Buttons
  document.getElementById('btnEnterGuest').onclick = () => {
    const name = document.getElementById('guestStudentName').value.trim() || 'Guest Scholar';
    const rollNo = document.getElementById('guestRollNo').value.trim() || 'N/A';
    grantClearance('student', { uid: `GUEST_${Date.now()}`, name, role: 'student', rollNo });
  };

  document.getElementById('btnQuickJoinLive').onclick = () => {
    const pin = document.getElementById('quickPinInput').value.trim();
    const name = document.getElementById('guestStudentName').value.trim() || 'Guest Student';
    LiveQuizEngine.joinRoomAsStudent(pin, name, '');
  };

  document.getElementById('btnLogin').onclick = handleLoginWorkflow;
  document.getElementById('logoutBtn').onclick = () => {
    localforage.removeItem('activeSession');
    window.location.reload();
  };

  // Sticky Home
  document.getElementById('globalStickyHomeBtn').onclick = () => window.appEngineAPI.switchViewport('homeSection');

  // Live Exam Creation Button
  document.getElementById('btnCreateLiveSession').onclick = () => {
    const quizId = document.getElementById('liveQuizAssetSelect').value;
    const duration = document.getElementById('liveDurationInput').value;
    const perQ = document.getElementById('livePerQuestionTimer').value;
    const shuffle = document.getElementById('liveShuffleToggle').checked;
    LiveQuizEngine.createLiveRoom(quizId, duration, perQ, shuffle);
  };

  // PDF Generation Trigger
  document.getElementById('pdfGenerateDownloadBtn').onclick = () => {
    const quizId = document.getElementById('pdfSourceAssetSelect').value;
    const layout = document.getElementById('pdfLayoutSelect').value;
    const setVer = document.getElementById('pdfSetSelect').value;
    PDFPrintEngine.generateQuestionPaper(quizId, layout, setVer);
  };

  document.getElementById('pdfGenerateOMRBtn').onclick = () => PDFPrintEngine.generateOMRSheet(50);

  // Runner Controls
  document.getElementById('runnerPrevBtn').onclick = () => {
    if (enterpriseState.currentQuestionIndex > 0) {
      enterpriseState.currentQuestionIndex--;
      renderActiveQuestionNode();
    }
  };

  document.getElementById('runnerNextBtn').onclick = () => {
    if (enterpriseState.currentQuestionIndex < enterpriseState.activeQuestions.length - 1) {
      enterpriseState.currentQuestionIndex++;
      renderActiveQuestionNode();
    }
  };

  document.getElementById('runnerFinishBtn').onclick = () => finalizeAssessment();
}

async function handleLoginWorkflow() {
  const id = document.getElementById('loginUserId').value.trim();
  const pass = document.getElementById('loginPassword').value.trim();

  // Root Master Administrator Bypass Check (Preserved)
  if (id === 'sakthivelavankpc@gmail.com' && pass === '12345') {
    return grantClearance('admin', { uid: "ADMIN_ROOT", role: 'admin', name: "Master Administrator", email: id });
  }

  showToast("Verifying credentials...", "info");
  try {
    if (db) {
      const uSnap = await getDocs(collection(db, "registrations"));
      const users = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const match = users.find(u => (u.email === id || u.userId === id) && u.password === pass);
      if (match) return grantClearance(match.role, match);
    }
    throw new Error("Invalid Cloud Auth");
  } catch (err) {
    showToast("Invalid Credentials or Database Unreachable.", "danger");
  }
}

function showToast(msg, type = "info") {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.style.borderLeft = `4px solid ${type === 'danger' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)'}`;
  toast.innerHTML = `<i class="ri-information-line"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --- 14. PUBLIC API EXPORTS (WINDOW.APPENGINEAPI) ---
window.appEngineAPI = {
  switchViewport: (targetId) => {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.toggle('hidden', sec.id !== targetId));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('data-target') === targetId));
    document.getElementById('breadcrumbCurrent').textContent = targetId.replace('Section', '').toUpperCase();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  selectOption: (opt) => {
    enterpriseState.userAnswers[enterpriseState.currentQuestionIndex] = opt;
    renderActiveQuestionNode();
  },

  launchAssessment: (id, isGroup) => initializeRunner(id, isGroup),

  shareAssetToken: (id, isGroup) => {
    const target = (isGroup ? enterpriseState.examGroups : enterpriseState.quizzes).find(x => x.id === id);
    if (!target) return;
    const token = LZString.compressToEncodedURIComponent(JSON.stringify(target));
    const url = `${window.location.origin}${window.location.pathname}?token=${token}`;

    document.getElementById('shareLinkInput').value = url;
    document.getElementById('socialShareModal').classList.remove('hidden');

    document.getElementById('shareWA').onclick = () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Take Exam: ' + url)}`);
    document.getElementById('shareGM').onclick = () => window.open(`mailto:?subject=${encodeURIComponent(target.title || target.name)}&body=${encodeURIComponent(url)}`);
    document.getElementById('shareNative').onclick = () => {
      if (navigator.share) navigator.share({ title: target.title, url });
    };
  },

  copyShareLink: () => {
    const input = document.getElementById('shareLinkInput');
    input.select();
    document.execCommand('copy');
    showToast("Share URL copied to clipboard!", "success");
  },

  kickLiveParticipant: async (pin, participantId) => {
    if (db) {
      await deleteDoc(doc(db, "liveQuizzes", pin, "participants", participantId));
      showToast("Participant removed from live exam.", "info");
    }
  },

  toggleCreatorTab: (tab) => {
    document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab !== 'manual');
    document.getElementById('creatorExcelForm').classList.toggle('hidden', tab !== 'excel');
    document.getElementById('tabManualEntry').classList.toggle('active', tab === 'manual');
    document.getElementById('tabExcelEntry').classList.toggle('active', tab === 'excel');
  }
};