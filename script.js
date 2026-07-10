import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAnxIsftWdUxtHEh7nxX1UPRA29c0n1444",
    authDomain: "quiz-master-3e489.firebaseapp.com",
    projectId: "quiz-master-3e489",
    storageBucket: "quiz-master-3e489.firebasestorage.app",
    messagingSenderId: "741393992507",
    appId: "1:741393992507:web:b28cd8fcda2b74f85b851e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);

let globalQuizzes = [], globalGroups = [], globalUsers = [], globalLogs = [];
let currentUserRole = null; // 'guest', 'student', 'teacher', 'admin'
let userProfile = null;
let currentQuizData = null, currentQuestions = [], studentAnswers = {}, currentQIndex = 0;
let mainTimerInterval = null, mainSecondsLeft = 0;
let activeWorkspaceQuestions = [];

const Sanitizer = {
    clean(html) { if (!html) return ""; let t = document.createElement('div'); t.innerHTML = html; t.querySelectorAll('script, iframe, object, embed').forEach(el=>el.remove()); return t.innerHTML; },
    stripTags(html) { if (!html) return ""; let t = document.createElement('div'); t.innerHTML = html; return t.textContent || t.innerText || ""; }
};

function showToast(msg, type = 'info') {
    const c = $('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.background = type === 'error' ? 'var(--danger)' : (type === 'success' ? 'var(--success)' : '#1e293b');
    t.style.color = '#fff'; t.style.padding = '12px 24px'; t.style.borderRadius = '8px'; t.style.boxShadow = 'var(--shadow)';
    t.innerHTML = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function shuffleArray(arr) { let a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

window.addEventListener('load', async () => {
    initTheme();
    attachEventHandlers();
    await checkSessions();
    await fetchDatabases();
});

function initTheme() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    $('themeToggleBtn').onclick = () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    };
}

async function checkSessions() {
    const session = await localforage.getItem('activeSession');
    if (session) {
        currentUserRole = session.role;
        userProfile = session.profile;
        grantAccess(currentUserRole);
    }
}

async function fetchDatabases() {
    try {
        const [qSnap, gSnap, uSnap, lSnap] = await Promise.all([
            getDocs(collection(db, "quizzes")), getDocs(collection(db, "exam_groups")),
            getDocs(collection(db, "registrations")), getDocs(collection(db, "activityLogs"))
        ]);
        globalQuizzes = qSnap.docs.map(d => ({id: d.id, ...d.data()}));
        globalGroups = gSnap.docs.map(d => ({id: d.id, ...d.data()}));
        globalUsers = uSnap.docs.map(d => ({id: d.id, ...d.data()}));
        globalLogs = lSnap.docs.map(d => ({id: d.id, ...d.data()}));
        
        $('libCount').textContent = `${globalQuizzes.length + globalGroups.length} Active Deployments`;
        renderGlobalLibrary();
        renderLeaderboard();
        if(currentUserRole === 'admin') renderAdmin();
    } catch(e) { console.error(e); showToast("Database sync failed.", "error"); }
}

function attachEventHandlers() {
    // Auth Gates
    $('btnEnterGuest').onclick = () => grantAccess('guest');
    $('btnLogin').onclick = handleLogin;
    $('btnRegister').onclick = handleRegister;
    $('globalLogoutBtn').onclick = handleLogout;

    // Menus
    $('toggleAdminBtn').onclick = () => $('adminDashboardPanel').classList.toggle('hidden');
    $('toggleCreatorBtn').onclick = () => $('creatorPanel').classList.toggle('hidden');
    $('closeCreatorBtn').onclick = () => $('creatorPanel').classList.add('hidden');
    $('userProfileBtn').onclick = loadProfile;
    $('closeProfileBtn').onclick = () => $('profilePanel').classList.add('hidden');
    $('saveProfileBtn').onclick = saveProfile;
    $('toggleYoutubeSidebarBtn').onclick = () => $('youtubeSidebar').classList.toggle('hidden');
    $('closeYoutubeSidebarBtn').onclick = () => $('youtubeSidebar').classList.add('hidden');

    // Admin Tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
            e.target.classList.add('active');
            $(e.target.dataset.target).classList.remove('hidden');
        };
    });

    // Creator logic
    $('createManualBtn').onclick = () => { $('manualSection').classList.remove('hidden'); addManualRow(); };
    $('addRowBtn').onclick = addManualRow;
    $('loadManualToWorkspaceBtn').onclick = () => loadQuestionsIntoWorkspace(extractManualRows());
    $('csvFileInput').onchange = parseCSV;
    $('v18-excel-upload').onchange = parseExcel;
    $('workspaceTestBtn').onclick = runSandbox;
    $('workspacePublishBtn').onclick = publishQuiz;

    // Search & Filter
    $('globalSearchInput').oninput = debounce(handleSearch, 300);
    ['advFilterSubject', 'advFilterDistrict', 'advFilterCity', 'advFilterClass'].forEach(id => $(id).onchange = renderGlobalLibrary);
    ['lblFilterExam', 'lblFilterTopic', 'lblFilterSchool', 'lblFilterDistrict', 'lblFilterMetric'].forEach(id => $(id).onchange = renderLeaderboard);

    // Quiz runtime
    $('prevBtn').onclick = () => navQuiz(-1);
    $('nextBtn').onclick = () => navQuiz(1);
    $('finishBtn').onclick = finishQuiz;
    $('quitBtn').onclick = () => { clearInterval(mainTimerInterval); $('quizSection').classList.add('hidden'); $('librarySection').classList.remove('hidden'); };
    $('homeBtn_review').onclick = () => { $('reviewSection').classList.add('hidden'); $('librarySection').classList.remove('hidden'); };

    // Export PDF
    $('printPdfBtn').onclick = () => generatePDF('result');
    $('downloadAnswerKeyBtn').onclick = () => generatePDF('answer_key');
    $('exportLbPdf').onclick = () => generatePDF('leaderboard');
}

/* ================= AUTH & ACCESS ================= */
function grantAccess(role, profile = null) {
    currentUserRole = role;
    userProfile = profile;
    $('welcomeGate').classList.add('hidden');
    $('appContainer').classList.remove('hidden');
    $('globalLogoutBtn').classList.remove('hidden');
    $('studentInfoDisplay').classList.remove('hidden');
    
    // Default visibility clears
    $('toggleAdminBtn').classList.add('hidden');
    $('toggleCreatorBtn').classList.add('hidden');
    $('userProfileBtn').classList.add('hidden');
    $('v20-group-manager-panel').classList.add('hidden');
    document.querySelectorAll('.guest-hide').forEach(el => el.classList.remove('guest-hide'));

    if(role === 'guest') {
        $('dispName').textContent = "Guest User";
        $('dispRole').textContent = "Guest Access (No Saves)";
        document.querySelectorAll('.share-actions').forEach(el => el.classList.add('guest-hide')); 
    } else {
        $('userProfileBtn').classList.remove('hidden');
        $('dispName').textContent = profile.name;
        $('dispRole').textContent = role.toUpperCase();
        localforage.setItem('activeSession', {role, profile});
        
        if (role === 'teacher') {
            $('toggleCreatorBtn').classList.remove('hidden');
            $('v20-group-manager-panel').classList.remove('hidden');
        } else if (role === 'admin') {
            $('toggleAdminBtn').classList.remove('hidden');
            $('toggleCreatorBtn').classList.remove('hidden');
            $('v20-group-manager-panel').classList.remove('hidden');
            if(!localStorage.getItem('adminPasswordChanged')) $('adminPasswordResetModal').classList.remove('hidden');
            renderAdmin();
        }
    }
}

async function handleLogin() {
    const id = $('loginUserId').value.trim();
    const pass = $('loginPassword').value.trim();
    if(id === 'sakthivelavankpc@gmail.com' && pass === '12345') {
        grantAccess('admin', {name: "Master Admin", email: id});
    } else {
        const u = globalUsers.find(x => (x.email === id || x.userId === id) && x.password === pass);
        if(u) grantAccess(u.role, u);
        else showToast("Invalid credentials", "error");
    }
}

async function handleRegister() {
    const payload = {
        role: $('regRole').value, name: $('regName').value.trim(),
        email: $('regEmail').value.trim(), password: $('regPassword').value.trim(),
        userId: `${$('regRole').value === 'teacher' ? 'TCH' : 'STU'}-${Math.floor(10000+Math.random()*90000)}`,
        createdAt: new Date().toISOString()
    };
    if(!payload.name || !payload.email || !payload.password) return showToast("Fill all fields", "error");
    try {
        await addDoc(collection(db, "registrations"), payload);
        showToast("Registered Successfully", "success");
        grantAccess(payload.role, payload);
        fetchDatabases();
    } catch(e) { showToast("Registration failed", "error"); }
}

function handleLogout() {
    localforage.removeItem('activeSession');
    window.location.reload();
}

/* ================= PROFILE ================= */
function loadProfile() {
    if(!userProfile) return;
    $('profName').value = userProfile.name || "";
    $('profEmail').value = userProfile.email || "";
    $('profSchool').value = userProfile.school || "";
    $('profCity').value = userProfile.city || "";
    $('profDistrict').value = userProfile.district || "";
    $('profilePanel').classList.remove('hidden');
}

async function saveProfile() {
    if(currentUserRole === 'admin') return showToast("Admin profile locked", "warning");
    const np = $('profPassword').value.trim();
    const updates = {
        name: $('profName').value.trim(), school: $('profSchool').value.trim(),
        city: $('profCity').value.trim(), district: $('profDistrict').value.trim()
    };
    if(np) updates.password = np;
    
    try {
        await updateDoc(doc(db, "registrations", userProfile.id), updates);
        userProfile = {...userProfile, ...updates};
        localforage.setItem('activeSession', {role: currentUserRole, profile: userProfile});
        $('dispName').textContent = userProfile.name;
        showToast("Profile Updated", "success");
        $('profilePanel').classList.add('hidden');
    } catch(e) { showToast("Failed to update", "error"); }
}

/* ================= QUIZ & GROUP LOAD/PLAY (BUG FIXED) ================= */
function renderGlobalLibrary() {
    const grid = $('libraryGrid'); grid.innerHTML = "";
    const qTerm = $('globalSearchInput').value.toLowerCase().trim();
    
    globalQuizzes.forEach(q => {
        if(qTerm && !`${q.metaExam} ${q.metaTopic} ${q.metaSubject}`.toLowerCase().includes(qTerm)) return;
        grid.appendChild(createCard(q, 'quiz'));
    });
    globalGroups.forEach(g => {
        if(qTerm && !`${g.groupName} ${g.subject}`.toLowerCase().includes(qTerm)) return;
        grid.appendChild(createCard(g, 'group'));
    });
}

function createCard(item, type) {
    const d = document.createElement('div');
    d.className = `quiz-card ${type==='quiz'?'card-blue':'card-green'}`;
    const name = type==='quiz' ? item.metaExam : item.groupName;
    const count = type==='quiz' ? (item.questions?.length||0) : (item.questionCount||0);
    
    d.innerHTML = `
        <div><span class="card-badge">${type}</span></div>
        <h4 class="card-title">${name}</h4>
        <div class="card-sub">${count} Questions</div>
        <button class="btn-sm btn-primary" style="margin-top:10px;" onclick="window.triggerPlay('${item.id}', '${type}')"><i class="ri-play-fill"></i> Play Module</button>
    `;
    return d;
}

window.triggerPlay = async function(id, type) {
    let payload = null;
    if (type === 'group') {
        const g = globalGroups.find(x => x.id === id);
        if (!g) return showToast("Group not found.", "error");
        
        let agg = []; let tracked = new Set();
        // BUG FIX: Secure iteration over target component matrix
        for (let qid of g.quizIds) {
            try {
                let dSnap = await getDoc(doc(db, "quizzes", qid));
                if (dSnap.exists() && dSnap.data().questions) {
                    dSnap.data().questions.forEach(q => {
                        if(!tracked.has(q.text)) { tracked.add(q.text); agg.push(q); }
                    });
                }
            } catch(e) { console.warn("Skipped missing component matrix node", qid); }
        }
        if(agg.length === 0) return showToast("Target component matrix not resolved: Sub-modules deleted.", "error");
        payload = { metaExam: g.groupName, questions: agg, totalMarks: g.totalMarks, totalMinutes: 60, shuffleQuestions: true, minPassMarks: 40 };
    } else {
        payload = globalQuizzes.find(x => x.id === id);
    }
    
    currentQuizData = payload;
    startQuiz();
};

function startQuiz() {
    $('librarySection').classList.add('hidden');
    $('globalSearchPanel').classList.add('hidden');
    $('infoCardsSection').classList.add('hidden');
    $('homeYoutubeWidget').classList.add('hidden');
    $('fullLeaderboardPanel').classList.add('hidden');
    $('quizSection').classList.remove('hidden');

    currentQuestions = JSON.parse(JSON.stringify(currentQuizData.questions));
    if (currentQuizData.shuffleQuestions) currentQuestions = shuffleArray(currentQuestions);
    studentAnswers = {}; currentQIndex = 0;

    $('quizDisplayExamName').textContent = currentQuizData.metaExam;
    
    if(currentQuizData.totalMinutes > 0) {
        mainSecondsLeft = currentQuizData.totalMinutes * 60;
        mainTimerInterval = setInterval(() => {
            mainSecondsLeft--;
            const m = Math.floor(mainSecondsLeft/60).toString().padStart(2,'0');
            const s = (mainSecondsLeft%60).toString().padStart(2,'0');
            $('mainTimerLabel').textContent = `${m}:${s}`;
            if(mainSecondsLeft <= 0) finishQuiz();
        }, 1000);
    } else { $('mainTimerLabel').textContent = "Untimed"; }
    renderQuestion();
}

function renderQuestion() {
    const q = currentQuestions[currentQIndex];
    if(!q) return;
    $('questionProgressLabel').textContent = `Q ${currentQIndex + 1}/${currentQuestions.length}`;
    $('progressBarFill').style.width = `${((currentQIndex+1)/currentQuestions.length)*100}%`;
    $('questionBox').innerHTML = q.text;
    
    const ob = $('optionsBox'); ob.innerHTML = "";
    q.options.forEach((opt, i) => {
        const b = document.createElement('button'); b.className = "opt-btn";
        if(studentAnswers[currentQIndex] === opt) b.classList.add('selected');
        b.innerHTML = `<b>${String.fromCharCode(65+i)}:</b> ${opt}`;
        b.onclick = () => { studentAnswers[currentQIndex] = opt; renderQuestion(); };
        ob.appendChild(b);
    });

    $('prevBtn').disabled = (currentQIndex === 0);
    if(currentQIndex === currentQuestions.length - 1) { $('nextBtn').classList.add('hidden'); $('finishBtn').classList.remove('hidden'); }
    else { $('nextBtn').classList.remove('hidden'); $('finishBtn').classList.add('hidden'); }
}

function navQuiz(step) { currentQIndex += step; renderQuestion(); }

async function finishQuiz() {
    clearInterval(mainTimerInterval);
    $('quizSection').classList.add('hidden');
    $('reviewSection').classList.remove('hidden');
    
    let correct = 0;
    let html = "<div class='review-list'>";
    currentQuestions.forEach((q, i) => {
        const sel = studentAnswers[i] || "";
        const isC = sel.toLowerCase() === q.answer.toLowerCase();
        if(isC) correct++;
        html += `<div style="border-left: 5px solid ${isC?'var(--success)':'var(--danger)'}; background:var(--surface); padding:10px; margin-bottom:10px; border-radius:8px;">
            <p><b>Q${i+1}:</b> ${q.text}</p><p><b>You:</b> ${sel}</p><p><b>Ans:</b> ${q.answer}</p></div>`;
    });
    $('reviewTableContainer').innerHTML = html + "</div>";
    
    const score = ((correct/currentQuestions.length) * (currentQuizData.totalMarks||100)).toFixed(1);
    $('finalScoreDisplay').textContent = score;
    const passed = score >= (currentQuizData.minPassMarks||40);
    $('passFailText').textContent = passed ? "PASS" : "FAIL";
    $('passFailText').style.color = passed ? 'var(--success)' : 'var(--danger)';

    // Enforce Guest strict rules
    if(currentUserRole === 'guest') return;

    try {
        await addDoc(collection(db, "activityLogs"), {
            studentId: userProfile?.userId || 'ADMIN', name: userProfile?.name || 'Admin',
            examName: currentQuizData.metaExam, score: parseFloat(score), pass: passed, timestamp: new Date().toISOString()
        });
        fetchDatabases();
    } catch(e) {}
}

/* ================= CREATOR STUDIO ================= */
function addManualRow() {
    const tb = $('manualTable').querySelector('tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>#</td><td><input class="mq-txt"></td><td><input class="mq-a"></td><td><input class="mq-b"></td><td><input class="mq-c"></td><td><input class="mq-d"></td><td><input class="mq-ans"></td><td><button class="btn-icon" onclick="this.closest('tr').remove()"><i class="ri-close-line"></i></button></td>`;
    tb.appendChild(tr);
}
function extractManualRows() {
    let arr = [];
    document.querySelectorAll('#manualTable tbody tr').forEach(r => {
        const txt = r.querySelector('.mq-txt').value, ans = r.querySelector('.mq-ans').value;
        if(txt && ans) arr.push({text: txt, options: [r.querySelector('.mq-a').value, r.querySelector('.mq-b').value, r.querySelector('.mq-c').value, r.querySelector('.mq-d').value], answer: ans});
    });
    return arr;
}
function parseCSV(e) {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = (evt) => {
        let arr = [];
        evt.target.result.split('\n').forEach((l,i) => {
            if(i===0 || !l.trim()) return;
            let col = l.split(',');
            if(col.length >= 3) arr.push({text: col[0].trim(), options: col.slice(1, col.length-1).map(x=>x.trim()), answer: col[col.length-1].trim()});
        });
        loadQuestionsIntoWorkspace(arr);
    };
    r.readAsText(f);
}
function parseExcel(e) {
    const f = e.target.files[0]; if(!f || !window.XLSX) return;
    const r = new FileReader();
    r.onload = (evt) => {
        const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, {header:1});
        let arr = [];
        for(let i=1; i<data.length; i++) {
            if(data[i][0] && data[i][data[i].length-1]) arr.push({text: data[i][0], options: data[i].slice(1, data[i].length-1), answer: data[i][data[i].length-1]});
        }
        loadQuestionsIntoWorkspace(arr);
    };
    r.readAsArrayBuffer(f);
}
function loadQuestionsIntoWorkspace(arr) {
    activeWorkspaceQuestions = arr;
    $('workspaceQuestionCount').textContent = `${arr.length} Nodes`;
    $('enterpriseWorkspacePanel').classList.remove('hidden');
    $('creatorPanel').classList.add('hidden');
}
function runSandbox() {
    if(!activeWorkspaceQuestions.length) return;
    currentQuizData = { metaExam: "Sandbox Run", questions: activeWorkspaceQuestions, totalMarks: 100, shuffleQuestions: false };
    startQuiz();
}
async function publishQuiz() {
    if(!activeWorkspaceQuestions.length) return;
    const payload = {
        metaExam: $('metaExam').value || "Untiled Exam", metaSubject: $('metaSubject').value,
        totalMinutes: parseInt($('totalMinutes').value)||0, totalMarks: parseInt($('totalMarks').value)||100,
        questions: activeWorkspaceQuestions, creatorName: userProfile?.name || 'Admin',
        createdAt: new Date().toISOString()
    };
    try { await addDoc(collection(db, "quizzes"), payload); showToast("Published!", "success"); $('enterpriseWorkspacePanel').classList.add('hidden'); fetchDatabases(); } catch(e) {}
}

/* ================= LEADERBOARD & ADMIN ================= */
function renderLeaderboard() {
    const tb = $('adminLeaderboardTableBody'); if(!tb) return;
    tb.innerHTML = "";
    let logs = [...globalLogs].sort((a,b) => b.score - a.score); // Default High
    logs.forEach((l, i) => {
        tb.innerHTML += `<tr><td>#${i+1}</td><td>${l.studentId}</td><td><b>${l.name}</b></td><td>${l.school||'-'}</td><td>${l.district||'-'}</td><td><mark>${l.score}</mark></td><td>${l.timestamp.substring(0,10)}</td></tr>`;
    });
}

function renderAdmin() {
    $('anTotalUsers').textContent = globalUsers.length;
    $('anQuizzes').textContent = globalQuizzes.length;
    $('anGroups').textContent = globalGroups.length;
    $('anAttempts').textContent = globalLogs.length;

    $('adminUserTableBody').innerHTML = globalUsers.map(u => `<tr><td><b>${u.name}</b><br><small>${u.email}</small></td><td>${u.role}</td><td>${u.school||'-'}</td><td><button class="btn-sm btn-danger" onclick="alert('Delete user mapping bounds execution restricted')">Del</button></td></tr>`).join('');
    $('adminQuizTableBody').innerHTML = globalQuizzes.map(q => `<tr><td>${q.metaExam}</td><td>${q.metaSubject}</td><td>${q.creatorName}</td><td><button class="btn-sm btn-danger">Del</button></td></tr>`).join('');
}

/* ================= SEARCH ================= */
function debounce(func, wait) { let t; return function(...a) { clearTimeout(t); t = setTimeout(()=>func.apply(this,a), wait); }; }
function handleSearch(e) {
    const v = e.target.value.toLowerCase().trim();
    const sug = $('searchSuggestions');
    if(!v) { sug.classList.add('hidden'); renderGlobalLibrary(); return; }
    let matches = globalQuizzes.filter(q => q.metaExam.toLowerCase().includes(v)).slice(0,5);
    sug.innerHTML = matches.map(m => `<div class="suggestion-item" onclick="document.getElementById('globalSearchInput').value='${m.metaExam}'; document.getElementById('searchSuggestions').classList.add('hidden'); window.renderGlobalLibrary();"><b>Exam:</b> ${m.metaExam}</div>`).join('');
    sug.classList.remove('hidden');
    renderGlobalLibrary();
}
window.renderGlobalLibrary = renderGlobalLibrary;

/* ================= EXPORT PDF (jsPDF) ================= */
function generatePDF(type) {
    if (!window.jspdf) return showToast("PDF Engine Failed", "error");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("QUIZ MASTER PRO ENTERPRISE - SECURE RECORD", 14, 20);
    
    if(type === 'result') {
        doc.setFontSize(12);
        doc.text(`Candidate: ${userProfile?.name||'Guest'}`, 14, 30);
        doc.text(`Score: ${$('finalScoreDisplay').textContent}`, 14, 40);
        doc.save("Result.pdf");
    } else if (type === 'answer_key' && currentQuizData) {
        let rows = currentQuestions.map((q,i) => [`#${i+1}`, Sanitizer.stripTags(q.text), Sanitizer.stripTags(q.answer)]);
        doc.autoTable({ startY: 30, head: [['No.', 'Question', 'Answer']], body: rows });
        doc.save("AnswerKey.pdf");
    } else if (type === 'leaderboard') {
        let rows = globalLogs.map((l,i) => [`#${i+1}`, l.name, l.examName, l.score]);
        doc.autoTable({ startY: 30, head: [['Rank', 'Name', 'Exam', 'Score']], body: rows });
        doc.save("Leaderboard.pdf");
    }
}