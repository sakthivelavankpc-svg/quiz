// 1. IMPORT FIREBASE INTEGRITY LAYER MODULES
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. CRYPTOGRAPHIC CREDENTIAL METRICS CONTEXT
const firebaseConfig = {
    apiKey: "AIzaSyAnxIsftWdUxtHEh7nxX1UPRA29c0n1444",
    authDomain: "quiz-master-3e489.firebaseapp.com",
    projectId: "quiz-master-3e489",
    storageBucket: "quiz-master-3e489.firebasestorage.app",
    messagingSenderId: "741393992507",
    appId: "1:741393992507:web:b28cd8fcda2b74f85b851e"
};

// 3. STORAGE LAYOUT RUNTIME INSTANTIATION
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. ARCHITECTURAL UTILITY HANDLERS
const $ = (id) => document.getElementById(id);

function showToast(msg, type = 'info') {
    const container = $('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'success' ? 'var(--success)' : '#1e293b');
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 24px';
    toast.style.margin = '5px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = 'var(--shadow)';
    toast.style.transition = 'opacity 0.3s';
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function shuffleArray(array) {
    if (!Array.isArray(array)) return [];
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// 5. MEMORY BUFFER MATRIX STORAGE CAPACITIES
let globalQuizzes = [];
let globalGroups = [];
let globalUsers = [];
let globalLogs = [];
let recycleBin = [];

let currentQuizData = null;
let currentQuestions = [];
let studentAnswers = {};
let currentQIndex = 0;
let mainTimerInterval = null;
let perQTimerInterval = null;
let mainSecondsLeft = 0;
let perQSecondsLeft = 0;

let adminAuthenticated = false;
let selectedQuizIdsForGroup = new Set();

let studentProfile = null;
let activeWorkspaceQuestions = [];
let intermediaryParsedCsvArray = [];

// SANITIZATION AND STRUCTURAL ENGINE
const EnterpriseSanitizer = {
    clean(html) {
        if (!html) return "";
        let sandbox = document.createElement('div');
        sandbox.innerHTML = html;
        const bad = sandbox.querySelectorAll('script, iframe, object, embed, meta, link');
        bad.forEach(el => el.remove());
        return sandbox.innerHTML;
    },
    stripTags(html) {
        if (!html) return "";
        let t = document.createElement('div');
        t.innerHTML = html;
        return t.textContent || t.innerText || "";
    }
};

// INITIALIZATION SEQUENCE ROUTINE LOOP
window.addEventListener('load', async () => {
    initTheme();
    checkSessions(); // Restores Admin/Student sessions securely
    attachGlobalEventHandlers();
    EnterpriseWorkspaceEditor.init();
    await fetchUnifiedDatabases();
    checkUrlParamsDeployment();
    initFloatingLeaderboard();
});

function initTheme() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
}

async function checkSessions() {
    // Admin Session
    if (localStorage.getItem('adminSession') === 'active') {
        adminAuthenticated = true;
        $('globalLogoutBtn').classList.remove('hidden');
        $('adminDashboardPanel').classList.remove('hidden');
    }
    // Student Session
    const activeCache = await localforage.getItem('userProfile');
    if (activeCache) {
        studentProfile = activeCache;
        $('globalLogoutBtn').classList.remove('hidden');
    }
}

// SECURE CLOUD INDEX RESYNC
async function fetchUnifiedDatabases() {
    try {
        const quizSnap = await getDocs(collection(db, "quizzes"));
        globalQuizzes = [];
        quizSnap.forEach(d => globalQuizzes.push({ id: d.id, ...d.data() }));

        const groupSnap = await getDocs(collection(db, "exam_groups"));
        globalGroups = [];
        groupSnap.forEach(d => globalGroups.push({ id: d.id, ...d.data() }));

        const userSnap = await getDocs(collection(db, "registrations"));
        globalUsers = [];
        userSnap.forEach(d => globalUsers.push({ id: d.id, ...d.data() }));

        const logSnap = await getDocs(collection(db, "activityLogs"));
        globalLogs = [];
        logSnap.forEach(d => globalLogs.push({ id: d.id, ...d.data() }));

        $('libCount').textContent = `${globalQuizzes.length + globalGroups.length} Active System Deployments Available`;
        
        populateSearchFilterDropdowns();
        renderUnifiedGlobalLibrary();
        if (adminAuthenticated) renderAdminDashboardConsole();

    } catch (e) {
        console.error(e);
        showToast("Cloud structural communication fault initialization sync failed.", "error");
    }
}

// FILL DROPDOWNS BASED ON DATA AGGREGATION LOOKUPS
function populateSearchFilterDropdowns() {
    let subjects = new Set(), districts = new Set(), cities = new Set(), classes = new Set();
    globalQuizzes.forEach(q => {
        if (q.metaSubject) subjects.add(q.metaSubject);
        if (q.metaDistrict) districts.add(q.metaDistrict);
        if (q.metaCity) cities.add(q.metaCity);
        if (q.metaClass) classes.add(q.metaClass);
    });
    
    fillSelector('advFilterSubject', subjects);
    fillSelector('advFilterDistrict', districts);
    fillSelector('advFilterCity', cities);
    fillSelector('advFilterClass', classes);

    fillSelector('lblFilterExam', new Set(globalQuizzes.map(q => q.metaExam)));
    fillSelector('lblFilterTopic', new Set(globalQuizzes.map(q => q.metaTopic)));
    fillSelector('lblFilterSchool', new Set(globalUsers.map(u => u.school)));
    fillSelector('lblFilterDistrict', new Set(globalUsers.map(u => u.district)));
}

function fillSelector(id, dataSet) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = `<option value="all">All (${el.options[0]?.text.replace('All ', '') || 'Select'})</option>`;
    Array.from(dataSet).filter(Boolean).forEach(item => {
        el.innerHTML += `<option value="${item}">${item}</option>`;
    });
}

// BIND CORE SYSTEM DEPLOYMENT TRIGGERS
function attachGlobalEventHandlers() {
    $('themeToggleBtn')?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    $('toggleAdminBtn')?.addEventListener('click', () => {
        if(adminAuthenticated) {
            $('adminDashboardPanel').classList.remove('hidden');
            renderAdminDashboardConsole();
        } else {
            $('adminAuthModal').classList.remove('hidden');
        }
    });
    $('cancelAdminLoginBtn')?.addEventListener('click', () => $('adminAuthModal').classList.add('hidden'));
    $('submitAdminLoginBtn')?.addEventListener('click', handleAdminAuthenticationWorkflow);
    $('closeAdminDashboardBtn')?.addEventListener('click', () => $('adminDashboardPanel').classList.add('hidden'));

    $('globalLogoutBtn')?.addEventListener('click', async () => {
        adminAuthenticated = false;
        studentProfile = null;
        localStorage.removeItem('adminSession');
        await localforage.removeItem('userProfile');
        window.location.reload();
    });

    $('toggleCreatorBtn')?.addEventListener('click', () => $('creatorPanel').classList.toggle('hidden'));
    $('closeCreatorBtn')?.addEventListener('click', () => $('creatorPanel').classList.add('hidden'));

    $('toggleYoutubeSidebarBtn')?.addEventListener('click', () => $('youtubeSidebar').classList.toggle('hidden'));
    $('closeYoutubeSidebarBtn')?.addEventListener('click', () => $('youtubeSidebar').classList.add('hidden'));

    // Enterprise Fuzzy Search Matrix Bindings
    $('globalSearchInput')?.addEventListener('input', debounceSearch(handleFuzzyAutocompleteSearch, 300));
    ['advFilterSubject', 'advFilterDistrict', 'advFilterCity', 'advFilterClass'].forEach(id => {
        $(id)?.addEventListener('change', renderUnifiedGlobalLibrary);
    });

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(e.target.id === 'openFloatingLeaderboardBtn') {
                $('floatingLeaderboardPanel').classList.remove('hidden');
                return;
            }
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
            e.target.classList.add('active');
            $(e.target.dataset.target).classList.remove('hidden');
        });
    });

    $('submitRegistrationBtn')?.addEventListener('click', executeEnterpriseAccountRegistration);
    $('toggleLoginViewBtn')?.addEventListener('click', () => { $('globalRegistrationModal').classList.add('hidden'); $('studentLoginModal').classList.remove('hidden'); });
    $('toggleRegViewBtn')?.addEventListener('click', () => { $('studentLoginModal').classList.add('hidden'); $('globalRegistrationModal').classList.remove('hidden'); });
    $('startStudentQuizBtn')?.addEventListener('click', executeManualAccountAuthentication);

    $('createManualBtn')?.addEventListener('click', () => { $('manualSection').classList.remove('hidden'); addManualRow(); });
    $('addRowBtn')?.addEventListener('click', addManualRow);
    $('loadManualToWorkspaceBtn')?.addEventListener('click', () => EnterpriseWorkspaceEditor.loadQuestionsIntoWorkspace(extractManualRowsData()));
    $('loadCSVBtn')?.addEventListener('click', () => $('csvFileInput').click());
    $('csvFileInput')?.addEventListener('change', parseInputCSVDataStream);
    $('loadCsvToWorkspaceBtn')?.addEventListener('click', () => EnterpriseWorkspaceEditor.loadQuestionsIntoWorkspace(intermediaryParsedCsvArray));
    $('v18-excel-upload')?.addEventListener('change', parseAdvancedExcelSheetDataStream);
    $('saveToLibraryBtn')?.addEventListener('click', () => EnterpriseWorkspaceEditor.loadQuestionsIntoWorkspace(extractManualRowsData()));
    
    $('prevBtn')?.addEventListener('click', () => navigateActiveQuizPosition(-1));
    $('nextBtn')?.addEventListener('click', () => navigateActiveQuizPosition(1));
    $('finishBtn')?.addEventListener('click', completeQuizExecutionStateSequence);

    $('workspaceTestBtn')?.addEventListener('click', runSandboxAssessmentLiveTestingEnvironment);
    $('workspacePublishBtn')?.addEventListener('click', commitFinalWorkspacePayloadToCloud);
    $('v20-create-group-btn')?.addEventListener('click', evaluateAndCompileSelectedExamGroup);

    $('printPdfBtn')?.addEventListener('click', generateResultPDF);
    $('downloadAnswerKeyBtn')?.addEventListener('click', () => generateEnterpriseExportPDF('answer_key'));
    $('homeBtn_review')?.addEventListener('click', () => window.location.href = window.location.pathname);
    $('submitWhatsAppBtn')?.addEventListener('click', fireWhatsAppOutboundReportingPayload);
    $('submitEmailBtn')?.addEventListener('click', fireEmailOutboundReportingPayload);
    $('closeShareBtn')?.addEventListener('click', () => $('shareModal').classList.add('hidden'));
    $('copyLinkBtn')?.addEventListener('click', () => { $('shareLinkInput').select(); document.execCommand('copy'); showToast("Link copied to clipboard buffer mapping.", "success"); });

    ['lblFilterExam', 'lblFilterTopic', 'lblFilterSchool', 'lblFilterDistrict', 'lblFilterMetric'].forEach(id => {
        $(id)?.addEventListener('change', renderAdminLeaderboardViewGrid);
    });

    $('exportLbPdf')?.addEventListener('click', () => generateEnterpriseExportPDF('leaderboard'));
    $('adminBulkExportUsers')?.addEventListener('click', bulkExportUsersCSV);
}

// ENTERPRISE FUZZY SEARCH LOGIC
function debounceSearch(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function levenshteinDistance(a, b) {
    const matrix = [];
    for(let i=0; i<=b.length; i++){ matrix[i] = [i]; }
    for(let j=0; j<=a.length; j++){ matrix[0][j] = j; }
    for(let i=1; i<=b.length; i++){
        for(let j=1; j<=a.length; j++){
            if(b.charAt(i-1) == a.charAt(j-1)){
                matrix[i][j] = matrix[i-1][j-1];
            } else {
                matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

function handleFuzzyAutocompleteSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const sugBox = $('searchSuggestions');
    if(!query) { sugBox.classList.add('hidden'); renderUnifiedGlobalLibrary(); return; }

    let suggestions = [];
    let allSearchableStr = [];
    globalQuizzes.forEach(q => allSearchableStr.push({text: q.metaExam, type: 'Exam'}));
    globalQuizzes.forEach(q => allSearchableStr.push({text: q.metaTopic, type: 'Topic'}));
    globalUsers.forEach(u => allSearchableStr.push({text: u.name, type: 'User'}));
    globalGroups.forEach(g => allSearchableStr.push({text: g.groupName, type: 'Group'}));

    // Basic match and fuzzy match
    allSearchableStr.forEach(item => {
        if(!item.text) return;
        const textLower = item.text.toLowerCase();
        if(textLower.includes(query) || levenshteinDistance(query, textLower.substring(0, query.length)) <= 2) {
            if(!suggestions.some(s => s.text === item.text)) suggestions.push(item);
        }
    });

    sugBox.innerHTML = '';
    if(suggestions.length > 0) {
        suggestions.slice(0, 8).forEach(s => {
            let div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<b>${s.type}:</b> ${s.text}`;
            div.onclick = () => {
                $('globalSearchInput').value = s.text;
                sugBox.classList.add('hidden');
                renderUnifiedGlobalLibrary();
            };
            sugBox.appendChild(div);
        });
        sugBox.classList.remove('hidden');
    } else {
        sugBox.classList.add('hidden');
    }
    renderUnifiedGlobalLibrary();
}

async function checkUrlParamsDeployment() {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('quiz');
    if (quizId) {
        showToast("Incoming URL parameters matched. Accessing node assignment context...", "info");
        await triggerAssessmentMountSequence(quizId);
    }
}

// ADMINISTRATIVE AUTHENTICATION WORKFLOW CONTROL MATRIX
function handleAdminAuthenticationWorkflow() {
    const user = $('adminUserField').value.trim();
    const pass = $('adminPassField').value.trim();

    if (user === 'sakthivelavankpc@gmail.com' && pass === '12345') {
        $('adminAuthModal').classList.add('hidden');
        if(localStorage.getItem('adminPasswordChanged')) {
            activateAdminSession();
        } else {
            $('adminPasswordResetModal').classList.remove('hidden');
        }
    } else if(localStorage.getItem('adminPasswordChanged') && pass === localStorage.getItem('secureAdminPass')) {
         $('adminAuthModal').classList.add('hidden');
         activateAdminSession();
    } else {
        showToast("Invalid enterprise master admin security keys.", "error");
    }
}

function activateAdminSession() {
    adminAuthenticated = true;
    localStorage.setItem('adminSession', 'active');
    $('globalLogoutBtn').classList.remove('hidden');
    $('adminDashboardPanel').classList.remove('hidden');
    renderAdminDashboardConsole();
    showToast("Administrative secure configuration tracking loaded.", "success");
}

$('submitAdminPasswordResetBtn')?.addEventListener('click', () => {
    const newPass = $('adminNewPassword').value.trim();
    if (newPass.length < 4) return showToast("Password metric density scale insecure.", "warning");
    localStorage.setItem('secureAdminPass', newPass);
    localStorage.setItem('adminPasswordChanged', 'true');
    $('adminPasswordResetModal').classList.add('hidden');
    activateAdminSession();
});

// GENERATE DYNAMIC HIGH-FIDELITY MATRIX RENDER VIEWS
function renderUnifiedGlobalLibrary() {
    const mainGrid = $('libraryGrid');
    const legacyQuizGrid = $('legacyQuizzesGrid');
    const legacyGroupGrid = $('legacyGroupsGrid');
    if (!mainGrid) return;

    const queryToken = ($('globalSearchInput').value || "").toLowerCase().trim();
    const fSub = $('advFilterSubject').value;
    const fDist = $('advFilterDistrict').value;
    const fCity = $('advFilterCity').value;
    const fCls = $('advFilterClass').value;

    mainGrid.innerHTML = "";
    legacyQuizGrid.innerHTML = "";
    legacyGroupGrid.innerHTML = "";

    globalQuizzes.forEach(q => {
        if (fSub !== 'all' && q.metaSubject !== fSub) return;
        if (fDist !== 'all' && q.metaDistrict !== fDist) return;
        if (fCity !== 'all' && q.metaCity !== fCity) return;
        if (fCls !== 'all' && q.metaClass !== fCls) return;

        if (queryToken) {
            const stringMap = `${q.metaExam} ${q.metaTopic} ${q.metaSubject} ${q.creatorName}`.toLowerCase();
            if (!stringMap.includes(queryToken) && levenshteinDistance(queryToken, stringMap.substring(0, queryToken.length)) > 3) return;
        }

        const card = createCardDOMNode(q, 'quiz');
        mainGrid.appendChild(card.cloneNode(true));
        legacyQuizGrid.appendChild(card);
    });

    globalGroups.forEach(g => {
        if (fSub !== 'all' && g.subject !== fSub) return;
        if (fCls !== 'all' && g.class !== fCls) return;

        if (queryToken) {
            const stringMap = `${g.groupName} ${g.topics} ${g.subject} ${g.creator}`.toLowerCase();
            if (!stringMap.includes(queryToken) && levenshteinDistance(queryToken, stringMap.substring(0, queryToken.length)) > 3) return;
        }

        const card = createCardDOMNode(g, 'group');
        mainGrid.appendChild(card.cloneNode(true));
        legacyGroupGrid.appendChild(card);
    });

    bindOperationalLibraryCardClickActions();
}

function createCardDOMNode(item, type) {
    const container = document.createElement('div');
    container.className = `quiz-card ${type === 'quiz' ? 'card-blue' : 'card-green'}`;
    container.dataset.id = item.id;
    container.dataset.type = type;

    const name = type === 'quiz' ? item.metaExam : item.groupName;
    const topic = type === 'quiz' ? item.metaTopic : item.topics;
    const subject = type === 'quiz' ? item.metaSubject : item.subject;
    const creator = type === 'quiz' ? item.creatorName : item.creator;
    const qCount = type === 'quiz' ? (item.questions?.length || 0) : (item.questionCount || 0);

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="card-badge">${type.toUpperCase()}</span>
            <input type="checkbox" class="group-assemble-checkbox" data-id="${item.id}" style="width:20px; height:20px;" />
        </div>
        <h4 class="card-title">${EnterpriseSanitizer.clean(name)}</h4>
        <div class="card-sub"><b>Topic:</b> ${EnterpriseSanitizer.clean(topic)}</div>
        <div class="card-sub"><b>Subject:</b> ${EnterpriseSanitizer.clean(subject)} | <b>By:</b> ${EnterpriseSanitizer.clean(creator)}</div>
        <div class="card-sub"><b>Payload Complexity:</b> ${qCount} Questions Data Maps</div>
        <div class="card-actions-wrapper" style="margin-top:10px; display:flex; gap:5px;">
            <button class="btn-sm btn-primary play-btn-trigger"><i class="ri-play-fill"></i> Play</button>
            <button class="btn-sm btn-secondary share-btn-trigger"><i class="ri-share-line"></i> Deploy Link</button>
            <button class="btn-sm btn-accent preview-btn-trigger"><i class="ri-eye-line"></i> Specs Preview</button>
        </div>
    `;
    return container;
}

function bindOperationalLibraryCardClickActions() {
    document.querySelectorAll('.play-btn-trigger').forEach(btn => {
        btn.onclick = (e) => {
            const card = e.target.closest('.quiz-card');
            triggerAssessmentMountSequence(card.dataset.id, card.dataset.type);
        };
    });
    document.querySelectorAll('.share-btn-trigger').forEach(btn => {
        btn.onclick = (e) => {
            const card = e.target.closest('.quiz-card');
            exposeDeploymentShareModal(card.dataset.id, card.dataset.type);
        };
    });
    document.querySelectorAll('.preview-btn-trigger').forEach(btn => {
        btn.onclick = (e) => {
            const card = e.target.closest('.quiz-card');
            alert(`Specification Manifest Node Context Info:\nID Asset Index: ${card.dataset.id}\nArchitecture Alignment Type: ${card.dataset.type.toUpperCase()}`);
        };
    });
    document.querySelectorAll('.group-assemble-checkbox').forEach(cb => {
        cb.onchange = (e) => {
            if (e.target.checked) selectedQuizIdsForGroup.add(e.target.dataset.id);
            else selectedQuizIdsForGroup.delete(e.target.dataset.id);
        };
    });
}

function exposeDeploymentShareModal(id, type) {
    const prefix = type === 'group' ? 'group_' : '';
    const deploymentUrl = `${window.location.origin}${window.location.pathname}?quiz=${prefix}${id}`;
    $('shareLinkInput').value = deploymentUrl;
    $('shareModalTopic').textContent = `Target Identification Key Alignment Asset: ${id}`;
    $('shareModal').classList.remove('hidden');
}

// MOUNT ASSESSMENT RUNTIME INSTANCE
async function triggerAssessmentMountSequence(id) {
    let targetPayload = null;
    
    if (id.startsWith('group_')) {
        const actualGroupId = id.replace('group_', '');
        const matchGroup = globalGroups.find(g => g.id === actualGroupId);
        if (!matchGroup) return showToast("Exam group record could not be indexed from structural context storage.", "error");
        
        let aggregatedQuestions = [];
        let uniqueQTracker = new Set();

        for (let qid of matchGroup.quizIds) {
            let quizDoc = await getDoc(doc(db, "quizzes", qid));
            if (quizDoc.exists() && quizDoc.data().questions) {
                // Remove duplicates by checking text
                quizDoc.data().questions.forEach(q => {
                    if(!uniqueQTracker.has(q.text)) {
                        uniqueQTracker.add(q.text);
                        aggregatedQuestions.push(q);
                    }
                });
            }
        }
        targetPayload = {
            metaExam: matchGroup.groupName, metaTopic: matchGroup.topics, metaSubject: matchGroup.subject,
            metaClass: matchGroup.class, totalMinutes: 60, totalMarks: matchGroup.totalMarks,
            questions: aggregatedQuestions, minPassMarks: 40, shuffleQuestions: true
        };
    } else {
        const matchQuiz = globalQuizzes.find(q => q.id === id);
        if (!matchQuiz) {
            const docSnap = await getDoc(doc(db, "quizzes", id));
            if (docSnap.exists()) targetPayload = docSnap.data();
            else return showToast("Target component matrix not resolved.", "error");
        } else {
            targetPayload = matchQuiz;
        }
    }

    currentQuizData = targetPayload;
    if (studentProfile) {
        mountQuizInterfaceRuntimeEnvironment();
    } else {
        $('globalRegistrationModal').classList.remove('hidden');
    }
}

// ENTERPRISE ACCOUNT REGISTRATION MATRIX
async function executeEnterpriseAccountRegistration() {
    const fields = ['regRole', 'regName', 'regSchool', 'regCity', 'regDistrict', 'regState', 'regCountry', 'regMobile', 'regEmail', 'regPassword'];
    let payload = {};
    for (let f of fields) {
        payload[f.replace('reg', '').toLowerCase()] = $(f).value.trim();
        if (!$(f).value.trim()) return showToast(`Required data mapping vector path empty: ${f}`, "warning");
    }

    payload.userId = `${payload.role === 'teacher' ? 'TCH' : 'STU'}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    payload.createdAt = new Date().toISOString();

    try {
        await addDoc(collection(db, "registrations"), payload);
        await localforage.setItem('userProfile', payload);
        studentProfile = payload;
        $('globalLogoutBtn').classList.remove('hidden');
        $('globalRegistrationModal').classList.add('hidden');
        showToast(`Account Provisioning Validated! Welcome ID Index Allocation: ${payload.userId}`, "success");
        if (currentQuizData) mountQuizInterfaceRuntimeEnvironment();
        else fetchUnifiedDatabases();
    } catch (e) { showToast("Cloud record storage allocation generation dropped.", "error"); }
}

async function executeManualAccountAuthentication() {
    const id = $('loginUserId').value.trim();
    const pass = $('loginPassword').value.trim();
    if (!id || !pass) return showToast("Missing authorization access metrics.", "warning");

    const match = globalUsers.find(u => (u.userId === id || u.email === id) && u.password === pass);
    if (match) {
        await localforage.setItem('userProfile', match);
        studentProfile = match;
        $('globalLogoutBtn').classList.remove('hidden');
        $('studentLoginModal').classList.add('hidden');
        if (currentQuizData) mountQuizInterfaceRuntimeEnvironment();
        else fetchUnifiedDatabases();
    } else {
        showToast("Invalid user identification credentials signature.", "error");
    }
}

function mountQuizInterfaceRuntimeEnvironment() {
    $('librarySection').classList.add('hidden');
    $('legacyQuizzesSection').classList.add('hidden');
    $('legacyGroupsSection').classList.add('hidden');
    $('globalSearchPanel').classList.add('hidden');
    $('homeYoutubeWidget').classList.add('hidden');
    $('quizSection').classList.remove('hidden');

    $('studentInfoDisplay').classList.remove('hidden');
    $('dispName').textContent = studentProfile.name;
    $('dispPlace').textContent = `${studentProfile.school} [ID: ${studentProfile.userid}]`;

    currentQuestions = JSON.parse(JSON.stringify(currentQuizData.questions)); // Deep copy to prevent reference mutation
    if (currentQuizData.shuffleQuestions) currentQuestions = shuffleArray(currentQuestions);

    studentAnswers = {};
    currentQIndex = 0;

    if (currentQuizData.totalMinutes > 0) {
        mainSecondsLeft = currentQuizData.totalMinutes * 60;
        runMainTimerTickerEngine();
        mainTimerInterval = setInterval(() => {
            mainSecondsLeft--;
            runMainTimerTickerEngine();
            if (mainSecondsLeft <= 0) autoCloseQuizExecutionTerminal();
        }, 1000);
    } else {
        $('mainTimerLabel').textContent = "Unlimited Window Frame";
    }

    renderActiveAssessmentQuestionBlock();
}

function runMainTimerTickerEngine() {
    const m = Math.floor(mainSecondsLeft / 60).toString().padStart(2, '0');
    const s = (mainSecondsLeft % 60).toString().padStart(2, '0');
    $('mainTimerLabel').textContent = `${m}:${s}`;
}

function renderActiveAssessmentQuestionBlock() {
    const q = currentQuestions[currentQIndex];
    if (!q) return;

    $('quizDisplayExamName').textContent = currentQuizData.metaExam;
    $('quizDisplaySubject').textContent = currentQuizData.metaSubject;
    $('quizDisplayChapter').textContent = currentQuizData.metaClass || "Universal";
    $('quizDisplayTopic').textContent = currentQuizData.metaTopic || "Merged Array Space";
    $('questionProgressLabel').textContent = `Question Component Track: ${currentQIndex + 1} of ${currentQuestions.length}`;
    
    $('progressBarFill').style.width = `${((currentQIndex + 1) / currentQuestions.length) * 100}%`;
    $('questionBox').innerHTML = q.text;

    const optContainer = $('optionsBox');
    optContainer.innerHTML = "";
    
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "opt-btn";
        if (studentAnswers[currentQIndex] === opt) btn.className += " selected";
        btn.innerHTML = `<b>${String.fromCharCode(65 + idx)}:</b> ${opt}`;
        btn.onclick = () => {
            studentAnswers[currentQIndex] = opt;
            renderActiveAssessmentQuestionBlock();
        };
        optContainer.appendChild(btn);
    });

    $('prevBtn').disabled = (currentQIndex === 0);
    if (currentQIndex === currentQuestions.length - 1) {
        $('nextBtn').classList.add('hidden');
        $('finishBtn').classList.remove('hidden');
    } else {
        $('nextBtn').classList.remove('hidden');
        $('finishBtn').classList.add('hidden');
    }
}

function navigateActiveQuizPosition(step) {
    currentQIndex += step;
    renderActiveAssessmentQuestionBlock();
}

function completeQuizExecutionStateSequence() {
    if (confirm("Terminate execution thread and upload diagnostic evaluation metrics matrix?")) {
        autoCloseQuizExecutionTerminal();
    }
}

async function autoCloseQuizExecutionTerminal() {
    clearInterval(mainTimerInterval);
    clearInterval(perQTimerInterval);

    $('quizSection').classList.add('hidden');
    $('studentInfoDisplay').classList.add('hidden');
    $('reviewSection').classList.remove('hidden');

    let dynamicCorrectEvaluations = 0;
    let reviewHTML = `<div class="review-list-container">`;

    currentQuestions.forEach((q, i) => {
        const selected = studentAnswers[i] || "";
        const isCorrect = (selected.trim().toLowerCase() === q.answer.trim().toLowerCase());
        if (isCorrect) dynamicCorrectEvaluations++;

        reviewHTML += `
            <div class="review-card" style="border-left: 5px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}; margin-bottom:10px; padding:10px; background:var(--surface); border-radius:8px;">
                <p><b>#${i + 1}:</b> ${q.text}</p>
                <p style="color:${isCorrect ? 'var(--success)' : 'var(--danger)'}"><b>Your Selection:</b> ${selected || 'Skipped'}</p>
                <p style="color:var(--primary)"><b>Validated Correct Answer:</b> ${q.answer}</p>
            </div>
        `;
    });
    reviewHTML += "</div>";
    $('reviewTableContainer').innerHTML = reviewHTML;

    const finalCalculatedScore = ((dynamicCorrectEvaluations / currentQuestions.length) * currentQuizData.totalMarks).toFixed(1);
    $('finalScoreDisplay').textContent = finalCalculatedScore;

    const isPassed = parseFloat(finalCalculatedScore) >= (currentQuizData.minPassMarks || 40);
    $('passFailText').textContent = `EVALUATION INDEX DIAGNOSTIC: ${isPassed ? 'PASS' : 'FAIL'}`;
    $('passFailText').style.color = isPassed ? 'var(--success)' : 'var(--danger)';

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.href)}`;
    $('resultQrCodeBlock').innerHTML = `<img src="${qrUrl}" alt="Verification Engine Matrix Verification Tracker" /><br><small style="color:var(--text-light)">Secure Verification Node Hash Tag Reference</small>`;

    try {
        await addDoc(collection(db, "activityLogs"), {
            studentId: studentProfile.userid || 'GUEST',
            name: studentProfile.name,
            examName: currentQuizData.metaExam,
            score: parseFloat(finalCalculatedScore),
            pass: isPassed,
            timestamp: new Date().toISOString()
        });
    } catch(e) { console.error(e); }
}

function gatherDiagnosticPayloadReportText() {
    return `Quiz Master Diagnostic Metrics Index\nCandidate: ${studentProfile?.name || 'GUEST'}\nScore Allocation: ${$('finalScoreDisplay').textContent} Points\nStatus Context: ${$('passFailText').textContent}`;
}
function fireWhatsAppOutboundReportingPayload() {
    const text = encodeURIComponent(gatherDiagnosticPayloadReportText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}
function fireEmailOutboundReportingPayload() {
    const sub = encodeURIComponent("Quiz Master System Engine Verification Metrics");
    const body = encodeURIComponent(gatherDiagnosticPayloadReportText());
    window.open(`mailto:?subject=${sub}&body=${body}`);
}

function addManualRow() {
    const tbody = $('manualTable').getElementsByTagName('tbody')[0];
    const index = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${index}</td>
        <td><input type="text" class="mq-text" placeholder="Question content text string" /></td>
        <td><input type="text" class="mo-a" placeholder="Opt A" /></td>
        <td><input type="text" class="mo-b" placeholder="Opt B" /></td>
        <td><input type="text" class="mo-c" placeholder="Opt C" /></td>
        <td><input type="text" class="mo-d" placeholder="Opt D" /></td>
        <td><input type="text" class="mq-ans" placeholder="Matching explicit text answer value" /></td>
        <td><button class="btn-icon" onclick="this.closest('tr').remove();" style="color:var(--danger);"><i class="ri-close-line"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function extractManualRowsData() {
    const rows = document.querySelectorAll('#manualTable tbody tr');
    let output = [];
    rows.forEach(r => {
        const txt = r.querySelector('.mq-text').value.trim();
        const ans = r.querySelector('.mq-ans').value.trim();
        const opts = [r.querySelector('.mo-a').value.trim(), r.querySelector('.mo-b').value.trim(), r.querySelector('.mo-c').value.trim(), r.querySelector('.mo-d').value.trim()];
        if (txt && ans) output.push({ text: txt, options: opts.filter(Boolean), answer: ans });
    });
    return output;
}

function parseInputCSVDataStream(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target.result;
        let lineSegments = text.split('\n');
        intermediaryParsedCsvArray = [];
        let previewHtml = `<table><thead><tr><th>Question Context</th><th>Answers Map Target</th></tr></thead><tbody>`;
        
        lineSegments.forEach((line, idx) => {
            if (idx === 0 || !line.trim()) return; 
            let columns = line.split(',');
            if (columns.length >= 3) {
                let q = columns[0].replace(/"/g, '').trim();
                let ans = columns[columns.length - 1].replace(/"/g, '').trim();
                let opts = columns.slice(1, columns.length - 1).map(o => o.replace(/"/g, '').trim());
                intermediaryParsedCsvArray.push({ text: q, options: opts, answer: ans });
                previewHtml += `<tr><td>${q}</td><td><b>${ans}</b></td></tr>`;
            }
        });
        previewHtml += "</tbody></table>";
        $('csvTableContainer').innerHTML = previewHtml;
        $('csvPreview').classList.remove('hidden');
    };
    reader.readAsText(file);
}

function parseAdvancedExcelSheetDataStream(e) {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return showToast("Spreadsheet core processing engine layout not mounted.", "error");
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (evt) => {
        const buffer = new Uint8Array(evt.target.result);
        const book = XLSX.read(buffer, { type: 'array', cellStyles: true });
        const sheet = book.Sheets[book.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (matrix.length < 2) return showToast("Data Matrix underpopulated.", "error");
        
        let accepted = [];
        for (let i = 1; i < matrix.length; i++) {
            let row = matrix[i];
            if (row[0] && row[row.length - 1]) {
                accepted.push({
                    text: row[0].toString(),
                    options: row.slice(1, row.length - 1).map(o => o.toString()),
                    answer: row[row.length - 1].toString()
                });
            }
        }
        EnterpriseWorkspaceEditor.loadQuestionsIntoWorkspace(accepted);
    };
}

const EnterpriseWorkspaceEditor = {
    init() {
        this.bindToolbarCoreActions();
    },
    loadQuestionsIntoWorkspace(array) {
        activeWorkspaceQuestions = array.map(q => ({
            text: EnterpriseSanitizer.clean(q.text),
            options: Array.isArray(q.options) ? q.options.map(o => EnterpriseSanitizer.clean(o)) : ["", "", "", ""],
            answer: EnterpriseSanitizer.clean(q.answer)
        }));
        $('workspaceQuestionCount').textContent = `${activeWorkspaceQuestions.length} Connected Array Elements Loaded`;
        $('enterpriseWorkspacePanel').classList.remove('hidden');
        this.renderWorkspaceEditorGrid();
    },
    renderWorkspaceEditorGrid() {
        const target = $('virtualWorkspaceContainer');
        target.innerHTML = "";
        activeWorkspaceQuestions.forEach((q, idx) => {
            const block = document.createElement('div');
            block.className = "workspace-question-block";
            block.innerHTML = `
                <div class="workspace-row-index">Editable Target Identity Index: #${idx + 1}</div>
                <div class="editable-workspace-cell" contenteditable="true" data-idx="${idx}" data-field="text">${q.text}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">
                    <div class="editable-workspace-cell" contenteditable="true" data-idx="${idx}" data-field="opt-0">${q.options[0] || ''}</div>
                    <div class="editable-workspace-cell" contenteditable="true" data-idx="${idx}" data-field="opt-1">${q.options[1] || ''}</div>
                    <div class="editable-workspace-cell" contenteditable="true" data-idx="${idx}" data-field="opt-2">${q.options[2] || ''}</div>
                    <div class="editable-workspace-cell" contenteditable="true" data-idx="${idx}" data-field="opt-3">${q.options[3] || ''}</div>
                </div>
                <div class="editable-workspace-cell" contenteditable="true" data-idx="${idx}" data-field="answer" style="border-color:var(--success); font-weight:bold; margin-top:5px;">${q.answer}</div>
            `;
            block.querySelectorAll('[contenteditable]').forEach(cell => {
                cell.oninput = (e) => {
                    const i = parseInt(e.target.dataset.idx);
                    const f = e.target.dataset.field;
                    const val = e.target.innerHTML;
                    if (f === 'text') activeWorkspaceQuestions[i].text = val;
                    else if (f === 'answer') activeWorkspaceQuestions[i].answer = val;
                    else {
                        const optIdx = parseInt(f.split('-')[1]);
                        activeWorkspaceQuestions[i].options[optIdx] = val;
                    }
                };
            });
            target.appendChild(block);
        });
    },
    bindToolbarCoreActions() {
        document.querySelectorAll('#enterpriseToolbar button[data-cmd]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const cmd = e.target.closest('button').dataset.cmd;
                const val = e.target.closest('button').dataset.val || null;
                document.execCommand(cmd, false, val);
            };
        });
        $('insertImageBtn')?.addEventListener('click', () => {
            const url = prompt("Enter Image URL:");
            if(url) document.execCommand('insertImage', false, url);
        });
        $('insertTableBtn')?.addEventListener('click', () => {
            let html = "<table border='1' style='width:100%; border-collapse:collapse;'><tr><td>Cell 1</td><td>Cell 2</td></tr></table><br/>";
            document.execCommand('insertHTML', false, html);
        });
    }
};

function runSandboxAssessmentLiveTestingEnvironment() {
    if (activeWorkspaceQuestions.length === 0) return showToast("Active configuration workspace track empty.", "warning");
    currentQuizData = {
        metaExam: "SANDBOX ASSESSMENT LIVE RUN TARGET PREVIEW", metaTopic: "System Testing Context",
        metaSubject: "Diagnostics Framework", metaClass: "Enterprise Meta Block", totalMinutes: 0,
        totalMarks: 100, questions: activeWorkspaceQuestions, shuffleQuestions: false, minPassMarks: 50
    };
    mountQuizInterfaceRuntimeEnvironment();
}

async function commitFinalWorkspacePayloadToCloud() {
    if (activeWorkspaceQuestions.length === 0) return showToast("Cannot commit empty structural array pipeline.", "warning");
    
    const payload = {
        creatorName: $('creatorName').value.trim() || "Master Educator Context",
        creatorPassword: $('creatorPassword').value.trim() || "1234",
        creatorEmail: $('creatorEmail').value.trim() || "records@kalvikadal.in",
        metaExam: $('metaExam').value.trim() || "Universal Assignment Track",
        metaSubject: $('metaSubject').value.trim() || "General Engineering Studies",
        metaClass: $('metaClass').value.trim() || "12th Standard Segment",
        metaTopic: $('metaTopic').value.trim() || "Applied Analytical Principles",
        metaDistrict: $('metaDistrict').value.trim() || "Chennai Core District",
        metaCity: $('metaCity').value.trim() || "Tamil Nadu Base Core Area",
        totalMinutes: parseInt($('totalMinutes').value) || 30,
        totalMarks: parseInt($('totalMarks').value) || 100,
        perQuestionSeconds: parseInt($('perQuestionSeconds').value) || 0,
        minPassMarks: parseInt($('minPassMarks').value) || 40,
        shuffleQuestions: $('shuffleQuestions').checked,
        teacherWhatsapp: $('teacherWhatsapp').value.trim() || "",
        questions: activeWorkspaceQuestions,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "quizzes"), payload);
        showToast("Asset module securely published to global database networks.", "success");
        $('enterpriseWorkspacePanel').classList.add('hidden');
        $('creatorPanel').classList.add('hidden');
        fetchUnifiedDatabases();
    } catch(e) { showToast("Global publishing synchronization sequence dropped.", "error"); }
}

async function evaluateAndCompileSelectedExamGroup() {
    const gName = $('v20-group-name').value.trim();
    if (!gName) return showToast("Specify target compiled collection identity parameters header.", "warning");
    if (selectedQuizIdsForGroup.size < 2) return showToast("Exam cluster configuration requires minimum 2 quiz linkages.", "warning");

    let subtotalQuestions = 0;
    let computedCombinedMarks = 0;
    let topicsMerged = [];
    
    globalQuizzes.forEach(q => {
        if (selectedQuizIdsForGroup.has(q.id)) {
            subtotalQuestions += (q.questions?.length || 0);
            computedCombinedMarks += parseInt(q.totalMarks || 100);
            if (q.metaTopic) topicsMerged.push(q.metaTopic);
        }
    });

    const payload = {
        groupName: gName,
        quizIds: Array.from(selectedQuizIdsForGroup),
        topics: topicsMerged.join(' + '),
        questionCount: subtotalQuestions,
        totalMarks: computedCombinedMarks,
        subject: "Combined Specialization Studies Field",
        class: "Higher Advanced Standards Core Track",
        creator: "Enterprise Automated Assembler Engine Matrix",
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "exam_groups"), payload);
        showToast("Composite multi-tier collection deployment tracking activated.", "success");
        $('v20-group-name').value = "";
        selectedQuizIdsForGroup.clear();
        fetchUnifiedDatabases();
    } catch(e) { showToast("Failed to compile cluster group context link array map.", "error"); }
}

function renderAdminDashboardConsole() {
    $('anTotalUsers').textContent = globalUsers.length;
    $('anTeachers').textContent = globalUsers.filter(u => u.role === 'teacher').length;
    $('anStudents').textContent = globalUsers.filter(u => u.role === 'student').length;
    $('anQuizzes').textContent = globalQuizzes.length;
    $('anGroups').textContent = globalGroups.length;
    $('anAttempts').textContent = globalLogs.length;

    let qCountTotal = 0; globalQuizzes.forEach(q => qCountTotal += (q.questions?.length || 0));
    $('anQuestions').textContent = qCountTotal;

    let subSchools = new Set(); globalUsers.forEach(u => { if (u.school) subSchools.add(u.school); });
    $('anSchools').textContent = subSchools.size;

    if (globalLogs.length > 0) {
        let passCount = globalLogs.filter(l => l.pass === true).length;
        let pRate = ((passCount / globalLogs.length) * 100).toFixed(1);
        $('anPassRate').textContent = `${pRate}%`;
        $('anFailRate').textContent = `${(100 - parseFloat(pRate)).toFixed(1)}%`;
        
        $('chartPassBar').style.width = `${pRate}%`;
        $('chartFailBar').style.width = `${100 - parseFloat(pRate)}%`;

        let scoreSum = 0; globalLogs.forEach(l => scoreSum += parseFloat(l.score || 0));
        $('anAvgScore').textContent = (scoreSum / globalLogs.length).toFixed(1);
    }

    renderAdminUsersGridTable();
    renderAdminQuizzesGridTable();
    renderAdminGroupsGridTable();
    renderAdminLeaderboardViewGrid();
    renderAdminRecycleBinTable();
}

function renderAdminUsersGridTable() {
    const target = $('adminUserTableBody');
    target.innerHTML = "";
    globalUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" data-uid="${u.id}" /></td>
            <td><small>${u.userId || 'N/A'}</small><br><span style="font-size:0.7rem; color:var(--text-light);">${u.createdat || 'Prior Period'}</span></td>
            <td><b>${u.name}</b><br><small>${u.email}</small></td>
            <td><span class="card-badge">${u.role?.toUpperCase()}</span></td>
            <td>${u.school}<br><small>${u.city}, ${u.district}</small></td>
            <td>Attempts: <b>${globalLogs.filter(l => l.name === u.name).length}</b></td>
            <td>
                <button class="btn-sm btn-accent" onclick="alert('User editing framework profile lock mapping active.')">Edit</button>
                <button class="btn-sm btn-danger" data-id="${u.id}" data-action="delete-user">Delete</button>
            </td>
        `;
        target.appendChild(tr);
    });
    bindAdminGridRowModificationActions();
}

function renderAdminQuizzesGridTable() {
    const target = $('adminQuizTableBody');
    target.innerHTML = "";
    globalQuizzes.forEach(q => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" data-qid="${q.id}" /></td>
            <td><b>${q.metaExam}</b></td>
            <td>${q.metaSubject}<br><small style="color:var(--primary);">${q.metaTopic}</small></td>
            <td>${q.creatorName}</td>
            <td><b>${q.questions?.length || 0} Nodes</b></td>
            <td>
                <button class="btn-sm btn-danger" data-id="${q.id}" data-action="delete-quiz">Delete</button>
            </td>
        `;
        target.appendChild(tr);
    });
    bindAdminGridRowModificationActions();
}

function renderAdminGroupsGridTable() {
    const target = $('adminGroupTableBody');
    target.innerHTML = "";
    globalGroups.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${g.groupName}</b></td>
            <td><small>${g.topics}</small></td>
            <td>${g.subject} &bull; ${g.class}</td>
            <td><span class="card-badge" style="background:var(--accent);">${g.quizIds?.length || 0} Components</span></td>
            <td>
                <button class="btn-sm btn-danger" data-id="${g.id}" data-action="delete-group">Delete</button>
            </td>
        `;
        target.appendChild(tr);
    });
    bindAdminGridRowModificationActions();
}

function renderAdminLeaderboardViewGrid() {
    const target = $('adminLeaderboardTableBody');
    if (!target) return;
    target.innerHTML = "";

    let trackingLogs = [...globalLogs];
    const ex = $('lblFilterExam').value;
    const topic = $('lblFilterTopic').value;
    const school = $('lblFilterSchool').value;
    const district = $('lblFilterDistrict').value;
    const m = $('lblFilterMetric').value;

    if (ex !== 'all') trackingLogs = trackingLogs.filter(l => l.examName === ex);
    // Note: Assuming topic, school, dist filtering if data existed in log. Log structure lacks deep references, mocking check.
    if (school !== 'all') trackingLogs = trackingLogs.filter(l => l.school === school);

    if (m === 'high') trackingLogs.sort((a,b) => b.score - a.score);
    else if (m === 'low') trackingLogs.sort((a,b) => a.score - b.score);
    else if (m === 'latest') trackingLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    else if (m === 'oldest') trackingLogs.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    else if (m === 'pass') trackingLogs = trackingLogs.filter(l => l.pass);
    else if (m === 'fail') trackingLogs = trackingLogs.filter(l => !l.pass);

    trackingLogs.forEach((l, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>#${idx + 1}</b></td>
            <td><small>${l.studentId || 'EXTERNAL'}</small></td>
            <td><b>${l.name}</b></td>
            <td>${l.school || 'Academy Node Area'}</td>
            <td>${l.district || 'State Platform'}</td>
            <td><mark style="background:var(--secondary); padding:2px 6px; border-radius:4px; font-weight:bold;">${l.score} pts</mark></td>
            <td><small>${l.timestamp ? l.timestamp.substring(0,10) : 'Real-Time Track'}</small></td>
        `;
        target.appendChild(tr);
    });
}

function renderAdminRecycleBinTable() {
    const target = $('adminRecycleBinTableBody');
    target.innerHTML = "";
    if (recycleBin.length === 0) {
        target.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-light);">System trash matrix storage nodes clean.</td></tr>`;
        return;
    }
    recycleBin.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="card-badge">${item.type.toUpperCase()}</span></td>
            <td><b>${item.name}</b></td>
            <td>Now Tracking Retention</td>
            <td><button class="btn-sm btn-primary" onclick="restoreTargetRecycleAssetNode(${idx})">Restore Node</button></td>
        `;
        target.appendChild(tr);
    });
}

function bindAdminGridRowModificationActions() {
    document.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
        btn.onclick = async (e) => {
            if(!confirm("Purge asset record registration link node context from data cloud?")) return;
            const id = e.target.dataset.id;
            const match = globalUsers.find(u => u.id === id);
            recycleBin.push({ type: 'user', name: match?.name || id, originalData: match, collection: 'registrations' });
            await deleteDoc(doc(db, "registrations", id));
            fetchUnifiedDatabases();
        };
    });
    document.querySelectorAll('[data-action="delete-quiz"]').forEach(btn => {
        btn.onclick = async (e) => {
            if(!confirm("Purge quiz alignment definition matrix array configuration parameters node link?")) return;
            const id = e.target.dataset.id;
            const match = globalQuizzes.find(q => q.id === id);
            recycleBin.push({ type: 'quiz', name: match?.metaExam || id, originalData: match, collection: 'quizzes' });
            await deleteDoc(doc(db, "quizzes", id));
            fetchUnifiedDatabases();
        };
    });
    document.querySelectorAll('[data-action="delete-group"]').forEach(btn => {
        btn.onclick = async (e) => {
            if(!confirm("Purge exam cluster metrics compilation layer reference asset node mapping pointers?")) return;
            const id = e.target.dataset.id;
            const match = globalGroups.find(g => g.id === id);
            recycleBin.push({ type: 'group', name: match?.groupName || id, originalData: match, collection: 'exam_groups' });
            await deleteDoc(doc(db, "exam_groups", id));
            fetchUnifiedDatabases();
        };
    });
}

window.restoreTargetRecycleAssetNode = async function(idx) {
    const asset = recycleBin[idx];
    try {
        await addDoc(collection(db, asset.collection), asset.originalData);
        recycleBin.splice(idx, 1);
        showToast("Asset element target matrix restored successfully.", "success");
        fetchUnifiedDatabases();
    } catch(e) { showToast("Restoration initialization failed.", "error"); }
};

// HIGH-RESOLUTION PRODUCTION EXPORT ENGINES (jsPDF Integration)
function generateEnterpriseExportPDF(variantType) {
    if (!window.jspdf) return showToast("PDF composition layout module framework dropped.", "error");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(13, 148, 136);
    doc.text("QUIZ MASTER PRO ENTERPRISE NETWORK SYSTEM", 14, 25);
    
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 30, 196, 30);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont("Helvetica", "normal");
    doc.text(`System Generated Verification Manifest Sequence Trace Token Stamp Date Indicator: ${new Date().toLocaleString()}`, 14, 37);

    if (variantType === 'answer_key' && currentQuizData) {
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text(`Official Verified Solution Key Assignment Context: ${currentQuizData.metaExam}`, 14, 47);
        doc.setFontSize(10);
        doc.text(`Topic: ${currentQuizData.metaTopic} | Subject: ${currentQuizData.metaSubject} | Total Marks: ${currentQuizData.totalMarks}`, 14, 53);
        
        let tabularMappingBodyRows = currentQuestions.map((q, idx) => [
            `#${idx + 1}`,
            EnterpriseSanitizer.stripTags(q.text),
            q.options.map((opt, i) => `${String.fromCharCode(65 + i)}: ${EnterpriseSanitizer.stripTags(opt)}`).join('\n'),
            EnterpriseSanitizer.stripTags(q.answer)
        ]);

        doc.autoTable({
            startY: 60,
            head: [['No.', 'Evaluated Context Problem Proposition Body Text Block', 'Options Matrix', 'Target Answer Vector Output']],
            body: tabularMappingBodyRows,
            theme: 'grid',
            headStyles: { fillColor: [13, 148, 136] }
        });
    } else if (variantType === 'leaderboard') {
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text("Global Competitive Score Distribution Matrix Tracking Record Document", 14, 47);
        
        let tabularMappingBodyRows = globalLogs.map((l, idx) => [
            `Rank Position #${idx+1}`, l.name, l.examName, `${l.score} Points`
        ]);

        doc.autoTable({
            startY: 53,
            head: [['Rank Index Hierarchy Placement Tracking', 'Candidate Entity Signature Name Mapping', 'Evaluated Project Operational Domain Core Assessment Link Assignment Context Name', 'Final Score Verification Yield Index Results']],
            body: tabularMappingBodyRows,
            theme: 'grid',
            headStyles: { fillColor: [249, 115, 22] } 
        });
    }

    const pageCountTotalCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCountTotalCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Authorization Key Verification Protocol Tracking Handshake ID: KALVIKADAL-PRO-ENTERPRISE-v27-SECURE-CHAINED-NODE-VALIDATOR -- Page Reference Sheet Metric: ${i} of ${pageCountTotalCount}`, 14, 288);
    }

    doc.save(`QuizMasterPro_EnterpriseSystemRecord_${variantType}_ExportTrackNode.pdf`);
}

function generateResultPDF() {
    if (!window.jspdf) return showToast("PDF Engine failed.", "error");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(13, 148, 136);
    doc.text("CANDIDATE EVALUATION RESULT", 14, 25);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Candidate: ${studentProfile?.name || 'GUEST'}`, 14, 35);
    doc.text(`Exam: ${currentQuizData?.metaExam}`, 14, 42);
    doc.text(`Final Score: ${$('finalScoreDisplay').textContent}`, 14, 49);
    doc.text(`Status: ${$('passFailText').textContent}`, 14, 56);
    doc.save(`Result_${studentProfile?.name || 'Guest'}.pdf`);
}

function bulkExportUsersCSV() {
    let csv = "User Registration Database Master Log Export\nUser ID,Name,Email,Role,School,City,District\n";
    globalUsers.forEach(u => {
        csv += `"${u.userId || ''}","${u.name || ''}","${u.email || ''}","${u.role || ''}","${u.school || ''}","${u.city || ''}","${u.district || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `QuizMasterPro_UserRegistrationMetrics_BulkDumpTrack.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// FLOATING LEADERBOARD UI ENGINE
function initFloatingLeaderboard() {
    const panel = $('floatingLeaderboardPanel');
    const header = $('floatingLeaderboardHeader');
    const closeBtn = $('closeFloatingLbBtn');
    const minMaxBtn = $('minMaxFloatingLbBtn');
    
    let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    function dragStart(e) {
        if(e.target.closest('.floating-actions')) return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target === header || header.contains(e.target)) isDragging = true;
    }
    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, panel);
        }
    }
    function setTranslate(xPos, yPos, el) { el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`; }

    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
    
    let isMinimized = false;
    minMaxBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        if(isMinimized) {
            panel.style.height = '45px';
            minMaxBtn.innerHTML = '<i class="ri-arrow-down-s-line"></i>';
        } else {
            panel.style.height = '500px';
            minMaxBtn.innerHTML = '<i class="ri-arrow-up-s-line"></i>';
        }
    });
}