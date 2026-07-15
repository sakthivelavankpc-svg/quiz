import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- V27 FIREBASE INTEGRATION & AUTH ---
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
    console.error("Firebase Init Offline Bypass.");
}

// --- CORE ENTERPRISE STATE (Unified v29 Model) ---
const enterpriseState = {
  quizzes: [],
  examGroups: [],
  logs: [],
  activeQuiz: null,
  activeQuestions: [],
  userAnswers: {},
  currentQuestionIndex: 0,
  timerInterval: null,
  elapsedSeconds: 0,
  systemLogs: [],
  undoStack: [],
  redoStack: [],
  workspaceLayout: 'grid',
  activeGuide: 'quickstart',
  currentUser: { uid: 'GUEST', role: 'guest', name: 'Guest User' }
};

const guidesDatabase = {
  quickstart: { title: "System Overview Quickstart", body: "Welcome to the Quiz Master Pro Enterprise Management Studio. Use the sidebar matrices to access analytical structures, deploy testing modules, or modify parameters." },
  creator: { title: "Quiz Creator & Excel Framework Documentation", body: "Use the Studio to append schemas directly. The newly integrated SheetJS engine supports .xlsx files. Drag and drop bulk questions; the parser dynamically matches columns." },
  teacher: { title: "Pedagogical Execution Guide", body: "Deploy custom live runner instances directly to track candidate completion markers. Evaluates real-time via FireStore sync." },
  admin: { title: "Systems Governance Guide", body: "The management control layer facilitates full state resetting operations, handles systemic mock asset data injection pipelines, and acts as a single point of validation." }
};

let localCreatorQuestionArray = [];
let activeWorkspaceQuizReference = null;
let activeDraftCompositeIds = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    registerGlobalSystemEvents();
    await initializeAuthGates();
    syncUIStateTelemetry();
    triggerLogTrail("[INIT] Enterprise System Core Framework Initialized Successfully v29.");
  } catch (err) {
    console.error("Boot Error:", err);
  }
});

// --- AUTHENTICATION GATE LOGIC ---
async function initializeAuthGates() {
    const session = await localforage.getItem('activeSession');
    if (session) {
        grantAccess(session.role, session);
    } else {
        document.getElementById('welcomeGate').classList.remove('hidden');
        document.getElementById('appShell').classList.add('hidden');
        document.getElementById('globalStickyHomeBtn').classList.add('hidden');
    }

    document.getElementById('btnEnterGuest').onclick = () => grantAccess('guest', {uid:'GUEST', role:'guest', name:'Guest User'});
    document.getElementById('btnLogin').onclick = handleLogin;
    document.getElementById('btnRegister').onclick = handleRegister;
    
    // Explicit Logout FIX
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

async function handleLogin() {
    const id = document.getElementById('loginUserId').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();
    
    if(id === 'sakthivelavankpc@gmail.com' && pass === '12345') {
        grantAccess('admin', {uid: "ADMIN_NODE", role: 'admin', name: "Master Admin", email: id});
        return;
    }
    
    try {
        const uSnap = await getDocs(collection(db, "registrations"));
        const users = uSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const u = users.find(x => (x.email === id || x.userId === id) && x.password === pass);
        if(u) grantAccess(u.role, u);
        else displayNotificationToast("Invalid credentials", "error");
    } catch(e) {
        // Fallback offline mock login
        if (id && pass) grantAccess('student', {uid: `STU_${Date.now()}`, role:'student', name: id.split('@')[0]});
    }
}

async function handleRegister() {
    const role = document.getElementById('regRole').value;
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    if(!name || !email || !password) return displayNotificationToast("Fill all fields", "error");
    
    const payload = { role, name, email, password, userId: `${role==='teacher'?'TCH':'STU'}-${Math.floor(10000+Math.random()*90000)}` };
    try {
        if(db) await addDoc(collection(db, "registrations"), payload);
        displayNotificationToast("Registered Successfully", "success");
        grantAccess(payload.role, payload);
    } catch(e) { displayNotificationToast("Offline mode. Registered local.", "success"); grantAccess(payload.role, payload); }
}

async function handleLogout() {
    await localforage.removeItem('activeSession');
    enterpriseState.currentUser = { uid: 'GUEST', role: 'guest', name: 'Guest User' };
    window.location.reload();
}

async function grantAccess(role, profile) {
    enterpriseState.currentUser = profile;
    await localforage.setItem('activeSession', profile);
    
    document.getElementById('welcomeGate').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    document.getElementById('globalStickyHomeBtn').classList.remove('hidden');
    
    document.getElementById('headerUserBadge').textContent = profile.name;
    document.getElementById('welcomeUserName').textContent = profile.name;
    
    document.getElementById('profUid').value = profile.uid || profile.userId || 'N/A';
    document.getElementById('profRole').value = role.toUpperCase();
    document.getElementById('profNameInput').value = profile.name;

    // Role-based UI locking
    document.querySelectorAll('.auth-required').forEach(el => {
        if (role === 'guest' || role === 'student') el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    
    if (role === 'admin') document.getElementById('sidebarAdminLink').classList.remove('hidden');

    displayNotificationToast(`Welcome, ${profile.name}`, "success");
    await loadAndMigrateApplicationState();
}

// --- V27 -> V29 MIGRATION ENGINE (No Data Loss) ---
async function loadAndMigrateApplicationState() {
    displayNotificationToast("Synchronizing Cloud Vectors...", "success");
    
    const localCache = JSON.parse(localStorage.getItem('QMP_ENTERPRISE_CACHED_STATE') || '{"quizzes":[],"examGroups":[]}');
    enterpriseState.quizzes = localCache.quizzes || [];
    enterpriseState.examGroups = localCache.examGroups || [];
    
    try {
        if (db) {
            const [qSnap, gSnap, lSnap] = await Promise.all([
                getDocs(collection(db, "quizzes")),
                getDocs(collection(db, "exam_groups")),
                getDocs(collection(db, "activityLogs"))
            ]);
            
            // Migrate Quizzes
            qSnap.docs.forEach(doc => {
                const data = doc.data();
                if (!enterpriseState.quizzes.find(q => q.id === doc.id)) {
                    enterpriseState.quizzes.push({
                        id: doc.id,
                        title: data.metaExam || data.title || "Legacy Quiz",
                        description: data.metaSubject ? `${data.metaSubject} - ${data.metaTopic}` : (data.description || ""),
                        questions: (data.questions || []).map(q => ({
                            text: q.text,
                            a: q.options ? q.options[0] : (q.a || ''),
                            b: q.options ? q.options[1] : (q.b || ''),
                            c: q.options ? q.options[2] : (q.c || ''),
                            d: q.options ? q.options[3] : (q.d || ''),
                            answer: q.answer,
                            marks: q.marks || 5, time: q.time || 2
                        }))
                    });
                }
            });
            
            // Migrate Groups
            gSnap.docs.forEach(doc => {
                const data = doc.data();
                if (!enterpriseState.examGroups.find(g => g.id === doc.id)) {
                    enterpriseState.examGroups.push({
                        id: doc.id,
                        name: data.groupName || data.name || "Legacy Group",
                        description: data.subject || data.description || "",
                        quizReferences: data.quizIds || data.quizReferences || []
                    });
                }
            });

            enterpriseState.logs = lSnap.docs.map(d => d.data());
        }
    } catch(e) {
        console.warn("Offline DB Read bypass.", e);
    }

    persistApplicationStateToStorage();
    renderCentralAssetLibrary();
    renderRealtimeAnalyticsDashboard();
}

function persistApplicationStateToStorage() {
    localStorage.setItem('QMP_ENTERPRISE_CACHED_STATE', JSON.stringify({
        quizzes: enterpriseState.quizzes, examGroups: enterpriseState.examGroups
    }));
    syncUIStateTelemetry();
}

function syncUIStateTelemetry() {
    document.getElementById('statTotalQuizzes').textContent = enterpriseState.quizzes.length;
    document.getElementById('statTotalGroups').textContent = enterpriseState.examGroups.length;
    document.getElementById('statTotalUsers').textContent = enterpriseState.quizzes.reduce((acc, q) => acc + (q.questions?.length||0), 0);
}

// --- GLOBAL EVENT ROUTER ---
function registerGlobalSystemEvents() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchViewportContext(link.getAttribute('data-target'));
        });
    });

    document.getElementById('globalStickyHomeBtn').addEventListener('click', () => switchViewportContext('homeSection'));
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('appSidebar').classList.toggle('hidden');
        document.querySelector('.main-content').classList.toggle('expanded');
    });

    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        document.getElementById('themeToggleBtn').innerHTML = document.body.classList.contains('dark-mode') ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
    });

    document.getElementById('globalSearchInput').addEventListener('input', (e) => processGlobalAutocompleteQuery(e.target.value.trim()));

    // Creator logic
    document.getElementById('creatorAppendQuestionBtn').addEventListener('click', handleCreatorQuestionAppend);
    document.getElementById('creatorSaveQuizBtn').addEventListener('click', commitCompiledQuizToRepository);
    
    // Excel Engine logic
    const excelDropZone = document.getElementById('excelDropZone');
    excelDropZone.addEventListener('dragover', (e) => { e.preventDefault(); excelDropZone.classList.add('dragover'); });
    excelDropZone.addEventListener('dragleave', () => excelDropZone.classList.remove('dragover'));
    excelDropZone.addEventListener('drop', handleExcelDrop);
    document.getElementById('excelFileInput').addEventListener('change', handleExcelSelect);
    document.getElementById('commitExcelImportBtn').addEventListener('click', commitExcelToArray);

    // Workspace
    document.getElementById('wsToggleViewBtn').addEventListener('click', () => {
        enterpriseState.workspaceLayout = enterpriseState.workspaceLayout === 'grid' ? 'list' : 'grid';
        renderVisualWorkspaceBoard();
    });
    document.getElementById('wsPublishBtn').addEventListener('click', () => { persistApplicationStateToStorage(); displayNotificationToast("Workspace saved", "success"); });
    document.getElementById('wsUndoBtn').addEventListener('click', executeWorkspaceUndoAction);
    document.getElementById('wsRedoBtn').addEventListener('click', executeWorkspaceRedoAction);

    // Group Builder
    document.getElementById('groupShuffleBtn').addEventListener('click', () => { activeDraftCompositeIds.sort(()=>Math.random()-0.5); renderCompositeTargetZone(); });
    document.getElementById('groupDeduplicateBtn').addEventListener('click', () => { activeDraftCompositeIds = [...new Set(activeDraftCompositeIds)]; renderCompositeTargetZone(); });
    document.getElementById('groupCommitBtn').addEventListener('click', saveCombinedExamGroupToState);
    document.getElementById('groupInventorySearch').addEventListener('input', (e) => renderGroupInventorySelector(e.target.value.trim()));

    // Runner
    document.getElementById('runnerPrevBtn').addEventListener('click', stepBackRunnerQuestion);
    document.getElementById('runnerNextBtn').addEventListener('click', stepForwardRunnerQuestion);
    document.getElementById('runnerQuitBtn').addEventListener('click', () => switchViewportContext('librarySection'));
    document.getElementById('runnerFinishBtn').addEventListener('click', finalizeQuizEvaluationSession);
    document.getElementById('reviewCloseBtn').addEventListener('click', () => switchViewportContext('homeSection'));

    // Admin & PDF
    document.getElementById('adminResetDataBtn').addEventListener('click', () => { localStorage.removeItem('QMP_ENTERPRISE_CACHED_STATE'); window.location.reload(); });
    document.getElementById('adminForceSyncBtn').addEventListener('click', loadAndMigrateApplicationState);
    document.getElementById('pdfGenerateDownloadBtn').addEventListener('click', () => triggerHighFidelityPDFExport(false));
    document.getElementById('pdfGenerateKeyBtn').addEventListener('click', () => triggerHighFidelityPDFExport(true));
    document.getElementById('profileSaveBtn').addEventListener('click', () => {
        enterpriseState.currentUser.name = document.getElementById('profNameInput').value;
        document.getElementById('welcomeUserName').textContent = enterpriseState.currentUser.name;
        displayNotificationToast("Profile updated", "success");
    });

    // Guides
    document.querySelectorAll('.guide-tree-link').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.guide-tree-link').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActiveGuideView(btn.getAttribute('data-guide'));
        });
    });
}

function switchViewportContext(targetId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.toggle('hidden', sec.id !== targetId));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('data-target') === targetId));
    document.getElementById('breadcrumbCurrent').textContent = targetId.replace('Section', '').toUpperCase();

    if (targetId === 'librarySection') renderCentralAssetLibrary();
    if (targetId === 'workspaceSection') renderVisualWorkspaceBoard();
    if (targetId === 'groupsSection') { renderGroupInventorySelector(''); renderCompositeTargetZone(); }
    if (targetId === 'pdfSection') synchronizePDFSourceAssetSelector();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- GLOBAL SEARCH ---
function processGlobalAutocompleteQuery(term) {
    const container = document.getElementById('searchSuggestions');
    if (!term) return container.classList.add('hidden');
    container.innerHTML = '';
    
    let matches = enterpriseState.quizzes.filter(q => q.title.toLowerCase().includes(term.toLowerCase())).slice(0, 5);
    matches.forEach(q => {
        let div = document.createElement('div'); div.className = 'suggestion-item';
        div.innerHTML = `<i class="ri-file-list-3-line"></i> ${q.title}`;
        div.onclick = () => { container.classList.add('hidden'); document.getElementById('globalSearchInput').value=''; initializeLiveQuizAttemptRunner(q.id); };
        container.appendChild(div);
    });
    container.classList.remove('hidden');
}

// --- LIBRARY ---
function renderCentralAssetLibrary() {
    const wrapper = document.getElementById('libraryContainer');
    wrapper.innerHTML = '';
    
    [...enterpriseState.quizzes, ...enterpriseState.examGroups].forEach(asset => {
        const isGroup = !!asset.quizReferences;
        const count = isGroup ? asset.quizReferences.length : (asset.questions?.length||0);
        
        wrapper.innerHTML += `
            <div class="library-asset-card" style="border-top: 4px solid ${isGroup?'var(--success)':'var(--primary)'};">
                <div class="asset-card-meta">
                    <span style="font-size:0.7rem; background:${isGroup?'var(--success)':'var(--primary)'}; color:white; padding:2px 6px; border-radius:4px;">${isGroup?'COMBINED EXAM':'QUIZ MODULE'}</span>
                    <h3 style="margin-top:10px;">${asset.title || asset.name}</h3>
                    <p>${asset.description}</p>
                    <div style="font-size:0.8rem; font-weight:700; color:var(--text-light)">Contains: ${count} Nodes</div>
                </div>
                <div class="asset-action-row">
                    <button class="btn-primary" onclick="window.appEngineAPI.launchAsset('${asset.id}', ${isGroup})"><i class="ri-play-fill"></i> Launch</button>
                    ${!isGroup && enterpriseState.currentUser.role !== 'guest' ? `<button class="btn-secondary" onclick="window.appEngineAPI.stageWorkspace('${asset.id}')"><i class="ri-layout-grid-line"></i> Edit</button>` : ''}
                </div>
            </div>`;
    });
}

// --- DIRECT EXCEL IMPORT ENGINE (SheetJS) ---
let pendingExcelArray = [];

function handleExcelDrop(e) {
    e.preventDefault(); e.target.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) parseExcelFile(e.dataTransfer.files[0]);
}
function handleExcelSelect(e) { if(e.target.files.length > 0) parseExcelFile(e.target.files[0]); }

function parseExcelFile(file) {
    if(!window.XLSX) return displayNotificationToast("Excel Engine not loaded.", "error");
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(e.target.result, {type: 'binary'});
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ""});
            
            // Heuristic Column Mapping
            let hRow = data[0].map(h => String(h).toLowerCase().trim());
            let qIdx = hRow.findIndex(h => h.includes('question'));
            let aIdx = hRow.findIndex(h => h === 'a' || h.includes('option a') || h.includes('opt a'));
            let bIdx = hRow.findIndex(h => h === 'b' || h.includes('option b') || h.includes('opt b'));
            let cIdx = hRow.findIndex(h => h === 'c' || h.includes('option c') || h.includes('opt c'));
            let dIdx = hRow.findIndex(h => h === 'd' || h.includes('option d') || h.includes('opt d'));
            let ansIdx = hRow.findIndex(h => h.includes('answer') || h.includes('correct'));

            if(qIdx===-1 || aIdx===-1 || ansIdx===-1) return displayNotificationToast("Required columns missing (Question, Opt A, Answer)", "error");

            pendingExcelArray = [];
            for(let i=1; i<data.length; i++) {
                if(!data[i][qIdx]) continue;
                let ansText = String(data[i][ansIdx]).trim().toUpperCase();
                let finalAns = ['A','B','C','D'].includes(ansText) ? ansText : 'A';
                
                pendingExcelArray.push({
                    text: data[i][qIdx],
                    a: data[i][aIdx], b: data[i][bIdx], c: data[i][cIdx]||'', d: data[i][dIdx]||'',
                    answer: finalAns, marks: 5, time: 2
                });
            }
            
            renderExcelPreview();
        } catch(err) { displayNotificationToast("Corrupted Excel file.", "error"); }
    };
    reader.readAsBinaryString(file);
}

function renderExcelPreview() {
    document.getElementById('excelDropZone').classList.add('hidden');
    const preview = document.getElementById('excelPreviewContainer');
    preview.classList.remove('hidden');
    document.getElementById('excelParsedCount').textContent = pendingExcelArray.length;
    
    const tbody = document.querySelector('#excelPreviewTable tbody');
    tbody.innerHTML = pendingExcelArray.slice(0, 50).map(q => `<tr><td>${q.text.substring(0,40)}...</td><td>${q.a}</td><td>${q.b}</td><td><mark>${q.answer}</mark></td></tr>`).join('');
    if(pendingExcelArray.length > 50) tbody.innerHTML += `<tr><td colspan="4" style="text-align:center;">... and ${pendingExcelArray.length - 50} more.</td></tr>`;
}

function commitExcelToArray() {
    localCreatorQuestionArray = localCreatorQuestionArray.concat(pendingExcelArray);
    document.getElementById('pendingQuestionsCount').textContent = localCreatorQuestionArray.length;
    document.getElementById('excelDropZone').classList.remove('hidden');
    document.getElementById('excelPreviewContainer').classList.add('hidden');
    displayNotificationToast(`${pendingExcelArray.length} parsed items injected.`, "success");
    pendingExcelArray = [];
}

// --- CREATOR STUDIO MANUAL & PUBLISH ---
function handleCreatorQuestionAppend() {
    const q = {
        text: document.getElementById('qFormText').value,
        a: document.getElementById('qFormOptA').value, b: document.getElementById('qFormOptB').value,
        c: document.getElementById('qFormOptC').value, d: document.getElementById('qFormOptD').value,
        answer: document.getElementById('qFormAnswer').value, marks: 5, time: 2
    };
    if(!q.text || !q.a) return displayNotificationToast("Question text and Option A required.", "error");
    localCreatorQuestionArray.push(q);
    document.getElementById('pendingQuestionsCount').textContent = localCreatorQuestionArray.length;
    ['qFormText','qFormOptA','qFormOptB','qFormOptC','qFormOptD'].forEach(id => document.getElementById(id).value = '');
    displayNotificationToast("Node appended to volatile array.", "success");
}

async function commitCompiledQuizToRepository() {
    const title = document.getElementById('creatorQuizTitle').value.trim();
    if(!title || !localCreatorQuestionArray.length) return displayNotificationToast("Provide Title and Questions.", "error");
    
    const shuffle = document.getElementById('creatorShuffle').checked;
    const payload = { id: "quiz_" + Date.now(), title, description: document.getElementById('creatorQuizDescription').value, questions: localCreatorQuestionArray, shuffle };
    
    enterpriseState.quizzes.push(payload);
    persistApplicationStateToStorage();
    if(db) try { await setDoc(doc(db, "quizzes", payload.id), payload); } catch(e){}

    document.getElementById('creatorQuizTitle').value = '';
    localCreatorQuestionArray = [];
    document.getElementById('pendingQuestionsCount').textContent = 0;
    
    displayNotificationToast("Quiz Asset Published Globally.", "success");
    switchViewportContext('librarySection');
}

// --- VISUAL WORKSPACE ---
function renderVisualWorkspaceBoard() {
    const cvs = document.getElementById('visualCanvasContainer');
    cvs.className = enterpriseState.workspaceLayout === 'grid' ? 'visual-canvas-grid' : 'visual-canvas-list';
    if(!activeWorkspaceQuizReference) return cvs.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center;">No Asset Targeted.</div>';
    
    document.getElementById('wsActiveQuizName').textContent = activeWorkspaceQuizReference.title;
    document.getElementById('wsStatSelected').textContent = activeWorkspaceQuizReference.questions.length;

    cvs.innerHTML = activeWorkspaceQuizReference.questions.map((q, i) => `
        <div class="workspace-node-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', ${i})" ondragover="event.preventDefault()" ondrop="window.appEngineAPI.reorderNode(event, ${i})">
            <div class="node-card-header"><span class="node-badge">Node #${i+1}</span>
                <div class="node-actions">
                    <button class="btn-node-tool" onclick="window.appEngineAPI.duplicateNode(${i})"><i class="ri-file-copy-line"></i></button>
                    <button class="btn-node-tool" style="color:var(--danger)" onclick="window.appEngineAPI.purgeNode(${i})"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>
            <div class="node-card-body"><h4>${q.text}</h4>
                <div class="node-options-preview">
                    <div class="node-option-row ${q.answer==='A'?'correct-key':''}">${q.a}</div>
                    <div class="node-option-row ${q.answer==='B'?'correct-key':''}">${q.b}</div>
                </div>
            </div>
        </div>`).join('');
}

function executeWorkspaceUndoAction() {
    if(!enterpriseState.undoStack.length) return displayNotificationToast("No history.", "error");
    enterpriseState.redoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions));
    activeWorkspaceQuizReference.questions = JSON.parse(enterpriseState.undoStack.pop());
    renderVisualWorkspaceBoard();
}

function executeWorkspaceRedoAction() {
    if(!enterpriseState.redoStack.length) return displayNotificationToast("No redo history.", "error");
    enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions));
    activeWorkspaceQuizReference.questions = JSON.parse(enterpriseState.redoStack.pop());
    renderVisualWorkspaceBoard();
}

// --- COMBINED EXAMS ---
function renderGroupInventorySelector(term) {
    const box = document.getElementById('groupInventoryContainer');
    box.innerHTML = enterpriseState.quizzes.filter(q => q.title.toLowerCase().includes(term.toLowerCase()))
        .map(q => `<div class="inventory-item-row"><input type="checkbox" id="chk_${q.id}" ${activeDraftCompositeIds.includes(q.id)?'checked':''} onchange="window.appEngineAPI.toggleGroupRef('${q.id}')"> <label for="chk_${q.id}" style="cursor:pointer; font-size:0.85rem; font-weight:600;">${q.title}</label></div>`).join('');
}

function renderCompositeTargetZone() {
    const zone = document.getElementById('groupCompositeTargetContainer');
    document.getElementById('groupMetricCount').textContent = activeDraftCompositeIds.length;
    if(!activeDraftCompositeIds.length) return zone.innerHTML = '<div class="empty-zone-notice">Select blocks to compile.</div>';
    
    zone.innerHTML = activeDraftCompositeIds.map((id, i) => {
        const match = enterpriseState.quizzes.find(q => q.id === id);
        return `<div class="inventory-item-row" style="margin-bottom:10px;"><b>Block #${i+1}:</b> ${match?.title || 'Unknown'}</div>`;
    }).join('');
}

async function saveCombinedExamGroupToState() {
    const name = document.getElementById('groupNameInput').value;
    if(!name || !activeDraftCompositeIds.length) return displayNotificationToast("Name and nodes required.", "error");
    
    const payload = { id: "group_" + Date.now(), name, quizReferences: [...activeDraftCompositeIds] };
    enterpriseState.examGroups.push(payload);
    persistApplicationStateToStorage();
    if(db) try { await setDoc(doc(db, "exam_groups", payload.id), payload); } catch(e){}

    activeDraftCompositeIds = [];
    document.getElementById('groupNameInput').value = '';
    renderGroupInventorySelector('');
    renderCompositeTargetZone();
    displayNotificationToast("Group Generated.", "success");
}

// --- QUIZ RUNNER ---
function initializeLiveQuizAttemptRunner(id, isGroup = false) {
    let targetQuizzes = [];
    if(isGroup) {
        const group = enterpriseState.examGroups.find(g => g.id === id);
        group.quizReferences.forEach(ref => {
            const qz = enterpriseState.quizzes.find(q => q.id === ref);
            if(qz && qz.questions) targetQuizzes.push(...qz.questions);
        });
        enterpriseState.activeQuiz = { title: group.name, questions: targetQuizzes };
    } else {
        const qz = enterpriseState.quizzes.find(q => q.id === id);
        enterpriseState.activeQuiz = qz;
        targetQuizzes = [...qz.questions];
        if(qz.shuffle) targetQuizzes.sort(() => Math.random() - 0.5);
    }
    
    enterpriseState.activeQuestions = targetQuizzes;
    enterpriseState.userAnswers = {};
    enterpriseState.currentQuestionIndex = 0;
    enterpriseState.elapsedSeconds = 0;

    switchViewportContext('quizSection');
    document.getElementById('runnerQuizTitle').textContent = enterpriseState.activeQuiz.title;
    
    clearInterval(enterpriseState.timerInterval);
    enterpriseState.timerInterval = setInterval(() => {
        enterpriseState.elapsedSeconds++;
        const pad = v => String(v).padStart(2,'0');
        document.getElementById('runnerTimer').textContent = `${pad(Math.floor(enterpriseState.elapsedSeconds/60))}:${pad(enterpriseState.elapsedSeconds%60)}`;
    }, 1000);
    renderRunnerActiveQuestionIndex();
}

function renderRunnerActiveQuestionIndex() {
    const i = enterpriseState.currentQuestionIndex;
    const q = enterpriseState.activeQuestions[i];
    document.getElementById('runnerQuestionMeta').textContent = `Question ${i+1} of ${enterpriseState.activeQuestions.length}`;
    document.getElementById('runnerQuestionText').textContent = q.text;
    
    document.getElementById('runnerOptionsGrid').innerHTML = ['A','B','C','D'].filter(opt => q[opt.toLowerCase()]).map(opt => `
        <div class="option-click-card ${enterpriseState.userAnswers[i] === opt ? 'selected' : ''}" onclick="window.appEngineAPI.selectAnswer('${opt}')">
            <b>${opt}:</b> ${q[opt.toLowerCase()]}
        </div>`).join('');
    
    document.getElementById('runnerPrevBtn').disabled = i === 0;
    const isLast = i === enterpriseState.activeQuestions.length - 1;
    document.getElementById('runnerNextBtn').classList.toggle('hidden', isLast);
    document.getElementById('runnerFinishBtn').classList.toggle('hidden', !isLast);
    document.getElementById('runnerProgressBar').style.width = `${((i+1)/enterpriseState.activeQuestions.length)*100}%`;
}

function stepBackRunnerQuestion() { if(enterpriseState.currentQuestionIndex > 0) { enterpriseState.currentQuestionIndex--; renderRunnerActiveQuestionIndex(); } }
function stepForwardRunnerQuestion() { if(enterpriseState.currentQuestionIndex < enterpriseState.activeQuestions.length - 1) { enterpriseState.currentQuestionIndex++; renderRunnerActiveQuestionIndex(); } }

async function finalizeQuizEvaluationSession() {
    clearInterval(enterpriseState.timerInterval);
    let correct = 0, max = enterpriseState.activeQuestions.length;
    
    const container = document.getElementById('reviewAnalysisContainer'); container.innerHTML = '';
    
    enterpriseState.activeQuestions.forEach((q, i) => {
        const uAns = enterpriseState.userAnswers[i];
        if(uAns === q.answer.toUpperCase()) correct++;
        container.innerHTML += `<div class="review-eval-card ${uAns===q.answer?'correct':'incorrect'}">
            <h4>#${i+1}: ${q.text}</h4><p>You: <b>${uAns||'Skip'}</b> | Answer: <b>${q.answer}</b></p></div>`;
    });
    
    const scorePct = Math.round((correct/max)*100);
    document.getElementById('reviewScoreText').textContent = `${correct}/${max} (${scorePct}%)`;
    const pf = document.getElementById('passFailText');
    pf.textContent = scorePct >= 40 ? "PASS" : "FAIL";
    pf.style.color = scorePct >= 40 ? "var(--success)" : "var(--danger)";
    
    switchViewportContext('reviewSection');

    if(enterpriseState.currentUser.role !== 'guest') {
        const payload = { 
            name: enterpriseState.currentUser.name, exam: enterpriseState.activeQuiz.title, 
            score: scorePct, date: new Date().toISOString() 
        };
        enterpriseState.logs.push(payload);
        if(db) try { await addDoc(collection(db, "activityLogs"), payload); } catch(e){}
        renderRealtimeAnalyticsDashboard();
    }
}

// --- ANALYTICS & PDF ---
function renderRealtimeAnalyticsDashboard() {
    document.getElementById('anaTotalAttempts').textContent = enterpriseState.logs.length;
    const avg = enterpriseState.logs.length ? enterpriseState.logs.reduce((a,b)=>a+b.score,0)/enterpriseState.logs.length : 0;
    document.getElementById('anaAvgScore').textContent = `${avg.toFixed(1)}%`;
    
    document.getElementById('analyticsRecentTableBody').innerHTML = enterpriseState.logs.slice(-5).reverse().map(l => 
        `<tr><td>${l.name}</td><td>${l.exam}</td><td>${l.score}%</td></tr>`
    ).join('');

    document.getElementById('leaderboardTableBody').innerHTML = [...enterpriseState.logs].sort((a,b)=>b.score-a.score).map((l,i) => 
        `<tr><td>#${i+1}</td><td><b>${l.name}</b></td><td>${l.exam}</td><td>${l.score}%</td><td>${l.date.split('T')[0]}</td></tr>`
    ).join('');
}

function synchronizePDFSourceAssetSelector() {
    const sel = document.getElementById('pdfSourceAssetSelect');
    sel.innerHTML = '<option value="">Select Quiz...</option>' + enterpriseState.quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('');
    sel.onchange = (e) => {
        const q = enterpriseState.quizzes.find(x => x.id === e.target.value);
        if(q) document.getElementById('pdfDocumentSimulator').innerHTML = `<div class="sim-header">${q.title}</div><div class="sim-body">${q.questions.length} Items</div>`;
    };
}

function triggerHighFidelityPDFExport(isKey = false) {
    if(!window.jspdf) return displayNotificationToast("PDF Engine Error", "error");
    const qz = enterpriseState.quizzes.find(q => q.id === document.getElementById('pdfSourceAssetSelect').value);
    if(!qz) return displayNotificationToast("Select an asset", "error");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`QUIZ MASTER PRO: ${qz.title} ${isKey?'(ANSWER KEY)':''}`, 14, 20);
    
    let y = 30;
    qz.questions.forEach((q, i) => {
        if(y > 270) { doc.addPage(); y = 20; }
        doc.text(`${i+1}. ${q.text.substring(0, 80)}`, 14, y);
        if(isKey) { doc.text(`Answer: ${q.answer}`, 20, y+6); y+=14; } 
        else { doc.text(`A: ${q.a}   B: ${q.b}   C: ${q.c}   D: ${q.d}`, 20, y+6); y+=14; }
    });
    doc.save(`${qz.title.replace(/\s+/g, '_')}_${isKey?'Key':'Exam'}.pdf`);
}

function renderActiveGuideView(id) { document.getElementById('guideContentBody').innerHTML = `<h3>${guidesDatabase[id].title}</h3><p>${guidesDatabase[id].body}</p>`; }
function triggerLogTrail(msg) { document.getElementById('adminTerminalLogs').innerHTML += `<br/>[${new Date().toLocaleTimeString()}] ${msg}`; }
function displayNotificationToast(msg, type='success') {
    const t = document.createElement('div'); t.className = 'toast-message';
    t.style.borderLeftColor = type==='error' ? 'var(--danger)' : 'var(--primary)';
    t.textContent = msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(() => { t.style.animation = 'slideIn 0.2s reverse forwards'; setTimeout(()=>t.remove(),200); }, 3000);
}

// --- GLOBAL EXPORTS ---
window.appEngineAPI = {
    launchAsset: (id, isGroup) => initializeLiveQuizAttemptRunner(id, isGroup),
    stageWorkspace: (id) => { activeWorkspaceQuizReference = enterpriseState.quizzes.find(q=>q.id===id); switchViewportContext('workspaceSection'); },
    duplicateNode: (i) => { enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions)); activeWorkspaceQuizReference.questions.splice(i,0, JSON.parse(JSON.stringify(activeWorkspaceQuizReference.questions[i]))); renderVisualWorkspaceBoard(); },
    purgeNode: (i) => { enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions)); activeWorkspaceQuizReference.questions.splice(i,1); renderVisualWorkspaceBoard(); },
    reorderNode: (e, to) => { const from = parseInt(e.dataTransfer.getData('text/plain')); if(from===to) return; enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions)); const el = activeWorkspaceQuizReference.questions.splice(from,1)[0]; activeWorkspaceQuizReference.questions.splice(to,0,el); renderVisualWorkspaceBoard(); },
    toggleGroupRef: (id) => { activeDraftCompositeIds.includes(id) ? activeDraftCompositeIds.splice(activeDraftCompositeIds.indexOf(id),1) : activeDraftCompositeIds.push(id); renderCompositeTargetZone(); },
    selectAnswer: (opt) => { enterpriseState.userAnswers[enterpriseState.currentQuestionIndex] = opt; renderRunnerActiveQuestionIndex(); },
    toggleCreatorTab: (tab) => {
        document.getElementById('tabManual').classList.toggle('active', tab==='manual');
        document.getElementById('tabExcel').classList.toggle('active', tab==='excel');
        document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab!=='manual');
        document.getElementById('creatorExcelForm').classList.toggle('hidden', tab!=='excel');
    }
};