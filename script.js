import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- V34 FIREBASE INTEGRATION & AUTH MODEL ---
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

// --- CORE ENTERPRISE STATE (Unified v34 Model) ---
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
  creator: { title: "Quiz Creator & Excel Framework Documentation", body: "Use the Studio to append schemas directly. The newly integrated SheetJS engine natively parses bold/italic styling tags from your source worksheets using '.h' metadata structure." },
  teacher: { title: "Pedagogical Execution Guide", body: "Deploy custom live runner instances directly to track candidate completion markers. Evaluates real-time via FireStore sync." },
  admin: { title: "Systems Governance Guide", body: "The management control layer facilitates full state resetting operations, handles systemic mock asset data injection pipelines, and acts as a single point of validation." }
};

let localCreatorQuestionArray = [];
let activeWorkspaceQuizReference = null;
let activeDraftCompositeIds = [];
let currentlyEditingNodeIndex = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    registerGlobalSystemEvents();
    await initializeAuthGates();
    triggerLogTrail("[INIT] Enterprise System Core Framework Initialized Successfully v34.");
  } catch (err) {
    console.error("Boot Error:", err);
  }
});

// --- AUTHENTICATION GATE LOGIC ---
async function initializeAuthGates() {
    const session = await localforage.getItem('activeSession');
    if (session) {
        await grantAccess(session.role, session);
    } else {
        document.getElementById('welcomeGate').classList.remove('hidden');
        document.getElementById('appShell').classList.add('hidden');
        document.getElementById('globalStickyHomeBtn').classList.add('hidden');
    }

    document.getElementById('btnEnterGuest').onclick = () => grantAccess('guest', {uid:'GUEST', role:'guest', name:'Guest User'});
    document.getElementById('btnLogin').onclick = handleLogin;
    document.getElementById('btnRegister').onclick = handleRegister;
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

async function handleLogin() {
    const id = document.getElementById('loginUserId').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();
    
    if(id === 'sakthivelavankpc@gmail.com' && pass === '12345') {
        return grantAccess('admin', {uid: "ADMIN_NODE", role: 'admin', name: "Master Admin", email: id});
    }
    
    try {
        if(db) {
            const uSnap = await getDocs(collection(db, "registrations"));
            const users = uSnap.docs.map(d => ({id: d.id, ...d.data()}));
            const u = users.find(x => (x.email === id || x.userId === id) && x.password === pass);
            if(u) return grantAccess(u.role, u);
        }
        throw new Error("Invalid Cloud Credentials");
    } catch(e) {
        let offlineUsers = JSON.parse(localStorage.getItem('QMP_OFFLINE_USERS') || '[]');
        const localU = offlineUsers.find(x => (x.email === id || x.userId === id) && x.password === pass);
        if (localU) return grantAccess(localU.role, localU);
        
        displayNotificationToast("Invalid credentials or Database is unreachable.", "error");
    }
}

async function handleRegister() {
    const role = document.getElementById('regRole').value;
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    if(!name || !email || !password) return displayNotificationToast("Fill all fields", "error");
    
    const payload = { role, name, email, password, userId: `${role.substring(0,3).toUpperCase()}-${Math.floor(10000+Math.random()*90000)}` };
    
    let offlineUsers = JSON.parse(localStorage.getItem('QMP_OFFLINE_USERS') || '[]');
    offlineUsers.push(payload);
    localStorage.setItem('QMP_OFFLINE_USERS', JSON.stringify(offlineUsers));

    try {
        if(db) await addDoc(collection(db, "registrations"), payload);
        displayNotificationToast("Registered Successfully", "success");
    } catch(e) { 
        displayNotificationToast("Offline mode. Registered local.", "success"); 
    }
    grantAccess(payload.role, payload);
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

    document.querySelectorAll('.auth-required').forEach(el => {
        if (role === 'guest' || role === 'student') el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    
    if (role === 'admin') document.getElementById('sidebarAdminLink').classList.remove('hidden');

    displayNotificationToast(`Welcome, ${profile.name}`, "success");
    await loadAndMigrateApplicationState();
}

// --- V34 SAFE CLOUD-MERGE ENGINE ---
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
            
            qSnap.docs.forEach(doc => {
                const data = doc.data();
                const existingIndex = enterpriseState.quizzes.findIndex(q => q.id === doc.id);
                const quizObj = {
                    id: doc.id,
                    title: data.title || data.metaExam || "Legacy Quiz",
                    description: data.description || "",
                    metaClass: data.metaClass || "",
                    metaSubject: data.metaSubject || "",
                    metaTopic: data.metaTopic || "",
                    questions: data.questions || [],
                    shuffle: data.shuffle || false
                };
                if(existingIndex === -1) enterpriseState.quizzes.push(quizObj);
                else enterpriseState.quizzes[existingIndex] = quizObj;
            });
            
            gSnap.docs.forEach(doc => {
                const data = doc.data();
                const existingIndex = enterpriseState.examGroups.findIndex(g => g.id === doc.id);
                const groupObj = {
                    id: doc.id,
                    name: data.name || data.groupName || "Legacy Group",
                    quizReferences: data.quizReferences || data.quizIds || []
                };
                if(existingIndex === -1) enterpriseState.examGroups.push(groupObj);
                else enterpriseState.examGroups[existingIndex] = groupObj;
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

    // Creator to Workspace bridge logic
    document.getElementById('creatorAppendQuestionBtn').addEventListener('click', handleCreatorQuestionAppend);
    document.getElementById('creatorToWorkspaceBtn').addEventListener('click', transferCreatorToWorkspace);
    
    // Excel Engine logic
    const excelDropZone = document.getElementById('excelDropZone');
    excelDropZone.addEventListener('dragover', (e) => { e.preventDefault(); excelDropZone.classList.add('dragover'); });
    excelDropZone.addEventListener('dragleave', () => excelDropZone.classList.remove('dragover'));
    excelDropZone.addEventListener('drop', handleExcelDrop);
    document.getElementById('excelFileInput').addEventListener('change', handleExcelSelect);
    document.getElementById('commitExcelImportBtn').addEventListener('click', commitExcelToArray);

    // Workspace logic
    document.getElementById('wsToggleViewBtn').addEventListener('click', () => {
        enterpriseState.workspaceLayout = enterpriseState.workspaceLayout === 'grid' ? 'list' : 'grid';
        renderVisualWorkspaceBoard();
    });
    document.getElementById('wsPublishBtn').addEventListener('click', publishWorkspaceState);
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
    document.getElementById('runnerQuitBtn').addEventListener('click', () => {
        clearInterval(enterpriseState.timerInterval);
        switchViewportContext('librarySection');
    });
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

// --- LIBRARY (WITH ADMIN DELETE & COLOR CARDS) ---
function renderCentralAssetLibrary() {
    const wrapper = document.getElementById('libraryContainer');
    wrapper.innerHTML = '';
    
    [...enterpriseState.quizzes, ...enterpriseState.examGroups].forEach(asset => {
        const isGroup = !!asset.quizReferences;
        const count = isGroup ? asset.quizReferences.length : (asset.questions?.length||0);
        
        let metaTags = '';
        if(!isGroup && asset.metaClass) metaTags += `<span class="meta-pill">${asset.metaClass}</span>`;
        if(!isGroup && asset.metaSubject) metaTags += `<span class="meta-pill">${asset.metaSubject}</span>`;
        if(!isGroup && asset.metaTopic) metaTags += `<span class="meta-pill">${asset.metaTopic}</span>`;

        wrapper.innerHTML += `
            <div class="library-asset-card ${isGroup ? 'group-card' : 'quiz-card'}">
                <div class="asset-card-meta">
                    <span style="font-size:0.7rem; background:${isGroup?'var(--success)':'var(--primary)'}; color:white; padding:2px 6px; border-radius:4px; margin-bottom:8px; display:inline-block;">${isGroup?'COMBINED EXAM':'QUIZ MODULE'}</span>
                    <h3 style="margin-top:5px; margin-bottom: 5px;">${asset.title || asset.name}</h3>
                    <div style="margin-bottom: 10px;">${metaTags}</div>
                    <p style="font-size: 0.85rem; color:var(--text-light);">${asset.description || ""}</p>
                    <div style="font-size:0.8rem; font-weight:700; color:var(--text-main); margin-top:10px;">Contains: ${count} Nodes</div>
                </div>
                <div class="asset-action-row" style="flex-wrap:wrap;">
                    <button class="btn-primary" onclick="window.appEngineAPI.launchAsset('${asset.id}', ${isGroup})"><i class="ri-play-fill"></i> Launch</button>
                    ${!isGroup && enterpriseState.currentUser.role !== 'guest' ? `<button class="btn-secondary" onclick="window.appEngineAPI.stageWorkspace('${asset.id}')"><i class="ri-layout-grid-line"></i> Edit Canvas</button>` : ''}
                    ${enterpriseState.currentUser.role === 'admin' ? `<button class="btn-danger" style="margin-left:auto;" onclick="window.appEngineAPI.deleteAsset('${asset.id}', ${isGroup})"><i class="ri-delete-bin-line"></i> Delete</button>` : ''}
                </div>
            </div>`;
    });
}

// --- EXCEL IMPORT ENGINE ---
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
            
            const rawData = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ""});
            if (rawData.length === 0) throw new Error("Empty worksheet.");

            let hRow = rawData[0].map(h => String(h).toLowerCase().trim());
            let qIdx = hRow.findIndex(h => h.includes('question'));
            let aIdx = hRow.findIndex(h => h === 'a' || h.includes('option a') || h.includes('opt a'));
            let bIdx = hRow.findIndex(h => h === 'b' || h.includes('option b') || h.includes('opt b'));
            let cIdx = hRow.findIndex(h => h === 'c' || h.includes('option c') || h.includes('opt c'));
            let dIdx = hRow.findIndex(h => h === 'd' || h.includes('option d') || h.includes('opt d'));
            let ansIdx = hRow.findIndex(h => h.includes('answer') || h.includes('correct'));

            if(qIdx===-1 || aIdx===-1 || ansIdx===-1) {
                return displayNotificationToast("Required columns missing (Question, Opt A, Answer)", "error");
            }

            pendingExcelArray = [];
            const range = XLSX.utils.decode_range(ws['!ref']);

            const getCellContent = (R, C) => {
                if (C === -1) return "";
                const cell = ws[XLSX.utils.encode_cell({r: R, c: C})];
                if (!cell) return "";
                let content = cell.h ? cell.h : (cell.w ? cell.w : cell.v);
                return String(content).trim();
            };

            for(let R = 1; R <= range.e.r; R++) {
                let qText = getCellContent(R, qIdx);
                if(!qText) continue;

                let aText = getCellContent(R, aIdx);
                let bText = getCellContent(R, bIdx);
                let cText = getCellContent(R, cIdx);
                let dText = getCellContent(R, dIdx);
                let ansRaw = getCellContent(R, ansIdx);

                let cleanAns = ansRaw.replace(/<[^>]*>?/gm, '').trim().toUpperCase();
                let cleanA = aText.replace(/<[^>]*>?/gm, '').trim().toUpperCase();
                let cleanB = bText.replace(/<[^>]*>?/gm, '').trim().toUpperCase();
                let cleanC = cText.replace(/<[^>]*>?/gm, '').trim().toUpperCase();
                let cleanD = dText.replace(/<[^>]*>?/gm, '').trim().toUpperCase();

                let finalAns = 'A'; 

                if (['A','B','C','D'].includes(cleanAns)) {
                    finalAns = cleanAns;
                } else {
                    if (cleanAns === cleanB) finalAns = 'B';
                    else if (cleanAns === cleanC) finalAns = 'C';
                    else if (cleanAns === cleanD) finalAns = 'D';
                    else if (cleanAns === cleanA) finalAns = 'A';
                    else finalAns = 'A'; 
                }
                
                pendingExcelArray.push({
                    text: qText,
                    a: aText,
                    b: bText,
                    c: cText,
                    d: dText,
                    answer: finalAns,
                    marks: 5,
                    time: 2
                });
            }
            
            renderExcelPreview();
        } catch(err) { 
            console.error(err);
            displayNotificationToast("Corrupted Excel file parsing structure.", "error"); 
        }
    };
    reader.readAsBinaryString(file);
}

function renderExcelPreview() {
    document.getElementById('excelDropZone').classList.add('hidden');
    const preview = document.getElementById('excelPreviewContainer');
    preview.classList.remove('hidden');
    document.getElementById('excelParsedCount').textContent = pendingExcelArray.length;
    
    const tbody = document.querySelector('#excelPreviewTable tbody');
    tbody.innerHTML = pendingExcelArray.slice(0, 50).map(q => 
        `<tr><td>${q.text.substring(0,80)}...</td><td>${q.a}</td><td>${q.b}</td><td><mark style="font-weight:bold;">${q.answer}</mark></td></tr>`
    ).join('');
    if(pendingExcelArray.length > 50) tbody.innerHTML += `<tr><td colspan="4" style="text-align:center;">... and ${pendingExcelArray.length - 50} more.</td></tr>`;
}

function commitExcelToArray() {
    localCreatorQuestionArray = localCreatorQuestionArray.concat(pendingExcelArray);
    document.getElementById('pendingQuestionsCount').textContent = localCreatorQuestionArray.length;
    document.getElementById('excelDropZone').classList.remove('hidden');
    document.getElementById('excelPreviewContainer').classList.add('hidden');
    displayNotificationToast(`${pendingExcelArray.length} parsed items injected. Ready to Transfer to Workspace.`, "success");
    pendingExcelArray = [];
}

// --- CREATOR STUDIO MANUAL ---
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

// --- CREATOR TO WORKSPACE BRIDGE ---
function transferCreatorToWorkspace() {
    if(!localCreatorQuestionArray.length) return displayNotificationToast("Provide Questions in the Array first.", "error");

    const title = document.getElementById('creatorQuizTitle').value.trim() || `Draft Matrix ${new Date().toLocaleTimeString()}`;
    const desc = document.getElementById('creatorQuizDescription').value;
    const mClass = document.getElementById('creatorClass').value.trim();
    const mSubject = document.getElementById('creatorSubject').value.trim();
    const mTopic = document.getElementById('creatorTopic').value.trim();
    
    activeWorkspaceQuizReference = {
        id: "quiz_" + Date.now(),
        title: title,
        description: desc,
        metaClass: mClass,
        metaSubject: mSubject,
        metaTopic: mTopic,
        questions: [...localCreatorQuestionArray],
        shuffle: document.getElementById('creatorShuffle').checked,
        createdAt: new Date().toISOString()
    };

    document.getElementById('creatorQuizTitle').value = '';
    document.getElementById('creatorClass').value = '';
    document.getElementById('creatorSubject').value = '';
    document.getElementById('creatorTopic').value = '';
    document.getElementById('creatorQuizDescription').value = '';
    localCreatorQuestionArray = [];
    document.getElementById('pendingQuestionsCount').textContent = 0;
    
    displayNotificationToast("Asset generated. Review and Adjust within Workspace.", "success");
    switchViewportContext('workspaceSection');
}

// --- VISUAL WORKSPACE CANVAS ---
function renderVisualWorkspaceBoard() {
    const cvs = document.getElementById('visualCanvasContainer');
    cvs.className = enterpriseState.workspaceLayout === 'grid' ? 'visual-canvas-grid' : 'visual-canvas-list';
    
    if(!activeWorkspaceQuizReference || !activeWorkspaceQuizReference.questions) {
        document.getElementById('wsActiveQuizName').textContent = "None Loaded";
        document.getElementById('wsStatSelected').textContent = "0";
        return cvs.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center; color: var(--text-light); font-weight:600;">No Target Asset Configured. Transfer a quiz from Creator or Edit via Library.</div>';
    }
    
    document.getElementById('wsActiveQuizName').textContent = activeWorkspaceQuizReference.title;
    document.getElementById('wsStatSelected').textContent = activeWorkspaceQuizReference.questions.length;

    cvs.innerHTML = activeWorkspaceQuizReference.questions.map((q, i) => `
        <div class="workspace-node-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', ${i})" ondragover="event.preventDefault()" ondrop="window.appEngineAPI.reorderNode(event, ${i})">
            <div class="node-card-header"><span class="node-badge">Node #${i+1}</span>
                <div class="node-actions">
                    <button class="btn-node-tool" style="color:var(--primary)" onclick="window.appEngineAPI.openEditModal(${i})"><i class="ri-edit-2-line"></i></button>
                    <button class="btn-node-tool" onclick="window.appEngineAPI.duplicateNode(${i})"><i class="ri-file-copy-line"></i></button>
                    <button class="btn-node-tool" style="color:var(--danger)" onclick="window.appEngineAPI.purgeNode(${i})"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>
            <div class="node-card-body"><div style="font-weight: 500; font-size: 0.95rem; margin-bottom: 8px;">${q.text}</div>
                <div class="node-options-preview">
                    <div class="node-option-row ${q.answer==='A'?'correct-key':''}">${q.a || ''}</div>
                    <div class="node-option-row ${q.answer==='B'?'correct-key':''}">${q.b || ''}</div>
                    ${q.c ? `<div class="node-option-row ${q.answer==='C'?'correct-key':''}">${q.c}</div>` : ''}
                    ${q.d ? `<div class="node-option-row ${q.answer==='D'?'correct-key':''}">${q.d}</div>` : ''}
                </div>
            </div>
        </div>`).join('');
}

function executeWorkspaceUndoAction() {
    if(!enterpriseState.undoStack.length || !activeWorkspaceQuizReference) return displayNotificationToast("No history.", "error");
    enterpriseState.redoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions));
    activeWorkspaceQuizReference.questions = JSON.parse(enterpriseState.undoStack.pop());
    renderVisualWorkspaceBoard();
}

function executeWorkspaceRedoAction() {
    if(!enterpriseState.redoStack.length || !activeWorkspaceQuizReference) return displayNotificationToast("No redo history.", "error");
    enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions));
    activeWorkspaceQuizReference.questions = JSON.parse(enterpriseState.redoStack.pop());
    renderVisualWorkspaceBoard();
}

// Publish from Workspace to actual DB
async function publishWorkspaceState() {
    if(!activeWorkspaceQuizReference) return displayNotificationToast("No active workspace asset to publish", "error");
    if(!activeWorkspaceQuizReference.questions.length) return displayNotificationToast("Cannot save empty quiz.", "error");

    const existingIdx = enterpriseState.quizzes.findIndex(q => q.id === activeWorkspaceQuizReference.id);
    
    if (existingIdx >= 0) enterpriseState.quizzes[existingIdx] = activeWorkspaceQuizReference;
    else enterpriseState.quizzes.push(activeWorkspaceQuizReference);
    
    persistApplicationStateToStorage();
    
    if(db) {
        try {
            await setDoc(doc(db, "quizzes", activeWorkspaceQuizReference.id), activeWorkspaceQuizReference);
            displayNotificationToast("Asset Published & Synced to Cloud DB Successfully", "success");
        } catch(e) {
            displayNotificationToast("Asset Saved Locally (Operating Offline)", "success");
        }
    } else {
        displayNotificationToast("Asset Saved Locally (Operating Offline)", "success");
    }
    
    renderCentralAssetLibrary(); 
    switchViewportContext('librarySection');
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
    
    const payload = { 
        id: "group_" + Date.now(), 
        name, 
        quizReferences: [...activeDraftCompositeIds],
        createdAt: new Date().toISOString()
    };
    enterpriseState.examGroups.push(payload);
    persistApplicationStateToStorage();
    if(db) try { await setDoc(doc(db, "exam_groups", payload.id), payload); } catch(e){}

    activeDraftCompositeIds = [];
    document.getElementById('groupNameInput').value = '';
    renderGroupInventorySelector('');
    renderCompositeTargetZone();
    displayNotificationToast("Group Generated.", "success");
}

// --- SECURE QUIZ RUNNER UI ---
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
    
    document.getElementById('runnerQuestionText').innerHTML = q.text; 
    
    document.getElementById('runnerOptionsGrid').innerHTML = ['A','B','C','D'].filter(opt => q[opt.toLowerCase()]).map(opt => `
        <div class="option-click-card ${enterpriseState.userAnswers[i] === opt ? 'selected' : ''}" onclick="window.appEngineAPI.selectAnswer('${opt}')">
            <b>${opt}:</b> <span class="opt-text">${q[opt.toLowerCase()]}</span>
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
            <h4 style="margin-bottom:8px;">#${i+1}: ${q.text}</h4><p>You Selected: <b>${uAns||'Skip'}</b> | Answer Key Matrix: <b>${q.answer}</b></p></div>`;
    });
    
    const scorePct = Math.round((correct/max)*100);
    document.getElementById('reviewScoreText').textContent = `${correct}/${max} (${scorePct}%)`;
    const pf = document.getElementById('passFailText');
    pf.textContent = scorePct >= 40 ? "EVALUATION PASS" : "EVALUATION FAIL";
    pf.style.color = scorePct >= 40 ? "var(--success)" : "var(--danger)";
    
    switchViewportContext('reviewSection');

    if(enterpriseState.currentUser.role !== 'guest') {
        const payload = { 
            uid: enterpriseState.currentUser.uid,
            name: enterpriseState.currentUser.name, 
            exam: enterpriseState.activeQuiz.title, 
            score: scorePct, 
            date: new Date().toISOString() 
        };
        enterpriseState.logs.push(payload);
        if(db) try { await addDoc(collection(db, "activityLogs"), payload); } catch(e){}
        renderRealtimeAnalyticsDashboard();
    }
}

// --- ANALYTICS & PDF MATRIX (HIGH FIDELITY WYSIWYG) ---
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
    sel.innerHTML = '<option value="">Select Quiz Matrix Configuration...</option>' + enterpriseState.quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('');
    
    sel.onchange = (e) => {
        const q = enterpriseState.quizzes.find(x => x.id === e.target.value);
        if(q) {
            document.getElementById('pdfExamName').value = q.title || '';
            document.getElementById('pdfClass').value = q.metaClass || '';
            document.getElementById('pdfSubject').value = q.metaSubject || '';
            document.getElementById('pdfTopic').value = q.metaTopic || '';
            document.getElementById('pdfDocumentSimulator').innerHTML = `<div class="sim-header">${q.title}</div><div class="sim-body">Evaluation Sequence Length: ${q.questions.length} Items</div>`;
        }
    };
}

// Generates a robust hidden DOM to perfectly capture exact styling to Canvas and PDF format
async function triggerHighFidelityPDFExport(isKey = false) {
    if(!window.jspdf || !window.html2canvas || !window.QRCode) return displayNotificationToast("PDF rendering engines initializing. Please try again.", "error");
    
    const qz = enterpriseState.quizzes.find(q => q.id === document.getElementById('pdfSourceAssetSelect').value);
    if(!qz) return displayNotificationToast("Select an asset source.", "error");

    const eName = document.getElementById('pdfExamName').value || q.title || 'Assessment';
    const eClass = document.getElementById('pdfClass').value || '___';
    const eSubject = document.getElementById('pdfSubject').value || '___';
    const eTopic = document.getElementById('pdfTopic').value || '___';
    const tMarks = document.getElementById('pdfMarksInput').value || 'N/A';
    const tTime = document.getElementById('pdfTimeInput').value || 'N/A';

    displayNotificationToast("Compiling Document Geometry... Please wait.", "success");

    // Pre-Generate QR Code to a Canvas
    const qrDiv = document.createElement('div');
    new QRCode(qrDiv, { text: "https://www.youtube.com/@KALVIKADAL", width: 80, height: 80 });
    const qrCanvas = qrDiv.querySelector('canvas');
    const qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/png') : null;

    // Construct a staging container mimicking real paper, append to body but hide it via z-index
    const printDiv = document.createElement('div');
    printDiv.className = 'pdf-print-container';
    printDiv.style.width = '800px'; 
    printDiv.style.padding = '40px';
    printDiv.style.fontFamily = "'Inter', 'Arial', sans-serif";
    printDiv.style.color = '#000000';
    printDiv.style.background = '#ffffff';
    printDiv.style.position = 'absolute';
    printDiv.style.top = '0'; 
    printDiv.style.left = '0';
    printDiv.style.zIndex = '-9999';
    
    let htmlContent = `
        <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 25px;">
            <h1 style="font-size: 26px; margin-bottom: 12px; font-weight: bold; color: #000;">${eName} ${isKey ? '(ANSWER KEY)' : ''}</h1>
            <div style="font-size: 14px; display: flex; justify-content: space-between; max-width: 650px; margin: 0 auto; font-weight: bold;">
                <span>Class: <span style="font-weight:normal;">${eClass}</span></span>
                <span>Subject: <span style="font-weight:normal;">${eSubject}</span></span>
                <span>Topic: <span style="font-weight:normal;">${eTopic}</span></span>
            </div>
            <div style="font-size: 14px; display: flex; justify-content: space-between; max-width: 650px; margin: 8px auto 0; font-weight: bold;">
                <span>Total Marks: <span style="font-weight:normal;">${tMarks}</span></span>
                <span>Time Allowed: <span style="font-weight:normal;">${tTime} Mins</span></span>
            </div>
        </div>
    `;

    qz.questions.forEach((q, i) => {
        htmlContent += `<div style="margin-bottom:24px; font-size: 15px; page-break-inside: avoid; color: #000;">`;
        htmlContent += `<div style="display:flex; margin-bottom:10px;"><strong style="margin-right:8px; min-width: 25px;">${i+1}.</strong> <div style="flex:1;">${q.text}</div></div>`;
        
        if(isKey) {
            htmlContent += `<div style="margin-left:33px; padding: 6px 12px; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; color: #065f46; font-weight: bold;">Target Key: ${q.answer}</div>`;
        } else {
            // Options grouped in 2-line using strictly inline-block layouts to bypass flex render bugs in html2canvas
            htmlContent += `<div style="margin-left: 33px; margin-top: 5px;">`;
            
            // Line 1: A and B
            htmlContent += `<div style="margin-bottom: 8px; width: 100%;">`;
            if(q.a) htmlContent += `<div style="display: inline-block; width: 49%; vertical-align: top;"><strong style="margin-right:4px;">A)</strong> <span style="display:inline-block; vertical-align:top; width:calc(100% - 25px);">${q.a}</span></div>`;
            if(q.b) htmlContent += `<div style="display: inline-block; width: 49%; vertical-align: top;"><strong style="margin-right:4px;">B)</strong> <span style="display:inline-block; vertical-align:top; width:calc(100% - 25px);">${q.b}</span></div>`;
            htmlContent += `</div>`;
            
            // Line 2: C and D
            if(q.c || q.d) {
                htmlContent += `<div style="width: 100%;">`;
                if(q.c) htmlContent += `<div style="display: inline-block; width: 49%; vertical-align: top;"><strong style="margin-right:4px;">C)</strong> <span style="display:inline-block; vertical-align:top; width:calc(100% - 25px);">${q.c}</span></div>`;
                if(q.d) htmlContent += `<div style="display: inline-block; width: 49%; vertical-align: top;"><strong style="margin-right:4px;">D)</strong> <span style="display:inline-block; vertical-align:top; width:calc(100% - 25px);">${q.d}</span></div>`;
                htmlContent += `</div>`;
            }
            htmlContent += `</div>`;
        }
        htmlContent += `</div>`;
    });

    printDiv.innerHTML = htmlContent;
    document.body.appendChild(printDiv);

    try {
        // Await high-fidelity canvas snapshot
        const canvas = await html2canvas(printDiv, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4'); 
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;
        
        const addQRCodetoPage = () => {
            if(qrDataUrl) {
                pdf.addImage(qrDataUrl, 'PNG', pdfWidth - 70, pageHeight - 70, 50, 50);
                pdf.setFontSize(8);
                pdf.setTextColor(150);
                pdf.text("YouTube: KALVIKADAL", pdfWidth - 110, pageHeight - 10);
            }
        };

        // First page
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        addQRCodetoPage();
        heightLeft -= pageHeight;
        
        // Slicer for subsequent pages
        while (heightLeft > 0) {
            position -= pageHeight; 
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            addQRCodetoPage();
            heightLeft -= pageHeight;
        }

        pdf.save(`${eName.replace(/\s+/g, '_')}_${isKey ? 'Key' : 'Exam'}.pdf`);
    } catch(err) {
        console.error("PDF engine failure:", err);
        displayNotificationToast("PDF Generation Failed.", "error");
    } finally {
        document.body.removeChild(printDiv);
    }
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

// --- GLOBAL EXPORTS API & RICH TEXT CONTROLS ---
window.appEngineAPI = {
    launchAsset: (id, isGroup) => initializeLiveQuizAttemptRunner(id, isGroup),
    
    // ADMIN ONLY PERMANENT DELETE ROUTINE
    deleteAsset: async (id, isGroup) => {
        if(!confirm("Warning: Are you sure you want to permanently delete this asset from the Cloud?")) return;
        
        if (isGroup) {
            enterpriseState.examGroups = enterpriseState.examGroups.filter(g => g.id !== id);
            if(db) try { await deleteDoc(doc(db, "exam_groups", id)); } catch(e){}
        } else {
            enterpriseState.quizzes = enterpriseState.quizzes.filter(q => q.id !== id);
            if(db) try { await deleteDoc(doc(db, "quizzes", id)); } catch(e){}
        }
        
        persistApplicationStateToStorage();
        renderCentralAssetLibrary();
        displayNotificationToast("Asset Deleted Successfully", "success");
    },
    
    stageWorkspace: (id) => { 
        activeWorkspaceQuizReference = JSON.parse(JSON.stringify(enterpriseState.quizzes.find(q=>q.id===id))); 
        switchViewportContext('workspaceSection'); 
    },
    duplicateNode: (i) => { enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions)); activeWorkspaceQuizReference.questions.splice(i,0, JSON.parse(JSON.stringify(activeWorkspaceQuizReference.questions[i]))); renderVisualWorkspaceBoard(); },
    purgeNode: (i) => { enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions)); activeWorkspaceQuizReference.questions.splice(i,1); renderVisualWorkspaceBoard(); },
    reorderNode: (e, to) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain')); if(from===to || isNaN(from)) return; enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions)); const el = activeWorkspaceQuizReference.questions.splice(from,1)[0]; activeWorkspaceQuizReference.questions.splice(to,0,el); renderVisualWorkspaceBoard(); },
    toggleGroupRef: (id) => { activeDraftCompositeIds.includes(id) ? activeDraftCompositeIds.splice(activeDraftCompositeIds.indexOf(id),1) : activeDraftCompositeIds.push(id); renderCompositeTargetZone(); },
    selectAnswer: (opt) => { enterpriseState.userAnswers[enterpriseState.currentQuestionIndex] = opt; renderRunnerActiveQuestionIndex(); },
    toggleCreatorTab: (tab) => {
        document.getElementById('tabManual').classList.toggle('active', tab==='manual');
        document.getElementById('tabExcel').classList.toggle('active', tab==='excel');
        document.getElementById('creatorQuestionForm').classList.toggle('hidden', tab!=='manual');
        document.getElementById('creatorExcelForm').classList.toggle('hidden', tab!=='excel');
    },
    
    // Rich Text Editor Specific Logic
    openEditModal: (i) => {
        currentlyEditingNodeIndex = i;
        const q = activeWorkspaceQuizReference.questions[i];
        document.getElementById('rtEditQuestion').innerHTML = q.text || '';
        document.getElementById('rtEditOptA').innerHTML = q.a || '';
        document.getElementById('rtEditOptB').innerHTML = q.b || '';
        document.getElementById('rtEditOptC').innerHTML = q.c || '';
        document.getElementById('rtEditOptD').innerHTML = q.d || '';
        document.getElementById('rtEditAnswer').value = q.answer || 'A';
        document.getElementById('richTextEditorModal').classList.remove('hidden');
    },
    closeEditModal: () => {
        document.getElementById('richTextEditorModal').classList.add('hidden');
        currentlyEditingNodeIndex = null;
    },
    saveEditModal: () => {
        if(currentlyEditingNodeIndex === null) return;
        enterpriseState.undoStack.push(JSON.stringify(activeWorkspaceQuizReference.questions));
        
        activeWorkspaceQuizReference.questions[currentlyEditingNodeIndex] = {
            text: document.getElementById('rtEditQuestion').innerHTML,
            a: document.getElementById('rtEditOptA').innerHTML,
            b: document.getElementById('rtEditOptB').innerHTML,
            c: document.getElementById('rtEditOptC').innerHTML,
            d: document.getElementById('rtEditOptD').innerHTML,
            answer: document.getElementById('rtEditAnswer').value,
            marks: 5, time: 2
        };
        
        window.appEngineAPI.closeEditModal();
        renderVisualWorkspaceBoard();
        displayNotificationToast("Node Updated Globally.", "success");
    },
    toggleTextCase: () => {
        let selection = window.getSelection();
        if(!selection.isCollapsed) {
            let text = selection.toString();
            let newText = text === text.toUpperCase() ? text.toLowerCase() : text.toUpperCase();
            document.execCommand('insertText', false, newText);
        }
    }
};