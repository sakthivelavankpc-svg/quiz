// ==========================================================================
// System Architecture & State
// ==========================================================================
const AppState = {
    user: null, // null = not logged in, object = user data { name, role: 'guest'|'student'|'teacher'|'admin' }
    quizzes: [], // Array of quiz objects
    activeQuiz: null,
    currentAttempt: null
};

// Elements - Gate
const welcomeGate = document.getElementById('welcomeGate');
const appShell = document.getElementById('appShell');
const headerUserBadge = document.getElementById('headerUserBadge');
const welcomeUserName = document.getElementById('welcomeUserName');
const toastContainer = document.getElementById('toastContainer');

// ==========================================================================
// Initialization & Utility
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    setupAuthListeners();
    setupNavigation();
    setupCreator();
    setupQuizRunner();
    setupThemeToggle();
});

async function initDB() {
    try {
        const storedQuizzes = await localforage.getItem('qmp_quizzes');
        if (storedQuizzes) AppState.quizzes = storedQuizzes;
    } catch (err) {
        console.error("LocalForage Init Error", err);
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="ri-${type === 'success' ? 'check-line' : 'error-warning-line'}"></i> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ==========================================================================
// Authentication
// ==========================================================================
function setupAuthListeners() {
    document.getElementById('btnEnterGuest').addEventListener('click', () => login('Guest', 'guest'));
    document.getElementById('btnLogin').addEventListener('click', () => {
        const uid = document.getElementById('loginUserId').value;
        const role = uid.toLowerCase().includes('admin') ? 'admin' : (uid.toLowerCase().includes('teach') ? 'teacher' : 'student');
        login(uid || 'User', role);
    });
    document.getElementById('btnRegister').addEventListener('click', () => {
        const name = document.getElementById('regName').value;
        const role = document.getElementById('regRole').value;
        login(name || 'New User', role);
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function login(name, role) {
    AppState.user = { name, role };
    welcomeGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    
    headerUserBadge.textContent = `${role.toUpperCase()}: ${name}`;
    welcomeUserName.textContent = name;
    
    // Auth UI enforcement
    document.querySelectorAll('.auth-required').forEach(el => {
        if(role === 'guest' || role === 'student') el.style.display = 'none';
        else el.style.display = 'flex';
    });
    
    const adminLink = document.getElementById('sidebarAdminLink');
    if (role === 'admin') adminLink.classList.remove('hidden');
    else adminLink.classList.add('hidden');

    switchSection('homeSection');
    updateDashboardStats();
    showToast(`Welcome, ${name}!`);
}

function logout() {
    AppState.user = null;
    appShell.classList.add('hidden');
    welcomeGate.classList.remove('hidden');
    showToast('Logged out securely.', 'success');
}

// ==========================================================================
// Navigation & Routing
// ==========================================================================
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.getElementById('breadcrumbCurrent').textContent = link.querySelector('span').textContent;
            switchSection(targetId);
            
            if(window.innerWidth <= 768) {
                document.getElementById('appSidebar').classList.remove('mobile-open');
            }
        });
    });

    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('appSidebar').classList.toggle('mobile-open');
    });
}

function switchSection(sectionId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');

    if (sectionId === 'librarySection') renderLibrary();
    if (sectionId === 'pdfSection') populatePDFDropdown();
}

function setupThemeToggle() {
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
    });
}

function updateDashboardStats() {
    document.getElementById('statTotalQuizzes').textContent = AppState.quizzes.length;
    document.getElementById('statTotalUsers').textContent = Math.floor(Math.random() * 500) + 150; // Mock data
}

// ==========================================================================
// Creator Studio
// ==========================================================================
let tempQuestions = [];

function setupCreator() {
    const tabManual = document.getElementById('tabManual');
    const tabExcel = document.getElementById('tabExcel');
    const creatorQuestionForm = document.getElementById('creatorQuestionForm');
    const creatorExcelForm = document.getElementById('creatorExcelForm');

    tabManual.addEventListener('click', () => {
        tabManual.classList.add('active'); tabExcel.classList.remove('active');
        creatorQuestionForm.classList.remove('hidden'); creatorExcelForm.classList.add('hidden');
    });
    
    tabExcel.addEventListener('click', () => {
        tabExcel.classList.add('active'); tabManual.classList.remove('active');
        creatorExcelForm.classList.remove('hidden'); creatorQuestionForm.classList.add('hidden');
    });

    document.getElementById('creatorAppendQuestionBtn').addEventListener('click', appendManualQuestion);
    document.getElementById('creatorSaveQuizBtn').addEventListener('click', saveQuizToDB);
    
    // Basic Excel drop zone logic
    const dropZone = document.getElementById('excelDropZone');
    const fileInput = document.getElementById('excelFileInput');
    
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleExcelUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files.length) handleExcelUpload(e.target.files[0]);
    });
}

function appendManualQuestion() {
    const qText = document.getElementById('qFormText').value.trim();
    const optA = document.getElementById('qFormOptA').value.trim();
    const optB = document.getElementById('qFormOptB').value.trim();
    const optC = document.getElementById('qFormOptC').value.trim();
    const optD = document.getElementById('qFormOptD').value.trim();
    const ans = document.getElementById('qFormAnswer').value;

    if (!qText || !optA || !optB) return showToast("Question and at least 2 options required", "error");

    tempQuestions.push({
        id: Date.now().toString(),
        text: qText,
        options: { A: optA, B: optB, C: optC, D: optD },
        answer: ans
    });

    document.getElementById('pendingQuestionsCount').textContent = tempQuestions.length;
    showToast("Node appended to memory array");
    
    // Clear fields
    ['qFormText', 'qFormOptA', 'qFormOptB', 'qFormOptC', 'qFormOptD'].forEach(id => document.getElementById(id).value = '');
}

async function saveQuizToDB() {
    const title = document.getElementById('creatorQuizTitle').value.trim();
    if (!title || tempQuestions.length === 0) return showToast("Title and at least one question required", "error");

    const newQuiz = {
        id: 'quiz_' + Date.now(),
        title: title,
        desc: document.getElementById('creatorQuizDescription').value.trim(),
        questions: [...tempQuestions],
        dateCreated: new Date().toISOString()
    };

    AppState.quizzes.push(newQuiz);
    await localforage.setItem('qmp_quizzes', AppState.quizzes);
    
    tempQuestions = [];
    document.getElementById('pendingQuestionsCount').textContent = "0";
    document.getElementById('creatorQuizTitle').value = '';
    document.getElementById('creatorQuizDescription').value = '';
    
    showToast("Quiz committed to database!", "success");
    updateDashboardStats();
}

function handleExcelUpload(file) {
    // Requires SheetJS (xlsx.full.min.js) loaded in HTML
    if (typeof XLSX === 'undefined') {
        return showToast("Excel parser library missing", "error");
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, {header: 1}); // Array of arrays
            
            // Assume format: Row 0 is headers. Row 1+ is data: [Question, OptA, OptB, OptC, OptD, AnswerKey]
            let added = 0;
            for(let i = 1; i < json.length; i++) {
                const row = json[i];
                if(row.length >= 6 && row[0]) {
                    tempQuestions.push({
                        id: Date.now().toString() + i,
                        text: row[0],
                        options: { A: row[1], B: row[2], C: row[3], D: row[4] },
                        answer: row[5].toString().toUpperCase().trim()
                    });
                    added++;
                }
            }
            document.getElementById('pendingQuestionsCount').textContent = tempQuestions.length;
            showToast(`Successfully extracted ${added} rows from Excel`, 'success');
        } catch(err) {
            showToast("Failed to parse Excel file", "error");
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ==========================================================================
// Library & Quiz Execution
// ==========================================================================
function renderLibrary() {
    const container = document.getElementById('libraryContainer');
    container.innerHTML = '';

    if (AppState.quizzes.length === 0) {
        container.innerHTML = `<p style="color:var(--text-light);">Inventory empty. Deploy assets via Creator Studio.</p>`;
        return;
    }

    AppState.quizzes.forEach(quiz => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.innerHTML = `
            <div>
                <div class="quiz-card-header">
                    <div class="quiz-card-title">${quiz.title}</div>
                    <div class="quiz-card-meta">
                        <span><i class="ri-list-check"></i> ${quiz.questions.length} Nodes</span>
                        <span><i class="ri-time-line"></i> ${new Date(quiz.dateCreated).toLocaleDateString()}</span>
                    </div>
                </div>
                <p style="font-size:0.9rem; color:var(--text-light);">${quiz.desc || 'No structural description provided.'}</p>
            </div>
            <div class="quiz-card-actions">
                <button class="btn-primary btn-full play-btn" data-id="${quiz.id}"><i class="ri-play-fill"></i> Execute Matrix</button>
            </div>
        `;
        
        card.querySelector('.play-btn').addEventListener('click', () => startQuiz(quiz.id));
        container.appendChild(card);
    });
}

let runnerInterval;

function startQuiz(quizId) {
    const quiz = AppState.quizzes.find(q => q.id === quizId);
    if (!quiz || quiz.questions.length === 0) return showToast("Invalid structural matrix", "error");

    AppState.activeQuiz = quiz;
    AppState.currentAttempt = {
        currentIndex: 0,
        answers: {}, // map question id to selected option ('A','B' etc)
        startTime: Date.now()
    };

    document.getElementById('runnerQuizTitle').textContent = quiz.title;
    switchSection('quizSection');
    renderQuestionNode();
    
    // Simple Timer Setup
    clearInterval(runnerInterval);
    const timerEl = document.getElementById('runnerTimer');
    let elapsed = 0;
    runnerInterval = setInterval(() => {
        elapsed++;
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }, 1000);
}

function renderQuestionNode() {
    const { currentIndex, answers } = AppState.currentAttempt;
    const questions = AppState.activeQuiz.questions;
    const q = questions[currentIndex];

    // UI Updates
    document.getElementById('runnerQuestionMeta').textContent = `Parameter Node ${currentIndex + 1} of ${questions.length}`;
    document.getElementById('runnerProgressBar').style.width = `${((currentIndex) / questions.length) * 100}%`;
    document.getElementById('runnerQuestionText').textContent = q.text;

    const grid = document.getElementById('runnerOptionsGrid');
    grid.innerHTML = '';
    
    Object.keys(q.options).forEach(key => {
        if(!q.options[key]) return; // Skip empty options
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (answers[q.id] === key) btn.classList.add('selected');
        
        btn.innerHTML = `<strong>${key}.</strong> ${q.options[key]}`;
        btn.addEventListener('click', () => {
            AppState.currentAttempt.answers[q.id] = key;
            renderQuestionNode(); // re-render to update selected state
        });
        grid.appendChild(btn);
    });

    // Button states
    const btnPrev = document.getElementById('runnerPrevBtn');
    const btnNext = document.getElementById('runnerNextBtn');
    const btnFinish = document.getElementById('runnerFinishBtn');

    btnPrev.style.visibility = currentIndex === 0 ? 'hidden' : 'visible';
    
    if (currentIndex === questions.length - 1) {
        btnNext.classList.add('hidden');
        btnFinish.classList.remove('hidden');
    } else {
        btnNext.classList.remove('hidden');
        btnFinish.classList.add('hidden');
    }
}

function setupQuizRunner() {
    document.getElementById('runnerPrevBtn').addEventListener('click', () => {
        if (AppState.currentAttempt.currentIndex > 0) {
            AppState.currentAttempt.currentIndex--;
            renderQuestionNode();
        }
    });

    document.getElementById('runnerNextBtn').addEventListener('click', () => {
        const { currentIndex } = AppState.currentAttempt;
        const questions = AppState.activeQuiz.questions;
        if (currentIndex < questions.length - 1) {
            AppState.currentAttempt.currentIndex++;
            renderQuestionNode();
        }
    });

    document.getElementById('runnerQuitBtn').addEventListener('click', () => {
        clearInterval(runnerInterval);
        switchSection('librarySection');
    });

    document.getElementById('runnerFinishBtn').addEventListener('click', finishQuizAttempt);
}

function finishQuizAttempt() {
    clearInterval(runnerInterval);
    document.getElementById('runnerProgressBar').style.width = '100%';
    
    const questions = AppState.activeQuiz.questions;
    const answers = AppState.currentAttempt.answers;
    
    let score = 0;
    const reviewData = questions.map(q => {
        const isCorrect = answers[q.id] === q.answer;
        if(isCorrect) score++;
        return {
            question: q.text,
            userAns: answers[q.id] || 'Unanswered',
            correctAns: q.answer,
            options: q.options,
            isCorrect
        };
    });

    // Render Review Section
    switchSection('reviewSection');
    
    document.getElementById('reviewScoreText').textContent = `${score} / ${questions.length}`;
    const percent = Math.round((score / questions.length) * 100);
    const pfText = document.getElementById('passFailText');
    pfText.textContent = `${percent}% - ${percent >= 70 ? 'METRICS SATISFACTORY' : 'SUBOPTIMAL EXECUTION'}`;
    pfText.style.color = percent >= 70 ? 'var(--success)' : 'var(--danger)';

    const reviewContainer = document.getElementById('reviewAnalysisContainer');
    reviewContainer.innerHTML = '';
    
    reviewData.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `review-card ${item.isCorrect ? 'correct' : 'incorrect'}`;
        card.innerHTML = `
            <div class="review-question">${index + 1}. ${item.question}</div>
            <div class="review-answer-row">
                <span style="color: ${item.isCorrect ? 'var(--success)' : 'var(--danger)'}">Candidate: <strong>${item.userAns}</strong></span>
                ${!item.isCorrect ? `<span style="color: var(--success)">Target Key: <strong>${item.correctAns}</strong></span>` : ''}
            </div>
            <div style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">
                ${item.options[item.correctAns] ? 'Ref: ' + item.options[item.correctAns] : ''}
            </div>
        `;
        reviewContainer.appendChild(card);
    });

    document.getElementById('reviewCloseBtn').onclick = () => switchSection('homeSection');
}

// ==========================================================================
// PDF Generation Center
// ==========================================================================
function populatePDFDropdown() {
    const select = document.getElementById('pdfSourceAssetSelect');
    select.innerHTML = '<option value="">Select Quiz Source Data Node...</option>';
    AppState.quizzes.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.id;
        opt.textContent = q.title;
        select.appendChild(opt);
    });
}

document.getElementById('pdfGenerateDownloadBtn').addEventListener('click', () => generatePDF(false));
document.getElementById('pdfGenerateKeyBtn').addEventListener('click', () => generatePDF(true));

function generatePDF(isAnswerKey) {
    if (typeof window.jspdf === 'undefined') return showToast("jsPDF library not loaded", "error");
    
    const quizId = document.getElementById('pdfSourceAssetSelect').value;
    if (!quizId) return showToast("No target source selected", "error");

    const quiz = AppState.quizzes.find(q => q.id === quizId);
    const { jsPDF } = window.jspdf;
    
    // Get orientation
    const orient = document.getElementById('pdfOrientation').value === 'landscape' ? 'l' : 'p';
    const doc = new jsPDF(orient, 'pt', 'a4');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(quiz.title.toUpperCase(), 40, 50);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated by Quiz Master Pro Enterprise | ${isAnswerKey ? 'ANSWER KEY REPORT' : 'EVALUATION MATRIX'}`, 40, 70);
    
    if (quiz.desc) doc.text(quiz.desc, 40, 90, { maxWidth: doc.internal.pageSize.width - 80 });

    let yPos = quiz.desc ? 120 : 100;
    const bodyData = [];

    quiz.questions.forEach((q, i) => {
        let optString = `A) ${q.options.A || ''}\nB) ${q.options.B || ''}\nC) ${q.options.C || ''}\nD) ${q.options.D || ''}`;
        if(isAnswerKey) {
            bodyData.push([`${i+1}`, q.text, q.answer, q.options[q.answer] || '']);
        } else {
            bodyData.push([`${i+1}`, q.text, optString]);
        }
    });

    if (isAnswerKey) {
        doc.autoTable({
            startY: yPos,
            head: [['No.', 'Question Node', 'Key', 'Target Reference String']],
            body: bodyData,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] }
        });
    } else {
        doc.autoTable({
            startY: yPos,
            head: [['No.', 'Question Prompt', 'Available Vectors']],
            body: bodyData,
            theme: 'striped',
            styles: { cellPadding: 8, fontSize: 10 },
            headStyles: { fillColor: [30, 41, 59] },
            columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 150 } }
        });
    }

    const fileName = `${quiz.title.replace(/\s+/g, '_')}_${isAnswerKey ? 'KEY' : 'DOC'}.pdf`;
    doc.save(fileName);
    showToast(`Compiled Document: ${fileName}`, 'success');
}