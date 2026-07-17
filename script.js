import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- V37 FIREBASE INTEGRATION & AUTH MODEL ---
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

// --- CORE ENTERPRISE STATE (Unified v37 Model + Pro Expansion) ---
const enterpriseState = {
  quizzes: [],
  examGroups: [],
  logs: [],
  users: [], 
  rawCloudData: { quizzes: [], examGroups: [] }, 
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
  currentUser: { uid: 'GUEST', role: 'guest', name: 'Guest User' },
  // Quiz Pro Selection Array Pointer Space
  selectedProQuestions: []
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
    registerQuizProSystemEvents();
    await initializeAuthGates();
    processIncomingUrlSearchParameters();
    triggerLogTrail("[INIT] Enterprise System Core Framework Initialized Successfully v37.4.");
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
    
    if (role === 'admin') {
        document.getElementById('sidebarAdminLink').classList.remove('hidden');
        document.getElementById('sidebarUsersLink').classList.remove('hidden'); 
    }

    displayNotificationToast(`Welcome, ${profile.name}`, "success");
    await loadAndMigrateApplicationState();
}

// --- BULLETPROOF DATA EXTRACTION UTILITY ---
window.extractOption = (q, letter, idx) => {
    if (!q) return "";
    const up = letter.toUpperCase();
    const low = letter.toLowerCase();
    
    if (q[low] !== undefined && q[low] !== null && String(q[low]).trim() !== "") return String(q[low]);
    if (q[up] !== undefined && q[up] !== null && String(q[up]).trim() !== "") return String(q[up]);
    if (q[`option${up}`] !== undefined && q[`option${up}`] !== null) return String(q[`option${up}`]);
    if (q[`Option${up}`] !== undefined && q[`Option${up}`] !== null) return String(q[`Option${up}`]);
    if (q[`opt${up}`] !== undefined && q[`opt${up}`] !== null) return String(q[`opt${up}`]);
    if (q[`opt_${low}`] !== undefined && q[`opt_${low}`] !== null) return String(q[`opt_${low}`]);
    if (q[`option${idx + 1}`] !== undefined && q[`option${idx + 1}`] !== null) return String(q[`option${idx + 1}`]);
    if (q[`Option${idx + 1}`] !== undefined && q[`Option${idx + 1}`] !== null) return String(q[`Option${idx + 1}`]);
    if (Array.isArray(q.options) && q.options[idx] !== undefined) return String(q.options[idx]);
    if (Array.isArray(q.choices) && q.choices[idx] !== undefined) return String(q.choices[idx]);
    if (Array.isArray(q.answers) && q.answers[idx] !== undefined) return String(q.answers[idx]);

    return ""; 
};

// --- V37 SAFE CLOUD-MERGE ENGINE ---
async function loadAndMigrateApplicationState() {
    displayNotificationToast("Synchronizing Cloud Vectors...", "success");
    
    const localCache = JSON.parse(localStorage.getItem('QMP_ENTERPRISE_CACHED_STATE') || '{"quizzes":[],"examGroups":[]}');
    enterpriseState.quizzes = localCache.quizzes || [];
    enterpriseState.examGroups = localCache.examGroups || [];
    
    enterpriseState.rawCloudData = { quizzes: [], examGroups: [] };
    
    try {
        if (db) {
            const [qSnap, gSnap, lSnap] = await Promise.all([
                getDocs(collection(db, "quizzes")),
                getDocs(collection(db, "exam_groups")),
                getDocs(collection(db, "activityLogs"))
            ]);
            
            qSnap.docs.forEach(doc => {
                const data = doc.data();
                enterpriseState.rawCloudData.quizzes.push({ id: doc.id, ...data });
                
                const existingIndex = enterpriseState.quizzes.findIndex(q => q.id === doc.id);
                
                const sanitizedQuestions = (data.questions || []).map(q => ({
                    ...q, 
                    text: q.text || q.question || q.title || "Empty Question Data",
                    a: window.extractOption(q, 'a', 0),
                    b: window.extractOption(q, 'b', 1),
                    c: window.extractOption(q, 'c', 2),
                    d: window.extractOption(q, 'd', 3),
                    answer: q.answer || q.correct || q.correctAnswer || "A",
                    marks: q.marks || 5,
                    time: q.time || 2
                }));

                const quizObj = {
                    id: doc.id,
                    title: data.title || data.metaExam || "Legacy Quiz",
                    description: data.description || "",
                    metaClass: data.metaClass || "",
                    metaSubject: data.metaSubject || "",
                    metaTopic: data.metaTopic || "General",
                    questions: sanitizedQuestions,
                    shuffle: data.shuffle || false,
                    totalMinutes: data.totalMinutes || 0
                };
                if(existingIndex === -1) enterpriseState.quizzes.push(quizObj);
                else enterpriseState.quizzes[existingIndex] = quizObj;
            });
            
            gSnap.docs.forEach(doc => {
                const data = doc.data();
                enterpriseState.rawCloudData.examGroups.push({ id: doc.id, ...data });
                
                const existingIndex = enterpriseState.examGroups.findIndex(g => g.id === doc.id);
                const groupObj = {
                    id: doc.id,
                    name: data.name || data.groupName || "Legacy Group",
                    quizReferences: data.quizReferences || data.quizIds || [],
                    totalMinutes: data.totalMinutes || 0,
                    class: data.class || '',
                    subject: data.subject || '',
                    topics: data.topics || ''
                };
                if(existingIndex === -1) enterpriseState.examGroups.push(groupObj);
                else enterpriseState.examGroups[existingIndex] = groupObj;
            });

            enterpriseState.logs = lSnap.docs.map(d => d.data());
        }
    } catch(e) {
        console.warn("Offline DB Read bypass.", e);
    }
    
    if(enterpriseState.currentUser.role === 'admin') {
        try {
            if(db) {
                const uSnap = await getDocs(collection(db, "registrations"));
                enterpriseState.users = uSnap.docs.map(d => ({id: d.id, ...d.data()}));
            } else {
                enterpriseState.users = JSON.parse(localStorage.getItem('QMP_OFFLINE_USERS') || '[]');
            }
        } catch(e) {
            enterpriseState.users = JSON.parse(localStorage.getItem('QMP_OFFLINE_USERS') || '[]');
        }
        renderUsersTable();
    }

    persistApplicationStateToStorage();
    renderCentralAssetLibrary(); 
    renderRealtimeAnalyticsDashboard();
    populateProQuestionChecklistInventory();
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

    document.getElementById('creatorAppendQuestionBtn').addEventListener('click', handleCreatorQuestionAppend);
    document.getElementById('creatorToWorkspaceBtn').addEventListener('click', transferCreatorToWorkspace);
    
    const excelDropZone = document.getElementById('excelDropZone');
    excelDropZone.addEventListener('dragover', (e) => { e.preventDefault(); excelDropZone.classList.add('dragover'); });
    excelDropZone.addEventListener('dragleave', () => excelDropZone.classList.remove('dragover'));
    excelDropZone.addEventListener('drop', handleExcelDrop);
    document.getElementById('excelFileInput').addEventListener('change', handleExcelSelect);
    document.getElementById('commitExcelImportBtn').addEventListener('click', commitExcelToArray);

    document.getElementById('wsToggleViewBtn').addEventListener('click', () => {
        enterpriseState.workspaceLayout = enterpriseState.workspaceLayout === 'grid' ? 'list' : 'grid';
        renderVisualWorkspaceBoard();
    });
    document.getElementById('wsPublishBtn').addEventListener('click', publishWorkspaceState);
    document.getElementById('wsUndoBtn').addEventListener('click', executeWorkspaceUndoAction);
    document.getElementById('wsRedoBtn').addEventListener('click', executeWorkspaceRedoAction);

    document.getElementById('groupShuffleBtn').addEventListener('click', () => { activeDraftCompositeIds.sort(()=>Math.random()-0.5); renderCompositeTargetZone(); });
    document.getElementById('groupDeduplicateBtn').addEventListener('click', () => { activeDraftCompositeIds = [...new Set(activeDraftCompositeIds)]; renderCompositeTargetZone(); });
    document.getElementById('groupCommitBtn').addEventListener('click', saveCombinedExamGroupToState);
    document.getElementById('groupInventorySearch').addEventListener('input', (e) => renderGroupInventorySelector(e.target.value.trim()));

    document.getElementById('runnerPrevBtn').addEventListener('click', stepBackRunnerQuestion);
    document.getElementById('runnerNextBtn').addEventListener('click', stepForwardRunnerQuestion);
    document.getElementById('runnerQuitBtn').addEventListener('click', () => {
        clearInterval(enterpriseState.timerInterval);
        switchViewportContext('librarySection');
    });
    document.getElementById('runnerFinishBtn').addEventListener('click', finalizeQuizEvaluationSession);
    document.getElementById('reviewCloseBtn').addEventListener('click', () => switchViewportContext('homeSection'));

    document.getElementById('adminResetDataBtn').addEventListener('click', () => { localStorage.removeItem('QMP_ENTERPRISE_CACHED_STATE'); window.location.reload(); });
    document.getElementById('adminForceSyncBtn').addEventListener('click', loadAndMigrateApplicationState);
    
    document.getElementById('adminDownloadDumpBtn').addEventListener('click', generateDatabaseJSONDump);
    document.getElementById('adminDownloadUsersBtn').addEventListener('click', downloadUsersData); 
    
    document.getElementById('pdfGenerateDownloadBtn').addEventListener('click', () => triggerHighFidelityPDFExport(false));
    document.getElementById('pdfGenerateKeyBtn').addEventListener('click', () => triggerHighFidelityPDFExport(true));
    document.getElementById('profileSaveBtn').addEventListener('click', () => {
        enterpriseState.currentUser.name = document.getElementById('profNameInput').value;
        document.getElementById('welcomeUserName').textContent = enterpriseState.currentUser.name;
        displayNotificationToast("Profile updated", "success");
    });

    document.querySelectorAll('.guide-tree-link').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.guide-tree-link').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActiveGuideView(btn.getAttribute('data-guide'));
        });
    });
}

// --- ADMIN USER MANAGEMENT ROUTINES ---
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;
    tbody.innerHTML = enterpriseState.users.map(u => `
        <tr>
            <td>${u.email || u.userId}</td>
            <td><b>${u.name}</b></td>
            <td style="text-transform: capitalize;">${u.role}</td>
            <td>${u.password || '***'}</td>
            <td>
                <button class="btn-node-tool" style="color:var(--primary)" onclick="window.appEngineAPI.editUser('${u.id}')"><i class="ri-edit-2-line"></i></button>
                <button class="btn-node-tool" style="color:var(--danger)" onclick="window.appEngineAPI.deleteUser('${u.id}')"><i class="ri-delete-bin-line"></i></button>
            </td>
        </tr>
    `).join('');
}

function downloadUsersData() {
    const dumpStr = JSON.stringify(enterpriseState.users, null, 2);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(dumpStr);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "qmp_users_database.json");
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    displayNotificationToast("Users database downloaded successfully.", "success");
}

function generateDatabaseJSONDump() {
    if(enterpriseState.currentUser.role !== 'admin') {
        return displayNotificationToast("Admin clearance required.", "error");
    }
    const hasRawData = enterpriseState.rawCloudData && enterpriseState.rawCloudData.quizzes.length > 0;
    const dumpData = hasRawData ? enterpriseState.rawCloudData : { 
        quizzes: enterpriseState.quizzes, 
        examGroups: enterpriseState.examGroups,
        notice: "Notice: You are offline. Showing processed local arrays instead of raw cloud schema."
    };
    const dumpStr = JSON.stringify(dumpData, null, 2);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(dumpStr);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "firestore_raw_schema_dump.json");
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    displayNotificationToast("Raw Database Structure Downloaded successfully.", "success");
}

function switchViewportContext(targetId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.toggle('hidden', sec.id !== targetId));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('data-target') === targetId));
    document.getElementById('breadcrumbCurrent').textContent = targetId.replace('Section', '').toUpperCase();

    if (targetId === 'librarySection') renderCentralAssetLibrary();
    if (targetId === 'workspaceSection') renderVisualWorkspaceBoard();
    if (targetId === 'groupsSection') { renderGroupInventorySelector(''); renderCompositeTargetZone(); }
    if (targetId === 'pdfSection') synchronizePDFSourceAssetSelector();
    if (targetId === 'quizProSection') populateProQuestionChecklistInventory();
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

// --- LIBRARY (WITH SHARE BUTTON INTEGRATION) ---
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
                <div class="asset-action-row" style="flex-wrap:wrap; gap:6px;">
                    <button class="btn-primary" onclick="window.appEngineAPI.launchAsset('${asset.id}', ${isGroup})"><i class="ri-play-fill"></i> Launch</button>
                    ${!isGroup && enterpriseState.currentUser.role !== 'guest' ? `<button class="btn-secondary" onclick="window.appEngineAPI.stageWorkspace('${asset.id}')"><i class="ri-layout-grid-line"></i> Edit Canvas</button>` : ''}
                    <button class="btn-success" onclick="window.appEngineAPI.triggerLibraryAssetShare('${asset.id}', ${isGroup})" title="Instant Response & Certificate Share"><i class="ri-share-forward-fill"></i> Share</button>
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
    populateProQuestionChecklistInventory();
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
    populateProQuestionChecklistInventory();
}

// --- CREATOR TO WORKSPACE BRIDGE ---
function transferCreatorToWorkspace() {
    if(!localCreatorQuestionArray.length) return displayNotificationToast("Provide Questions in the Array first.", "error");

    const title = document.getElementById('creatorQuizTitle').value.trim() || `Draft Matrix ${new Date().toLocaleTimeString()}`;
    const desc = document.getElementById('creatorQuizDescription').value;
    const mClass = document.getElementById('creatorClass').value.trim();
    const mSubject = document.getElementById('creatorSubject').value.trim();
    const mTopic = document.getElementById('creatorTopic').value.trim() || "General";
    
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
        createdAt: new Date().toISOString(),
        totalMinutes: 60
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
    let allocatedMinutes = 0;
    
    if(isGroup) {
        const group = enterpriseState.examGroups.find(g => g.id === id);
        allocatedMinutes = group.totalMinutes || 45;
        group.quizReferences.forEach(ref => {
            const qz = enterpriseState.quizzes.find(q => q.id === ref);
            if(qz && qz.questions) targetQuizzes.push(...qz.questions);
        });
        enterpriseState.activeQuiz = { title: group.name, questions: targetQuizzes };
    } else {
        const qz = enterpriseState.quizzes.find(q => q.id === id);
        allocatedMinutes = qz.totalMinutes || 30;
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
        
        if (allocatedMinutes > 0 && enterpriseState.elapsedSeconds >= (allocatedMinutes * 60)) {
            displayNotificationToast("Exam duration time limit reached. Auto evaluating...", "error");
            finalizeQuizEvaluationSession();
        }
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

    // Automatically trigger alternative response pdf + certificate download flow for the student
    setTimeout(async () => {
        displayNotificationToast("Compiling evaluation verification documents...", "success");
        await window.appEngineAPI.generateQuizProDistributionPayloads({
            studentName: enterpriseState.currentUser.name || "Student Candidate",
            examTitle: enterpriseState.activeQuiz.title,
            score: scorePct,
            totalQuestions: max,
            correctAnswers: correct,
            date: new Date().toLocaleDateString(),
            questions: enterpriseState.activeQuestions,
            userAnswers: enterpriseState.userAnswers
        }, true, true, 'native');
    }, 1500);

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

// --- ANALYTICS & PDF MATRIX ---
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
    let optionsHTML = '<option value="">Select Target Evaluation Node...</option>';
    
    optionsHTML += '<optgroup label="Quizzes (Standalone)">';
    enterpriseState.quizzes.forEach(q => {
        optionsHTML += `<option value="${q.id}" data-type="quiz">${q.title}</option>`;
    });
    optionsHTML += '</optgroup>';
    
    optionsHTML += '<optgroup label="Combined Exam Groups">';
    enterpriseState.examGroups.forEach(g => {
        optionsHTML += `<option value="${g.id}" data-type="group">${g.name}</option>`;
    });
    optionsHTML += '</optgroup>';
    
    sel.innerHTML = optionsHTML;
    
    sel.onchange = (e) => {
        const selectedOpt = e.target.options[e.target.selectedIndex];
        let assetName = '';
        if(selectedOpt.getAttribute('data-type') === 'group') {
            const g = enterpriseState.examGroups.find(x => x.id === e.target.value);
            if(g) {
                assetName = g.name;
                document.getElementById('pdfExamName').value = assetName;
                document.getElementById('pdfClass').value = g.class || '';
                document.getElementById('pdfSubject').value = g.subject || '';
                document.getElementById('pdfTopic').value = g.topics || '';
                document.getElementById('pdfDocumentSimulator').innerHTML = `<div class="sim-header">${assetName}</div><div class="sim-body">Evaluation Sequence Length: Combined Items</div>`;
            }
        } else {
            const q = enterpriseState.quizzes.find(x => x.id === e.target.value);
            if(q) {
                assetName = q.title;
                document.getElementById('pdfExamName').value = assetName;
                document.getElementById('pdfClass').value = q.metaClass || '';
                document.getElementById('pdfSubject').value = q.metaSubject || '';
                document.getElementById('pdfTopic').value = q.metaTopic || '';
                document.getElementById('pdfDocumentSimulator').innerHTML = `<div class="sim-header">${assetName}</div><div class="sim-body">Evaluation Sequence Length: ${q.questions.length} Items</div>`;
            }
        }
    };
}

async function triggerHighFidelityPDFExport(isKey = false) {
    if(!window.jspdf || !window.html2canvas || !window.QRCode) return displayNotificationToast("PDF rendering engines initializing.", "error");
    
    const sel = document.getElementById('pdfSourceAssetSelect');
    const selectedOpt = sel.options[sel.selectedIndex];
    if(!selectedOpt.value) return displayNotificationToast("Select an asset source.", "error");

    let targetQuestions = [];
    if(selectedOpt.getAttribute('data-type') === 'group') {
        const targetAsset = enterpriseState.examGroups.find(g => g.id === selectedOpt.value);
        targetAsset.quizReferences.forEach(ref => {
            const qz = enterpriseState.quizzes.find(q => q.id === ref);
            if(qz && qz.questions) targetQuestions.push(...qz.questions);
        });
    } else {
        const targetAsset = enterpriseState.quizzes.find(q => q.id === selectedOpt.value);
        if(targetAsset && targetAsset.questions) targetQuestions = targetAsset.questions;
    }

    if(targetQuestions.length === 0) return displayNotificationToast("Target asset contains no questions.", "error");

    const eName = document.getElementById('pdfExamName').value || 'Assessment';
    const eClass = document.getElementById('pdfClass').value || '___';
    const eSubject = document.getElementById('pdfSubject').value || '___';
    const eTopic = document.getElementById('pdfTopic').value || '___';
    const tMarks = document.getElementById('pdfMarksInput').value || '___';
    const tTime = document.getElementById('pdfTimeInput').value || '___';

    displayNotificationToast("Compiling Layout Document Geometry...", "success");

    const staging = document.getElementById('proStagingWrapper');
    staging.innerHTML = '';
    
    const printDiv = document.createElement('div');
    printDiv.className = 'pro-pdf-document-canvas';
    
    let htmlContent = `
        <div style="margin-bottom: 12px; font-family: 'Noto Sans', sans-serif;">
            <table class="pro-pdf-meta-header">
                <tr>
                    <td style="text-align: left; width: 50%;">CLASS: ${eClass}</td>
                    <td style="text-align: right; width: 50%; text-transform: uppercase;">${eName} ${isKey ? '(ANSWER KEY)' : ''}</td>
                </tr>
                <tr>
                    <td style="text-align: left; width: 50%;">SUBJECT: ${eSubject}</td>
                    <td style="text-align: right; width: 50%;">NAME: _______________________</td>
                </tr>
                <tr>
                    <td style="text-align: left; width: 50%;">TOPIC: ${eTopic}</td>
                    <td style="text-align: right; width: 50%;">MARKS: ${tMarks} | TIME: ${tTime} Mins</td>
                </tr>
            </table>
            <div class="pro-pdf-divider-line"></div>
        </div>
    `;

    targetQuestions.forEach((q, i) => {
        if(isKey) {
            let ansLetter = q.answer ? q.answer.toUpperCase() : 'A';
            let ansText = window.extractOption(q, ansLetter, 0) || '______';
            htmlContent += `<div class="pro-pdf-question-block"><b>${i+1}. ${ansLetter}</b> - ${ansText}</div>`;
        } else {
            htmlContent += `
                <div class="pro-pdf-question-block">
                    <strong>${i+1}.</strong> ${q.text}
                    <table class="pro-pdf-options-table">
                        <tr>
                            <td><b>A.</b> ${window.extractOption(q, 'a', 0) || '___'}</td>
                            <td><b>B.</b> ${window.extractOption(q, 'b', 1) || '___'}</td>
                        </tr>
                        <tr>
                            <td><b>C.</b> ${window.extractOption(q, 'c', 2) || '___'}</td>
                            <td><b>D.</b> ${window.extractOption(q, 'd', 3) || '___'}</td>
                        </tr>
                    </table>
                </div>`;
        }
    });

    printDiv.innerHTML = htmlContent;
    staging.appendChild(printDiv);

    try {
        const canvas = await html2canvas(printDiv, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        // Dynamic Kalvi Kadal QR Stamp embedder routing context
        const qrEl = document.createElement('div');
        new QRCode(qrEl, { text: "https://www.youtube.com/@KALVIKADAL", width: 80, height: 80 });
        await new Promise(r => setTimeout(r, 200));
        const qrCanvas = qrEl.querySelector('canvas');
        const qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/jpeg') : null;

        const stampQR = () => {
            if (qrDataUrl) {
                pdf.addImage(qrDataUrl, 'JPEG', pdfWidth - 75, pdfHeight - 75, 55, 55);
                pdf.setFontSize(8);
                pdf.text("YouTube: KALVIKADAL", pdfWidth - 150, pdfHeight - 30);
            }
        };

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        stampQR();
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position -= pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            stampQR();
            heightLeft -= pdfHeight;
        }

        pdf.save(`${eName.replace(/\s+/g, '_')}.pdf`);
        displayNotificationToast("Document compiled successfully.", "success");
    } catch(err) {
        console.error(err);
        displayNotificationToast("Compilation failure.", "error");
    } finally {
        staging.innerHTML = '';
    }
}

// --- NEW: QUIZ PRO CORE BUSINESS ENGINE ROUTINES ---
function registerQuizProSystemEvents() {
    document.getElementById('proInventoryFilter').addEventListener('input', (e) => {
        populateProQuestionChecklistInventory(e.target.value.trim());
    });
    document.getElementById('btnProSaveExam').addEventListener('click', executeProExamCompilationSave);
    document.getElementById('btnProGenerateLink').addEventListener('click', generateQuizProPlayLinkToken);
    document.getElementById('btnProCopyLink').addEventListener('click', () => {
        const input = document.getElementById('proGeneratedLinkInput');
        input.select();
        document.execCommand('copy');
        displayNotificationToast("Distribution URL Link Copied to clipboard.", "success");
    });
    document.getElementById('btnProTriggerDistributionShare').addEventListener('click', triggerProAlternativeDistributionInterface);
}

function processIncomingUrlSearchParameters() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('proMode') && params.has('token')) {
        try {
            const rawDecoded = LZString.decompressFromEncodedURIComponent(params.get('token'));
            if (rawDecoded) {
                const configObject = JSON.parse(rawDecoded);
                enterpriseState.activeQuestions = configObject.questions;
                enterpriseState.activeQuiz = { title: configObject.title };
                enterpriseState.userAnswers = {};
                enterpriseState.currentQuestionIndex = 0;
                enterpriseState.elapsedSeconds = 0;
                
                setTimeout(() => {
                    switchViewportContext('quizSection');
                    document.getElementById('runnerQuizTitle').textContent = configObject.title;
                    
                    let timeLimit = parseInt(configObject.timer) || 30;
                    clearInterval(enterpriseState.timerInterval);
                    enterpriseState.timerInterval = setInterval(() => {
                        enterpriseState.elapsedSeconds++;
                        const pad = v => String(v).padStart(2,'0');
                        document.getElementById('runnerTimer').textContent = `${pad(Math.floor(enterpriseState.elapsedSeconds/60))}:${pad(enterpriseState.elapsedSeconds%60)}`;
                        if (enterpriseState.elapsedSeconds >= (timeLimit * 60)) {
                            finalizeQuizEvaluationSession();
                        }
                    }, 1000);
                    renderRunnerActiveQuestionIndex();
                }, 1000);
            }
        } catch(e) {
            console.error("Token translation error.", e);
        }
    }
}

function populateProQuestionChecklistInventory(filterText = '') {
    const wrapper = document.getElementById('proChecklistWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    // Extract all individual questions and group them dynamically by context topic structural layers
    const categorizedTopics = {};
    enterpriseState.quizzes.forEach(quiz => {
        const topic = quiz.metaTopic || "General Topic Pool";
        if (!categorizedTopics[topic]) categorizedTopics[topic] = [];
        
        (quiz.questions || []).forEach(q => {
            // Apply quick parameter token text search mapping criteria
            if (filterText) {
                const searchStr = `${q.text} ${topic} ${q.a} ${q.b}`.toLowerCase();
                if (!searchStr.includes(filterText.toLowerCase())) return;
            }
            // Avoid duplicate text nodes inside the compilation panel
            if (!categorizedTopics[topic].some(existing => existing.text === q.text)) {
                categorizedTopics[topic].push(q);
            }
        });
    });

    let keys = Object.keys(categorizedTopics);
    if (keys.length === 0 || (keys.length === 1 && categorizedTopics[keys[0]].length === 0)) {
        wrapper.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-light);">No matching topic modules or active questions detected.</div>`;
        return;
    }

    keys.forEach(topicName => {
        const questionsList = categorizedTopics[topicName];
        if (questionsList.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'pro-topic-group-container';
        
        groupDiv.innerHTML = `
            <div class="pro-topic-group-header">
                <span>${topicName}</span>
                <span style="font-size:0.75rem; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px;">Count: ${questionsList.length}</span>
            </div>
        `;

        questionsList.forEach((q, idx) => {
            const isChecked = enterpriseState.selectedProQuestions.some(x => x.text === q.text);
            const node = document.createElement('div');
            node.className = 'pro-question-item-node';
            
            const uniqueId = `pro_chk_${encodeURIComponent(topicName)}_${idx}`;
            
            node.innerHTML = `
                <input type="checkbox" class="pro-question-checkbox-input" id="${uniqueId}" ${isChecked ? 'checked' : ''} />
                <div class="pro-node-text-layout">
                    <label for="${uniqueId}" style="cursor:pointer; display:block; font-family:'Noto Sans', sans-serif;">${q.text}</label>
                    <div class="pro-node-options-row">
                        <div><b>A:</b> ${q.a}</div>
                        <div><b>B:</b> ${q.b}</div>
                        ${q.c ? `<div><b>C:</b> ${q.c}</div>` : ''}
                        ${q.d ? `<div><b>D:</b> ${q.d}</div>` : ''}
                    </div>
                </div>
            `;

            node.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    if(!enterpriseState.selectedProQuestions.some(x => x.text === q.text)) {
                        enterpriseState.selectedProQuestions.push(q);
                    }
                } else {
                    enterpriseState.selectedProQuestions = enterpriseState.selectedProQuestions.filter(x => x.text !== q.text);
                }
                document.getElementById('proSelectedCounterText').textContent = enterpriseState.selectedProQuestions.length;
            });

            groupDiv.appendChild(node);
        });

        wrapper.appendChild(groupDiv);
    });

    document.getElementById('proSelectedCounterText').textContent = enterpriseState.selectedProQuestions.length;
}

async function executeProExamCompilationSave() {
    const title = document.getElementById('proExamTitle').value.trim();
    const timer = document.getElementById('proExamTimer').value || 30;
    const eClass = document.getElementById('proExamClass').value.trim() || 'General';
    const eSubj = document.getElementById('proExamSubject').value.trim() || 'General';

    if (!title) return displayNotificationToast("Please declare a Custom Exam Title parameter.", "error");
    if (enterpriseState.selectedProQuestions.length === 0) return displayNotificationToast("Select at least one question from the matrix inventory checklist.", "error");

    const newQuizBlock = {
        id: "quiz_pro_" + Date.now(),
        title: title,
        description: `Quiz Pro Custom Compiled Composite Layer Block Strategy.`,
        metaClass: eClass,
        metaSubject: eSubj,
        metaTopic: "Pro Composite",
        questions: [...enterpriseState.selectedProQuestions],
        shuffle: false,
        totalMinutes: parseInt(timer),
        createdAt: new Date().toISOString()
    };

    enterpriseState.quizzes.push(newQuizBlock);
    persistApplicationStateToStorage();

    if(db) {
        try { await setDoc(doc(db, "quizzes", newQuizBlock.id), newQuizBlock); } catch(e){}
    }

    displayNotificationToast("Quiz Pro Customized composite matrix block committed inside Cloud Store.", "success");
    switchViewportContext('librarySection');
}

function generateQuizProPlayLinkToken() {
    const title = document.getElementById('proExamTitle').value.trim() || "Quiz Pro Shared Test Block";
    const timer = document.getElementById('proExamTimer').value || 30;

    if (enterpriseState.selectedProQuestions.length === 0) {
        return displayNotificationToast("Select target items to formulate transmission token link maps.", "error");
    }

    const simpleConfig = {
        title: title,
        timer: timer,
        questions: enterpriseState.selectedProQuestions
    };

    const compressedToken = LZString.compressToEncodedURIComponent(JSON.stringify(simpleConfig));
    const activeLocationHref = window.location.origin + window.location.pathname;
    const fullPlayUrl = `${activeLocationHref}?proMode=true&token=${compressedToken}`;

    const shareBox = document.getElementById('proLinkShareContainer');
    shareBox.classList.remove('hidden');
    document.getElementById('proGeneratedLinkInput').value = fullPlayUrl;
    displayNotificationToast("Live Play link matrix token generated successfully.", "success");
}

async function triggerProAlternativeDistributionInterface() {
    const channel = document.getElementById('proShareChannelSelect').value;
    const incResponses = document.getElementById('chkProIncludeResponses').checked;
    const incCert = document.getElementById('chkProIncludeCertificate').checked;

    if (!incResponses && !incCert) return displayNotificationToast("Enable at least one document distribution checkbox flag.", "error");

    const mockDataPacket = {
        studentName: enterpriseState.currentUser.name || "Candidate Scholar",
        examTitle: document.getElementById('proExamTitle').value.trim() || "Pro Evaluation Matrix Asset Run",
        score: 95, 
        totalQuestions: enterpriseState.selectedProQuestions.length || 10,
        correctAnswers: enterpriseState.selectedProQuestions.length ? Math.floor(enterpriseState.selectedProQuestions.length * 0.95) : 9,
        date: new Date().toLocaleDateString(),
        questions: enterpriseState.selectedProQuestions.length ? enterpriseState.selectedProQuestions : (enterpriseState.quizzes[0]?.questions || []),
        userAnswers: { 0: 'A', 1: 'B', 2: 'A' }
    };

    await window.appEngineAPI.generateQuizProDistributionPayloads(mockDataPacket, incResponses, incCert, channel);
}

// --- GLOBAL EXPORTS API & ACTIONS PANEL ROUTER LAYER ---
window.appEngineAPI = {
    launchAsset: (id, isGroup) => initializeLiveQuizAttemptRunner(id, isGroup),
    
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
        populateProQuestionChecklistInventory();
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
    
    // Rich Text Editor
    openEditModal: (i) => {
        currentlyEditingNodeIndex = i;
        const q = activeWorkspaceQuizReference.questions[i];
        document.getElementById('rtEditQuestion').innerHTML = q.text || '';
        document.getElementById('rtEditOptA').innerHTML = window.extractOption(q, 'a', 0) || '';
        document.getElementById('rtEditOptB').innerHTML = window.extractOption(q, 'b', 1) || '';
        document.getElementById('rtEditOptC').innerHTML = window.extractOption(q, 'c', 2) || '';
        document.getElementById('rtEditOptD').innerHTML = window.extractOption(q, 'd', 3) || '';
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
    },
    
    // ADMIN USER METHODS
    editUser: (id) => {
        const u = enterpriseState.users.find(x => x.id === id);
        if(!u) return;
        document.getElementById('editUserId').value = u.id;
        document.getElementById('editUserName').value = u.name || '';
        document.getElementById('editUserEmail').value = u.email || u.userId || '';
        document.getElementById('editUserRole').value = u.role || 'student';
        document.getElementById('editUserPassword').value = u.password || '';
        document.getElementById('editUserModal').classList.remove('hidden');
    },
    closeUserModal: () => document.getElementById('editUserModal').classList.add('hidden'),
    saveUserModal: async () => {
        const id = document.getElementById('editUserId').value;
        const uIdx = enterpriseState.users.findIndex(x => x.id === id);
        if(uIdx === -1) return;
        
        enterpriseState.users[uIdx].name = document.getElementById('editUserName').value;
        enterpriseState.users[uIdx].email = document.getElementById('editUserEmail').value;
        enterpriseState.users[uIdx].role = document.getElementById('editUserRole').value;
        enterpriseState.users[uIdx].password = document.getElementById('editUserPassword').value;
        
        if(db) {
            try { await setDoc(doc(db, "registrations", id), enterpriseState.users[uIdx]); } catch(e){}
        } else {
            localStorage.setItem('QMP_OFFLINE_USERS', JSON.stringify(enterpriseState.users));
        }
        
        window.appEngineAPI.closeUserModal();
        renderUsersTable();
        displayNotificationToast("User updated successfully.", "success");
    },
    deleteUser: async (id) => {
        if(!confirm("Are you sure you want to permanently delete this user?")) return;
        
        enterpriseState.users = enterpriseState.users.filter(x => x.id !== id);
        if(db) {
            try { await deleteDoc(doc(db, "registrations", id)); } catch(e){}
        } else {
            localStorage.setItem('QMP_OFFLINE_USERS', JSON.stringify(enterpriseState.users));
        }
        renderUsersTable();
        displayNotificationToast("User deleted.", "success");
    },

    // LIBRARY QUICK SHARE BUTTON IMPLEMENTATION BRIDGE
    triggerLibraryAssetShare: async (id, isGroup) => {
        let targetQuestions = [];
        let title = '';
        if (isGroup) {
            const match = enterpriseState.examGroups.find(x => x.id === id);
            title = match?.name || "Group Exam Collection";
            (match?.quizReferences || []).forEach(ref => {
                const qz = enterpriseState.quizzes.find(x => x.id === ref);
                if(qz) targetQuestions.push(...(qz.questions || []));
            });
        } else {
            const match = enterpriseState.quizzes.find(x => x.id === id);
            title = match?.title || "Quiz Block";
            targetQuestions = match?.questions || [];
        }

        if(targetQuestions.length === 0) return displayNotificationToast("No available questions inside asset container.", "error");

        const simulationPayload = {
            studentName: "Verified Scholar Candidate",
            examTitle: title,
            score: 100,
            totalQuestions: targetQuestions.length,
            correctAnswers: targetQuestions.length,
            date: new Date().toLocaleDateString(),
            questions: targetQuestions,
            userAnswers: {}
        };

        displayNotificationToast("Compiling Library assets files...", "success");
        await window.appEngineAPI.generateQuizProDistributionPayloads(simulationPayload, true, true, 'native');
    },

    // HIGH FIDELITY PAYLOAD DISTRIBUTOR ENGINE (PDF RESPONSE SHIELDS & DECORATIVE ARCHITECTURE CERTIFICATES)
    generateQuizProDistributionPayloads: async (data, includeResponse, includeCert, transportChannel) => {
        if (!window.jspdf || !window.html2canvas || !window.QRCode) {
            return displayNotificationToast("Rendering extensions missing from framework.", "error");
        }

        const staging = document.getElementById('proStagingWrapper');
        staging.innerHTML = '';
        
        const padText = v => String(v).padStart(2,'0');
        const generatedFilesMap = [];

        // Dynamic QR code base generation targeting Kalvi Kadal YouTube channel destination maps
        const qrNode = document.createElement('div');
        new QRCode(qrNode, { text: "https://www.youtube.com/@KALVIKADAL", width: 90, height: 90 });
        await new Promise(res => setTimeout(res, 250));
        const qrCanvas = qrNode.querySelector('canvas');
        const qrDataBaseUrl = qrCanvas ? qrCanvas.toDataURL('image/jpeg') : null;

        // 1. Structuralize Student Response Form Data Sheet
        if (includeResponse) {
            const responseCanvasNode = document.createElement('div');
            responseCanvasNode.className = 'pro-pdf-document-canvas';
            
            let html = `
                <div style="font-family:'Noto Sans', sans-serif;">
                    <h2 style="color:#0d9488; text-align:center; font-size:18px; margin-bottom:4px;">KALVI KADAL EVALUATION METRICS SHIELD</h2>
                    <p style="text-align:center; font-size:10px; color:#475569; margin-bottom:15px;">Automated Response System Verification Sheet Pointer</p>
                    <table class="pro-pdf-meta-header">
                        <tr><td>CANDIDATE: ${data.studentName}</td><td style="text-align:right;">EVALUATION BLOCK: ${data.examTitle}</td></tr>
                        <tr><td>DATE INDEX: ${data.date}</td><td style="text-align:right;">SCORE PERCENTAGE: ${data.score}% (${data.correctAnswers}/${data.totalQuestions})</td></tr>
                    </table>
                    <div class="pro-pdf-divider-line"></div>
                </div>
            `;

            data.questions.forEach((q, idx) => {
                const candidateChoice = data.userAnswers[idx] || 'SKIPPED';
                const correctChoice = (q.answer || 'A').toUpperCase();
                html += `
                    <div class="pro-pdf-question-block" style="font-family:'Noto Sans', sans-serif;">
                        <b>Q${idx+1}: ${q.text}</b><br/>
                        <span style="font-size:11px; margin-left:15px; display:inline-block; color:${candidateChoice === correctChoice ? '#10b981' : '#ef4444'}">
                            Candidate Choice Parameter: [${candidateChoice}] &bull; Verified Evaluation Key Target: [${correctChoice}]
                        </span>
                    </div>`;
            });

            responseCanvasNode.innerHTML = html;
            staging.appendChild(responseCanvasNode);

            const resCanvas = await html2canvas(responseCanvasNode, { scale: 2, useCORS: true });
            const { jsPDF } = window.jspdf;
            const resPdf = new jsPDF('p', 'pt', 'a4');
            const w = resPdf.internal.pageSize.getWidth();
            const h = resPdf.internal.pageSize.getHeight();
            const calculatedHeight = (resCanvas.height * w) / resCanvas.width;
            
            resPdf.addImage(resCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, w, calculatedHeight);
            
            if (qrDataBaseUrl) {
                resPdf.addImage(qrDataBaseUrl, 'JPEG', w - 75, h - 75, 55, 55);
                resPdf.setFontSize(8);
                resPdf.text("KALVIKADAL QR SHIELD", w - 145, h - 30);
            }

            generatedFilesMap.push({ name: `${data.studentName.replace(/\s+/g,'_')}_Response.pdf`, blob: resPdf.output('blob') });
            staging.innerHTML = '';
        }

        // 2. Structuralize High-Fidelity Custom Decorative Achievement Certificate (Matching Model Architecture)
        if (includeCert) {
            const certCanvasNode = document.createElement('div');
            certCanvasNode.className = 'pro-cert-stage-wrapper';
            
            certCanvasNode.innerHTML = `
                <div class="pro-cert-inner-border">
                    <div class="pro-cert-corner-ornament pro-cert-top-left"></div>
                    <div class="pro-cert-corner-ornament pro-cert-top-right"></div>
                    <div class="pro-cert-corner-ornament pro-cert-bottom-left"></div>
                    <div class="pro-cert-corner-ornament pro-cert-bottom-right"></div>
                    
                    <div style="text-align:center; margin-top:10px; font-family:'Inter', sans-serif;">
                        <h1 class="pro-cert-header-title">KALVI KADAL</h1>
                        <div class="pro-cert-subtitle">Quiz Master Pro Evaluation Systems</div>
                    </div>

                    <div class="pro-cert-main-declaration">Certificate of Achievement</div>
                    
                    <div class="pro-cert-recipient-name" style="font-family:'Noto Sans', sans-serif;">${data.studentName}</div>
                    
                    <div class="pro-cert-text-body" style="font-family:'Noto Sans', sans-serif;">
                        This document serves to record that the aforementioned candidate has successfully completed and demonstrated outstanding performance excellence inside the evaluation course vector designated as <strong>${data.examTitle}</strong>.
                    </div>

                    <div class="pro-cert-metrics-row">
                        <div class="pro-cert-metric-pill">Final Score Vector: ${data.score}%</div>
                        <div class="pro-cert-metric-pill">Completion Timestamp: ${data.date}</div>
                        <div class="pro-cert-metric-pill">Status: DISTINCTION CLEARANCE</div>
                    </div>

                    <div class="pro-cert-footer-signatures">
                        <div class="pro-cert-sig-block">
                            <div class="pro-cert-sig-line"></div>
                            <div class="pro-cert-sig-title">Quiz Coordinator</div>
                        </div>
                        
                        <div class="pro-cert-qr-footprint" id="certInternalQrSlot"></div>

                        <div class="pro-cert-sig-block">
                            <div class="pro-cert-sig-line"></div>
                            <div class="pro-cert-sig-title">Headmaster / Principal</div>
                        </div>
                    </div>
                </div>
            `;

            if (qrDataBaseUrl) {
                const img = document.createElement('img');
                img.src = qrDataBaseUrl;
                img.style.width = '80px';
                img.style.height = '80px';
                certCanvasNode.querySelector('#certInternalQrSlot').appendChild(img);
            }

            staging.appendChild(certCanvasNode);

            const certCanvas = await html2canvas(certCanvasNode, { scale: 2, useCORS: true });
            const { jsPDF } = window.jspdf;
            const certPdf = new jsPDF('l', 'pt', [1100, 770]);
            
            certPdf.addImage(certCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 1100, 770);
            
            generatedFilesMap.push({ name: `${data.studentName.replace(/\s+/g,'_')}_Certificate.pdf`, blob: certPdf.output('blob') });
            staging.innerHTML = '';
        }

        // 3. Social Media Share Transport Channels Router Matrix Execution
        if (generatedFilesMap.length === 0) return;

        displayNotificationToast(`Distributing files via ${transportChannel.toUpperCase()} Matrix Layer...`, "success");

        generatedFilesMap.forEach(fileObj => {
            if (transportChannel === 'native' && navigator.canShare) {
                const file = new File([fileObj.blob], fileObj.name, { type: "application/pdf" });
                navigator.share({ files: [file], title: fileObj.name, text: `Quiz Master Pro Distribution Payload for student evaluation runs.` })
                    .catch(e => {
                        // Alternative direct client local device background download fallback
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(fileObj.blob);
                        link.download = fileObj.name;
                        link.click();
                    });
            } else if (transportChannel === 'whatsapp') {
                const message = encodeURIComponent(`*QUIZ MASTER PRO ENTERPRISE COMPONENT NOTIFICATION*\nCandidate: ${data.studentName}\nExam Block: ${data.examTitle}\nPerformance Score Vector: ${data.score}%\nPayload files compiled. Please cross check localized local downloads.`);
                window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(fileObj.blob);
                link.download = fileObj.name;
                link.click();
            } else if (transportChannel === 'gmail') {
                const subject = encodeURIComponent(`Quiz Master Pro Enterprise Verification Sheet: ${data.studentName}`);
                const body = encodeURIComponent(`Dear Administrator / Teacher,\n\nThe system has generated high fidelity document packages mapping to candidate evaluation results parameters.\n\nScore: ${data.score}%\nDate: ${data.date}\n\nPayload files generated for manual attachment storage options.`);
                window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(fileObj.blob);
                link.download = fileObj.name;
                link.click();
            } else {
                // Background download strategy fallback pointer space
                const link = document.createElement('a');
                link.href = URL.createObjectURL(fileObj.blob);
                link.download = fileObj.name;
                link.click();
            }
        });
        displayNotificationToast("Document packages pushed out safely.", "success");
    }
};