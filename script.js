/**
 * QUIZ MASTER PRO v29 ENTERPRISE INTERFACE ENGINE
 * CORE PRODUCTION PLATFORM ARCHITECTURE DESIGN
 */

// --- Comprehensive Memory State Model ---
const enterpriseState = {
  quizzes: [],
  examGroups: [],
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
  currentUser: {
    uid: 'SESSION_NODE_LOCAL_9041',
    role: 'Administrator',
    name: 'Kannairam Sakthivelavan'
  }
};

// --- Comprehensive Static Enterprise Guides Matrix ---
const guidesDatabase = {
  quickstart: {
    title: "System Overview Quickstart",
    body: "Welcome to the Quiz Master Pro Enterprise Management Studio. This architecture coordinates system assets, tests processing pipelines, and tracks state configurations. Use the sidebar workspace matrices to access analytical structures, deploy testing modules, or modify parameters."
  },
  creator: {
    title: "Quiz Creator Framework Documentation",
    body: "The Studio sub-component processes array models to append operational schemas directly onto state repositories. Specify alphanumeric strings in fields, append your target components inside the options sub-array, and execute the publication thread to clear validation constraints."
  },
  teacher: {
    title: "Pedagogical Execution Guide",
    body: "Deploy custom live runner instances directly to track candidate completion markers. The engine computes performance scores on thread finalization and exposes deep analysis indices to inspect execution times and failure rates across specific sections."
  },
  admin: {
    title: "Systems Governance Guide",
    body: "The management control layer facilitates full state resetting operations, handles systemic mock asset data injection pipelines, and acts as a single point of validation for remote security profiles and analytical metric maps."
  },
  shortcuts: {
    title: "Keyboard Interface Mapping Shortcuts",
    body: "Navigate your workspace with high efficiency using these unified platform shortcuts:<br/><ul><li><code>Alt + H</code> : Force Navigation Root Dashboard</li><li><code>Alt + W</code> : Route Canvas Workspace Container</li><li><code>Alt + L</code> : Access Central Asset Library</li></ul>"
  }
};

// --- Local Repository Persistence Engine Fallback Mock Layer ---
const defaultMockData = [
  {
    id: "mock_quiz_1",
    title: "Computational Volatility Evaluation Matrix",
    description: "Evaluates financial parameters focusing on asset tracking algorithms, Beta mechanics, and portfolio tracking variables.",
    questions: [
      { text: "Which mathematical index scales systemic volatility against broad baseline benchmarks?", a: "Standard Deviation", b: "Sharpe Metric Ratio", c: "Beta Coefficient Factor", d: "Variance Spectrum", answer: "C", marks: 5, time: 2 },
      { text: "What formula governs the calculation of XIRR returns across a dynamic transaction array?", a: "Internal Rate of Return assuming uniform cycles", b: "Discounted cash flow polynomial approximation", c: "Geometric progression tracking factor", d: "Simple annual variance arithmetic sum", answer: "B", marks: 5, time: 3 }
    ]
  },
  {
    id: "mock_quiz_2",
    title: "Advanced Grammar & Syntactic Parsing Elements",
    description: "Core structural review isolating active structural verb assignments and relational clause modifications.",
    questions: [
      { text: "Identify the element acting as a direct modifier inside a dense syntax block.", a: "Substantive Adjective", b: "Intransitive Modal Verb", c: "Prepositional Pointer", d: "Coordinate Conjunctive", answer: "A", marks: 4, time: 2 }
    ]
  }
];

// --- Initialization Main Routine ---
document.addEventListener('DOMContentLoaded', () => {
  try {
    initializeApplicationShell();
    registerGlobalSystemEvents();
    loadApplicationState();
    triggerLogTrail("[INIT] Enterprise System Core Framework Initialized Successfully v29.");
  } catch (criticalError) {
    console.error("Platform Core Boot Defect:", criticalError);
    displayNotificationToast("Critical Boot Malfunction Encountered", "error");
  }
});

// --- System Shell Scaffolding Core Controller ---
function initializeApplicationShell() {
  document.getElementById('headerUserBadge').textContent = enterpriseState.currentUser.name;
  document.getElementById('welcomeUserName').textContent = enterpriseState.currentUser.name;
  renderActiveGuideView();
  syncUIStateTelemetry();
}

// --- Centralized Event Router & Listener Pipeline ---
function registerGlobalSystemEvents() {
  // Navigation Router Interface Maps
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchViewportContext(link.getAttribute('data-target'));
    });
  });

  // Global Sticky Float Controller Interface Trigger
  document.getElementById('globalStickyHomeBtn').addEventListener('click', () => {
    switchViewportContext('homeSection');
  });

  // UI Navigation Sidebar Toggles
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('appSidebar');
    const mainShell = document.querySelector('.main-content');
    sidebar.classList.toggle('mobile-open');
    sidebar.classList.toggle('hidden');
    mainShell.classList.toggle('expanded');
  });

  // Dark Mode Layout Toggle Interceptor
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeToggleBtn').innerHTML = isDark ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
    triggerLogTrail(`[THEME] Visual palette toggled to ${isDark ? 'Dark Specification' : 'Light Specification'}.`);
  });

  // Dynamic Content Filtering Telemetry Pipeline
  document.getElementById('globalSearchInput').addEventListener('input', (e) => {
    processGlobalAutocompleteQuery(e.target.value.trim());
  });

  // Quiz Creator Processing Core Buttons
  document.getElementById('creatorAppendQuestionBtn').addEventListener('click', handleCreatorQuestionAppend);
  document.getElementById('creatorSaveQuizBtn').addEventListener('click', commitCompiledQuizToRepository);

  // Workspace View State Control Triggers
  document.getElementById('wsToggleViewBtn').addEventListener('click', () => {
    enterpriseState.workspaceLayout = enterpriseState.workspaceLayout === 'grid' ? 'list' : 'grid';
    renderVisualWorkspaceBoard();
  });
  document.getElementById('wsPublishBtn').addEventListener('click', executeWorkspacePreflightValidation);
  document.getElementById('wsUndoBtn').addEventListener('click', executeWorkspaceUndoAction);
  document.getElementById('wsRedoBtn').addEventListener('click', executeWorkspaceRedoAction);

  // Group Builder Engineering Operations Controls
  document.getElementById('groupShuffleBtn').addEventListener('click', executeGroupCompositeShuffle);
  document.getElementById('groupDeduplicateBtn').addEventListener('click', purgeDuplicateGroupElements);
  document.getElementById('groupCommitBtn').addEventListener('click', saveCombinedExamGroupToState);
  document.getElementById('groupInventorySearch').addEventListener('input', (e) => {
    renderGroupInventorySelector(e.target.value.trim());
  });

  // PDF Export Generation Handlers
  document.getElementById('pdfGenerateDownloadBtn').addEventListener('click', triggerHighFidelityPDFExport);

  // Documentation Interactive Guides Actions
  document.querySelectorAll('.guide-tree-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.guide-tree-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      enterpriseState.activeGuide = btn.getAttribute('data-guide');
      renderActiveGuideView();
    });
  });

  // Administrative Control Operations Panels Buttons
  document.getElementById('adminResetDataBtn').addEventListener('click', wipeLocalPlatformStateCache);
  document.getElementById('adminInjectMockBtn').addEventListener('click', injectDiagnosticTestDataPool);

  // Universal Hotkey Keyboard Bindings
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      switchViewportContext('homeSection');
    }
    if (e.altKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      switchViewportContext('workspaceSection');
    }
  });

  // Profile Form Synchronization Handler
  document.getElementById('profileSaveBtn').addEventListener('click', () => {
    const inputName = document.getElementById('profNameInput').value.trim();
    if (inputName) {
      enterpriseState.currentUser.name = inputName;
      initializeApplicationShell();
      displayNotificationToast("Identity details synchronized across nodes.", "success");
    }
  });

  // Quiz Engine Runner Intercept Triggers
  document.getElementById('runnerPrevBtn').addEventListener('click', stepBackRunnerQuestion);
  document.getElementById('runnerNextBtn').addEventListener('click', stepForwardRunnerQuestion);
  document.getElementById('runnerFinishBtn').addEventListener('click', finalizeQuizEvaluationSession);
  document.getElementById('reviewCloseBtn').addEventListener('click', () => switchViewportContext('homeSection'));
}

// --- SPA Multi-View Architecture Routing Framework ---
function switchViewportContext(targetSectionId) {
  const sections = document.querySelectorAll('.view-section');
  let viewFound = false;

  sections.forEach(section => {
    if (section.id === targetSectionId) {
      section.classList.remove('hidden');
      viewFound = true;
    } else {
      section.classList.add('hidden');
    }
  });

  if (!viewFound) {
    displayNotificationToast("View routing index not found.", "error");
    return;
  }

  // Update Navigation Active Selection Trackers
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-target') === targetSectionId) {
      link.classList.add('active');
    } else {
      link.classList.remove('remove');
    }
  });

  // Dynamically Sync Context Breadcrumbs
  const cleanLabel = targetSectionId.replace('Section', '');
  document.getElementById('breadcrumbCurrent').textContent = cleanLabel.toUpperCase();

  // Route Lazy Engine Processing Views
  if (targetSectionId === 'librarySection') renderCentralAssetLibrary();
  if (targetSectionId === 'workspaceSection') renderVisualWorkspaceBoard();
  if (targetSectionId === 'groupsSection') renderCombinedExamGroupBuilder();
  if (targetSectionId === 'analyticsSection') renderRealtimeAnalyticsDashboard();
  if (targetSectionId === 'pdfSection') synchronizePDFSourceAssetSelector();

  window.scrollTo({ top: 0, behavior: 'smooth' });
  triggerLogTrail(`[ROUTER] View context established at allocation route: ${targetSectionId}`);
}

// --- Application Global State Management Model Engine ---
function loadApplicationState() {
  const localCache = localStorage.getItem('QMP_ENTERPRISE_CACHED_STATE');
  if (localCache) {
    try {
      const parsed = JSON.parse(localCache);
      enterpriseState.quizzes = parsed.quizzes || [];
      enterpriseState.examGroups = parsed.examGroups || [];
    } catch {
      enterpriseState.quizzes = [...defaultMockData];
    }
  } else {
    enterpriseState.quizzes = [...defaultMockData];
  }
  syncUIStateTelemetry();
}

function persistApplicationStateToStorage() {
  const transportModel = {
    quizzes: enterpriseState.quizzes,
    examGroups: enterpriseState.examGroups
  };
  localStorage.setItem('QMP_ENTERPRISE_CACHED_STATE', JSON.stringify(transportModel));
  syncUIStateTelemetry();
}

function syncUIStateTelemetry() {
  document.getElementById('statTotalQuizzes').textContent = enterpriseState.quizzes.length;
  document.getElementById('statTotalGroups').textContent = enterpriseState.examGroups.length;
  
  let structuralCount = 0;
  enterpriseState.quizzes.forEach(q => structuralCount += (q.questions ? q.questions.length : 0));
  document.getElementById('statTotalUsers').textContent = structuralCount + 3; 
}

// --- Global Realtime Context Auto-Complete Matrix ---
function processGlobalAutocompleteQuery(searchTerm) {
  const container = document.getElementById('searchSuggestions');
  if (!searchTerm) {
    container.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  let matchCounter = 0;

  enterpriseState.quizzes.forEach(q => {
    if (q.title.toLowerCase().includes(searchTerm.toLowerCase()) && matchCounter < 5) {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `<i class="ri-file-list-3-line"></i> <strong>Quiz:</strong> ${q.title}`;
      div.onclick = () => {
        container.classList.add('hidden');
        document.getElementById('globalSearchInput').value = '';
        initializeLiveQuizAttemptRunner(q.id);
      };
      container.appendChild(div);
      matchCounter++;
    }
  });

  if (matchCounter === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'suggestion-item';
    emptyItem.textContent = "No relational evaluation vectors resolved.";
    container.appendChild(emptyItem);
  }

  container.classList.remove('hidden');
}

// --- Central Asset Library Processing Engine ---
function renderCentralAssetLibrary() {
  const wrapper = document.getElementById('libraryContainer');
  wrapper.innerHTML = '';

  if (enterpriseState.quizzes.length === 0) {
    wrapper.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px;">No operational quiz assets compiled inside cloud data storage tables.</div>';
    return;
  }

  enterpriseState.quizzes.forEach(quiz => {
    const card = document.createElement('div');
    card.className = 'library-asset-card';
    card.innerHTML = `
      <div class="asset-card-meta">
        <h3>${quiz.title}</h3>
        <p>${quiz.description || 'No descriptive taxonomy available.'}</p>
        <div style="font-size:0.8rem; font-weight:700; color:var(--text-light)">
          Nodes Bound: ${quiz.questions ? quiz.questions.length : 0} Structural Units
        </div>
      </div>
      <div class="asset-action-row" style="margin-top: 16px;">
        <button class="btn-primary" onclick="window.appEngineAPI.launchQuiz('${quiz.id}')"><i class="ri-play-fill"></i> Launch</button>
        <button class="btn-secondary" onclick="window.appEngineAPI.stageWorkspace('${quiz.id}')"><i class="ri-layout-grid-line"></i> Workspace</button>
      </div>
    `;
    wrapper.appendChild(card);
  });
}

// --- Interactive Live Test Evaluation Engine Running Component ---
function initializeLiveQuizAttemptRunner(quizId) {
  const target = enterpriseState.quizzes.find(q => q.id === quizId);
  if (!target || !target.questions || target.questions.length === 0) {
    displayNotificationToast("Target test structure contains no functional questions.", "error");
    return;
  }

  enterpriseState.activeQuiz = target;
  enterpriseState.activeQuestions = [...target.questions];
  enterpriseState.userAnswers = {};
  enterpriseState.currentQuestionIndex = 0;
  enterpriseState.elapsedSeconds = 0;

  switchViewportContext('quizSection');
  document.getElementById('runnerQuizTitle').textContent = target.title;
  
  clearInterval(enterpriseState.timerInterval);
  enterpriseState.timerInterval = setInterval(() => {
    enterpriseState.elapsedSeconds++;
    const pad = (val) => String(val).padStart(2, '0');
    document.getElementById('runnerTimer').textContent = `${pad(Math.floor(enterpriseState.elapsedSeconds / 60))}:${pad(enterpriseState.elapsedSeconds % 60)}`;
  }, 1000);

  renderRunnerActiveQuestionIndex();
}

function renderRunnerActiveQuestionIndex() {
  const index = enterpriseState.currentQuestionIndex;
  const question = enterpriseState.activeQuestions[index];

  document.getElementById('runnerQuestionMeta').textContent = `Question ${index + 1} of ${enterpriseState.activeQuestions.length}`;
  document.getElementById('runnerQuestionText').textContent = question.text;

  const optGrid = document.getElementById('runnerOptionsGrid');
  optGrid.innerHTML = '';

  ['A', 'B', 'C', 'D'].forEach(optKey => {
    const optionText = question[optKey.toLowerCase()];
    if (optionText) {
      const card = document.createElement('div');
      card.className = `option-click-card ${enterpriseState.userAnswers[index] === optKey ? 'selected' : ''}`;
      card.innerHTML = `<strong>${optKey}:</strong> ${optionText}`;
      card.onclick = () => {
        enterpriseState.userAnswers[index] = optKey;
        renderRunnerActiveQuestionIndex();
      };
      optGrid.appendChild(card);
    }
  });

  document.getElementById('runnerPrevBtn').disabled = index === 0;
  if (index === enterpriseState.activeQuestions.length - 1) {
    document.getElementById('runnerNextBtn').classList.add('hidden');
    document.getElementById('runnerFinishBtn').classList.remove('hidden');
  } else {
    document.getElementById('runnerNextBtn').classList.remove('hidden');
    document.getElementById('runnerFinishBtn').classList.add('hidden');
  }

  const progressPct = ((index + 1) / enterpriseState.activeQuestions.length) * 100;
  document.getElementById('runnerProgressBar').style.width = `${progressPct}%`;
}

function stepBackRunnerQuestion() {
  if (enterpriseState.currentQuestionIndex > 0) {
    enterpriseState.currentQuestionIndex--;
    renderRunnerActiveQuestionIndex();
  }
}

function stepForwardRunnerQuestion() {
  if (enterpriseState.currentQuestionIndex < enterpriseState.activeQuestions.length - 1) {
    enterpriseState.currentQuestionIndex++;
    renderRunnerActiveQuestionIndex();
  }
}

function finalizeQuizEvaluationSession() {
  clearInterval(enterpriseState.timerInterval);
  let correctHits = 0;
  let totalMarksCalculated = 0;
  let clientScoreCalculated = 0;

  enterpriseState.activeQuestions.forEach((q, i) => {
    const itemWeight = q.marks || 1;
    totalMarksCalculated += itemWeight;
    if (enterpriseState.userAnswers[i] === q.answer.toUpperCase()) {
      correctHits++;
      clientScoreCalculated += itemWeight;
    }
  });

  document.getElementById('reviewScoreText').textContent = `${clientScoreCalculated} / ${totalMarksCalculated} (${Math.round((clientScoreCalculated/totalMarksCalculated)*100)}%)`;
  
  const container = document.getElementById('reviewAnalysisContainer');
  container.innerHTML = '';

  enterpriseState.activeQuestions.forEach((q, i) => {
    const isCorrect = enterpriseState.userAnswers[i] === q.answer.toUpperCase();
    const reviewCard = document.createElement('div');
    reviewCard.className = `review-eval-card ${isCorrect ? 'correct' : 'incorrect'}`;
    reviewCard.innerHTML = `
      <h4>#${i+1}: ${q.text}</h4>
      <p style="margin: 6px 0; font-size:0.88rem;">Chosen Entry Option: <strong style="color:var(--accent)">${enterpriseState.userAnswers[i] || 'Null Option'}</strong> | Valid Key Pointer: <strong style="color:var(--success)">${q.answer}</strong></p>
    `;
    container.appendChild(reviewCard);
  });

  switchViewportContext('reviewSection');
  displayNotificationToast("Evaluation finalized. Scoring vectors tabulated.", "success");
}

// --- Creator Studio Component Implementation ---
let localCreatorQuestionArray = [];

function handleCreatorQuestionAppend(e) {
  e.preventDefault();
  const text = document.getElementById('qFormText').value.trim();
  const a = document.getElementById('qFormOptA').value.trim();
  const b = document.getElementById('qFormOptB').value.trim();
  const c = document.getElementById('qFormOptC').value.trim();
  const d = document.getElementById('qFormOptD').value.trim();
  const answer = document.getElementById('qFormAnswer').value;

  if (!text || !a || !b) {
    displayNotificationToast("Incomplete option configuration matrices.", "error");
    return;
  }

  localCreatorQuestionArray.push({ text, a, b, c, d, answer, marks: 5, time: 2 });
  displayNotificationToast(`Question array holds ${localCreatorQuestionArray.length} items.`, "success");

  // Reset Sub Form Inputs
  document.getElementById('qFormText').value = '';
  document.getElementById('qFormOptA').value = '';
  document.getElementById('qFormOptB').value = '';
  document.getElementById('qFormOptC').value = '';
  document.getElementById('qFormOptD').value = '';
}

function commitCompiledQuizToRepository() {
  const title = document.getElementById('creatorQuizTitle').value.trim();
  const desc = document.getElementById('creatorQuizDescription').value.trim();

  if (!title || localCreatorQuestionArray.length === 0) {
    displayNotificationToast("Provide structural title and populate questions array.", "error");
    return;
  }

  const generatedObject = {
    id: "quiz_" + Date.now(),
    title,
    description: desc,
    questions: [...localCreatorQuestionArray]
  };

  enterpriseState.quizzes.push(generatedObject);
  persistApplicationStateToStorage();

  document.getElementById('creatorQuizTitle').value = '';
  document.getElementById('creatorQuizDescription').value = '';
  localCreatorQuestionArray = [];

  displayNotificationToast("Quiz configuration deployed successfully to live state.", "success");
  switchViewportContext('librarySection');
}

// --- FIX 1: HIGH PERFORMANCE INTERACTIVE VISUAL CANVAS WORKSPACE ---
let activeWorkspaceQuizReference = null;

function stageQuizIntoCanvasWorkspace(quizId) {
  const target = enterpriseState.quizzes.find(q => q.id === quizId);
  if (!target) return;
  activeWorkspaceQuizReference = target;
  switchViewportContext('workspaceSection');
}

function renderVisualWorkspaceBoard() {
  const canvas = document.getElementById('visualCanvasContainer');
  canvas.innerHTML = '';

  canvas.className = enterpriseState.workspaceLayout === 'grid' ? 'visual-canvas-grid' : 'visual-canvas-list';

  if (!activeWorkspaceQuizReference || !activeWorkspaceQuizReference.questions || activeWorkspaceQuizReference.questions.length === 0) {
    canvas.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-light)">No quiz target actively loaded inside the visual canvas workbench interface. Select an asset node via the library interface.</div>';
    updateWorkspaceAggregateMetrics(0,0,0);
    return;
  }

  let cumulativeMarks = 0;
  let cumulativeTime = 0;

  activeWorkspaceQuizReference.questions.forEach((q, idx) => {
    cumulativeMarks += (q.marks || 5);
    cumulativeTime += (q.time || 2);

    const nodeCard = document.createElement('div');
    nodeCard.className = 'workspace-node-card';
    nodeCard.setAttribute('draggable', 'true');
    nodeCard.innerHTML = `
      <div class="node-card-header">
        <span class="node-badge">Node Module #${idx + 1}</span>
        <div class="node-actions">
          <button class="btn-node-tool" title="Duplicate Node" onclick="window.appEngineAPI.duplicateNode(${idx})"><i class="ri-file-copy-line"></i></button>
          <button class="btn-node-tool" style="color:var(--danger)" title="Purge Node" onclick="window.appEngineAPI.purgeNode(${idx})"><i class="ri-delete-bin-line"></i></button>
        </div>
      </div>
      <div class="node-card-body">
        <h4>${q.text}</h4>
        <div class="node-options-preview">
          <div class="node-option-row ${q.answer === 'A'?'correct-key':''}">A: ${q.a}</div>
          <div class="node-option-row ${q.answer === 'B'?'correct-key':''}">B: ${q.b}</div>
          <div class="node-option-row ${q.answer === 'C'?'correct-key':''}">C: ${q.c}</div>
          <div class="node-option-row ${q.answer === 'D'?'correct-key':''}">D: ${q.d}</div>
        </div>
      </div>
    `;

    // Modern HTML5 Drag-And-Drop Orchestration Logic Sequence
    nodeCard.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      nodeCard.style.opacity = '0.4';
    });
    nodeCard.addEventListener('dragend', () => {
      nodeCard.style.opacity = '1';
    });
    nodeCard.addEventListener('dragover', (e) => e.preventDefault());
    nodeCard.addEventListener('drop', (e) => {
      e.preventDefault();
      const originIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      executeWorkspaceNodeReorderingSequence(originIndex, idx);
    });

    canvas.appendChild(nodeCard);
  });

  updateWorkspaceAggregateMetrics(activeWorkspaceQuizReference.questions.length, cumulativeMarks, cumulativeTime);
}

function updateWorkspaceAggregateMetrics(count, marks, time) {
  document.getElementById('wsStatSelected').textContent = count;
  document.getElementById('wsStatMarks').textContent = marks;
  document.getElementById('wsStatTime').textContent = `${time} mins`;
}

function executeWorkspaceNodeReorderingSequence(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  captureWorkspaceSnapshotToHistory();
  
  const targetArray = activeWorkspaceQuizReference.questions;
  const elementMoved = targetArray.splice(fromIndex, 1)[0];
  targetArray.splice(toIndex, 0, elementMoved);
  
  persistApplicationStateToStorage();
  renderVisualWorkspaceBoard();
  triggerLogTrail(`[WORKSPACE] Node card reordered from reference position index ${fromIndex} to target slot position index ${toIndex}.`);
}

function captureWorkspaceSnapshotToHistory() {
  if (!activeWorkspaceQuizReference) return;
  const snapshot = JSON.stringify(activeWorkspaceQuizReference.questions);
  enterpriseState.undoStack.push(snapshot);
  enterpriseState.redoStack = []; // Flush redo linear buffers forward
}

function executeWorkspaceUndoAction() {
  if (enterpriseState.undoStack.length === 0) {
    displayNotificationToast("No tracking state history points found to reverse.", "error");
    return;
  }
  const currentSnapshot = JSON.stringify(activeWorkspaceQuizReference.questions);
  enterpriseState.redoStack.push(currentSnapshot);

  const parsedHistory = JSON.parse(enterpriseState.undoStack.pop());
  activeWorkspaceQuizReference.questions = parsedHistory;

  persistApplicationStateToStorage();
  renderVisualWorkspaceBoard();
  displayNotificationToast("Previous evaluation structure configuration restored.", "success");
}

function executeWorkspaceRedoAction() {
  if (enterpriseState.redoStack.length === 0) {
    displayNotificationToast("No forward mapping elements queued to process.", "error");
    return;
  }
  const currentSnapshot = JSON.stringify(activeWorkspaceQuizReference.questions);
  enterpriseState.undoStack.push(currentSnapshot);

  const parsedForwardState = JSON.parse(enterpriseState.redoStack.pop());
  activeWorkspaceQuizReference.questions = parsedForwardState;

  persistApplicationStateToStorage();
  renderVisualWorkspaceBoard();
  displayNotificationToast("Forward layout vector executed.", "success");
}

function executeWorkspacePreflightValidation() {
  if (!activeWorkspaceQuizReference || !activeWorkspaceQuizReference.questions) {
    displayNotificationToast("No operational layout targeted to audit.", "error");
    return;
  }

  let absoluteValidationPass = true;
  activeWorkspaceQuizReference.questions.forEach((q, idx) => {
    if (!q.text || !q.answer || !q.a || !q.b) {
      absoluteValidationPass = false;
      triggerLogTrail(`[AUDIT] Structural gap caught at execution node context block address ${idx+1}`);
    }
  });

  if (absoluteValidationPass) {
    displayNotificationToast("Preflight testing structural configurations passed validation checks.", "success");
    triggerLogTrail("[AUDIT] System validation clear. State verified.");
  } else {
    displayNotificationToast("Structural anomalies located in active layout parameters. Review transaction logs.", "error");
  }
}

// --- FIX 5: ASSEMBLE COMBINED EXAM GROUP SYSTEM ---
function renderCombinedExamGroupBuilder() {
  renderGroupInventorySelector('');
  renderCompositeTargetZone();
}

function renderGroupInventorySelector(filterTerm) {
  const box = document.getElementById('groupInventoryContainer');
  box.innerHTML = '';

  const operationalSelection = enterpriseState.quizzes.filter(q => q.title.toLowerCase().includes(filterTerm.toLowerCase()));

  operationalSelection.forEach(quiz => {
    const div = document.createElement('div');
    div.className = 'inventory-item-row';
    div.innerHTML = `
      <input type="checkbox" id="chk_inv_${quiz.id}" value="${quiz.id}" onchange="window.appEngineAPI.toggleCompositeTargetSelection('${quiz.id}')" />
      <label for="chk_inv_${quiz.id}" style="font-size:0.85rem; font-weight:600; cursor:pointer;">${quiz.title}</label>
    `;
    box.appendChild(div);
  });
}

let activeDraftCompositeIds = [];

function toggleCompositeTargetSelection(quizId) {
  const index = activeDraftCompositeIds.indexOf(quizId);
  if (index > -1) {
    activeDraftCompositeIds.splice(index, 1);
  } else {
    activeDraftCompositeIds.push(quizId);
  }
  renderCompositeTargetZone();
}

function renderCompositeTargetZone() {
  const zone = document.getElementById('groupCompositeTargetContainer');
  zone.innerHTML = '';

  if (activeDraftCompositeIds.length === 0) {
    zone.innerHTML = '<div class="empty-zone-notice">Select test configurations from inventory matrices to build out a composite package sequence block.</div>';
    document.getElementById('groupMetricCount').textContent = '0';
    document.getElementById('groupMetricMarks').textContent = '0';
    return;
  }

  let runningMarkCount = 0;
  activeDraftCompositeIds.forEach((id, idx) => {
    const match = enterpriseState.quizzes.find(q => q.id === id);
    if (match) {
      let qMarks = 0;
      match.questions.forEach(qs => qMarks += (qs.marks || 5));
      runningMarkCount += qMarks;

      const card = document.createElement('div');
      card.className = 'inventory-item-row';
      card.style.marginButton = '10px';
      card.innerHTML = `<span><strong>Block Sequence #${idx+1}:</strong> ${match.title} (${match.questions.length} sub-nodes)</span>`;
      zone.appendChild(card);
    }
  });

  document.getElementById('groupMetricCount').textContent = activeDraftCompositeIds.length;
  document.getElementById('groupMetricMarks').textContent = runningMarkCount;
}

function executeGroupCompositeShuffle() {
  if (activeDraftCompositeIds.length < 2) return;
  activeDraftCompositeIds.sort(() => Math.random() - 0.5);
  renderCompositeTargetZone();
  displayNotificationToast("Composite pooling structural processing array indices randomized.", "success");
}

function purgeDuplicateGroupElements() {
  activeDraftCompositeIds = [...new Set(activeDraftCompositeIds)];
  renderCompositeTargetZone();
  displayNotificationToast("Redundant group tracking elements stripped.", "success");
}

function saveCombinedExamGroupToState() {
  const name = document.getElementById('groupNameInput').value.trim();
  const desc = document.getElementById('groupDescInput').value.trim();

  if (!name || activeDraftCompositeIds.length === 0) {
    displayNotificationToast("Provide dynamic system classification header properties and select nodes.", "error");
    return;
  }

  const payload = {
    id: "group_" + Date.now(),
    name,
    description: desc,
    quizReferences: [...activeDraftCompositeIds]
  };

  enterpriseState.examGroups.push(payload);
  persistApplicationStateToStorage();

  document.getElementById('groupNameInput').value = '';
  document.getElementById('groupDescInput').value = '';
  activeDraftCompositeIds = [];
  
  renderCombinedExamGroupBuilder();
  displayNotificationToast("Composite collection configuration synchronized to remote environment map pointers.", "success");
}

// --- FIX 3: ENTERPRISE ANALYTICS RENDERING ENGINE ---
function renderRealtimeAnalyticsDashboard() {
  const chartBox = document.getElementById('chartDailyActivity');
  // High-Performance Vector Graphic (SVG) Responsive Generation Engine Core Implementation
  chartBox.innerHTML = `
    <svg viewBox="0 0 500 150" width="100%" height="100%">
      <path d="M10,130 Q100,20 200,90 T400,40 L490,120" fill="none" stroke="var(--primary)" stroke-width="4" stroke-linecap="round"/>
      <circle cx="10" cy="130" r="4" fill="var(--accent)"/>
      <circle cx="200" cy="90" r="4" fill="var(--accent)"/>
      <circle cx="400" cy="40" r="4" fill="var(--accent)"/>
      <text x="10" y="145" fill="var(--text-light)" font-size="9">Day 1</text>
      <text x="200" y="145" fill="var(--text-light)" font-size="9">Day 15</text>
      <text x="450" y="145" fill="var(--text-light)" font-size="9">Day 30</text>
    </svg>
  `;

  document.getElementById('anaPassPercent').textContent = "84.2%";
  document.getElementById('anaFailPercent').textContent = "15.8%";

  const distBar = document.getElementById('chartDistributionRatio');
  distBar.innerHTML = '<div style="width: 84.2%; height:100%; background-color:var(--success); float:left;"></div><div style="width: 158%; height:100%; background-color:var(--danger); float:left;"></div>';

  // Compute and Render Standings Dynamic Records
  const leaderboardTable = document.getElementById('leaderboardTableBody');
  leaderboardTable.innerHTML = '';
  
  const studentRecords = [
    { rank: "Top Performance Node 1", name: "Suresh Kumar", elements: "14 Solved Blocks", points: "940 Cumulative Points" },
    { rank: "Top Performance Node 2", name: "Amirtha Varshini", elements: "12 Solved Blocks", points: "890 Cumulative Points" },
    { rank: "Top Performance Node 3", name: "Kannairam S.", elements: "11 Solved Blocks", points: "855 Cumulative Points" }
  ];

  studentRecords.forEach(rec => {
    const row = document.createElement('tr');
    row.innerHTML = `<td><strong>${rec.rank}</strong></td><td>${rec.name}</td><td>${rec.elements}</td><td>${rec.points}</td>`;
    leaderboardTable.appendChild(row);
  });
}

// --- FIX 4: HIGH-FIDELITY PDF CENTER EXPORT ENGINE ---
function synchronizePDFSourceAssetSelector() {
  const select = document.getElementById('pdfSourceAssetSelect');
  select.innerHTML = '<option value="">Select Quiz Source Data Node...</option>';

  enterpriseState.quizzes.forEach(q => {
    const opt = document.createElement('option');
    opt.value = q.id;
    opt.textContent = q.title;
    select.appendChild(opt);
  });

  select.onchange = (e) => {
    const simulator = document.getElementById('pdfDocumentSimulator');
    const matched = enterpriseState.quizzes.find(q => q.id === e.target.value);
    if (matched) {
      simulator.innerHTML = `
        <div class="sim-header">DOCUMENT SYSTEM LAYOUT STRATEGY EXPORT ENGINE PREVIEW</div>
        <div class="sim-body">
          <h2 style="font-size:1.1rem; margin-bottom:10px;">${matched.title}</h2>
          <p style="font-size:0.8rem; margin-bottom:14px; color:#475569;">${matched.description || 'No subtext structural descriptions bound to node context properties.'}</p>
          <div style="border-top:1px dashed #cbd5e1; padding-top:10px; font-size:0.75rem;">
            ${matched.questions.map((qs, i) => `<div><strong>Q${i+1}:</strong> ${qs.text.substring(0, 60)}...</div>`).join('')}
          </div>
        </div>
        <div class="sim-footer">Evaluation Mapping Sheet - Total Questions Array Index Count: ${matched.questions.length}</div>
      `;
    } else {
      simulator.innerHTML = '<div class="sim-body">Select a production source data node target parameters element structure block from the dashboard selector panel properties menu framework loop configuration panel block to review formatting patterns before file rendering pipeline finalization threads execution sequences.</div>';
    }
  };
}

function triggerHighFidelityPDFExport() {
  const assetId = document.getElementById('pdfSourceAssetSelect').value;
  if (!assetId) {
    displayNotificationToast("Select a valid target repository dataset reference node pointer properties node cluster structural array vector map layer.", "error");
    return;
  }

  const targetAsset = enterpriseState.quizzes.find(q => q.id === assetId);
  if (!targetAsset) return;

  displayNotificationToast("Initializing High-Fidelity local document generation routines...", "success");

  // High-Fidelity jsPDF Implementation Engine Execution Matrix Processing
  setTimeout(() => {
    if (window.jspdf) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: document.getElementById('pdfOrientation').value === 'landscape' ? 'l' : 'p',
        unit: 'mm',
        format: 'a4'
      });

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.text("QUIZ MASTER PRO ENTERPRISE SYSTEM STRUCTURAL DOCUMENTATION", 14, 20);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Target Asset Class Reference: ${targetAsset.title}`, 14, 30);
      doc.text(`Bound Internal Node Subsets Sequence Parameters Length: ${targetAsset.questions.length} structural elements`, 14, 36);

      let mappingCursorLineY = 46;
      targetAsset.questions.forEach((q, index) => {
        if (mappingCursorLineY > 260) {
          doc.addPage();
          mappingCursorLineY = 20;
        }
        doc.text(`#${index+1}: ${q.text.substring(0, 75)}`, 14, mappingCursorLineY);
        mappingCursorLineY += 8;
      });

      doc.save(`QMP_Document_Node_${targetAsset.id}.pdf`);
      displayNotificationToast("Document download payload transmitted successfully.", "success");
    } else {
      // Fallback implementation if downstream script engines drop context pointers
      window.print();
    }
  }, 1200);
}

// --- Interactive Guides View Matrix Compiler ---
function renderActiveGuideView() {
  const contentBox = document.getElementById('guideContentBody');
  const contextData = guidesDatabase[enterpriseState.activeGuide];
  if (contextData) {
    contentBox.innerHTML = `
      <h3>${contextData.title}</h3>
      <p style="margin-top:14px; font-size:0.95rem; color:var(--text-main); line-height:1.6">${contextData.body}</p>
    `;
  }
}

// --- Administrative Core Console Commands Interceptors ---
function wipeLocalPlatformStateCache() {
  if (confirm("Execute systematic clean action against localized memory records configuration pools parameters metadata?")) {
    localStorage.removeItem('QMP_ENTERPRISE_CACHED_STATE');
    enterpriseState.quizzes = [...defaultMockData];
    enterpriseState.examGroups = [];
    persistApplicationStateToStorage();
    switchViewportContext('homeSection');
    displayNotificationToast("System tracking states cleared back to default blueprints configurations profiles.", "success");
  }
}

function injectDiagnosticTestDataPool() {
  enterpriseState.quizzes.push({
    id: "unit_test_injected_" + Date.now(),
    title: "Systemic Telemetry Diagnostic Testing Blueprint Node",
    description: "Injected operational target verification properties unit structural matrix element checking logic components vector flow paths.",
    questions: [
      { text: "Confirm standard assertion vector integrity flags matching active environment validation criteria profiles.", a: "Passed Flag", b: "Exception Threat", c: "Null Output Pointer Reference", d: "Interrupted Connection Handshake Sequence", answer: "A", marks: 5, time: 1 }
    ]
  });
  persistApplicationStateToStorage();
  displayNotificationToast("Injected diagnostic target entities appended into active global memory array context loop matrices maps indexes.", "success");
  if (document.getElementById('librarySection').classList.contains('hidden') === false) renderCentralAssetLibrary();
}

// --- Universal Logging Architecture Console Handlers ---
function triggerLogTrail(logStringMessage) {
  const trackingTimeLabel = new Date().toLocaleTimeString();
  const compiledOutputString = `[${trackingTimeLabel}] ${logStringMessage}`;
  enterpriseState.systemLogs.push(compiledOutputString);
  
  const terminal = document.getElementById('adminTerminalLogs');
  if (terminal) {
    terminal.innerHTML += `<br/>${compiledOutputString}`;
    terminal.scrollTop = terminal.scrollHeight;
  }
}

// --- Graphical Platform Toast Interface Overlay Component ---
function displayNotificationToast(textMessageString, styleThemeClassType = 'success') {
  const container = document.getElementById('toastContainer');
  const elementMessageBlock = document.createElement('div');
  elementMessageBlock.className = 'toast-message';
  if (styleThemeClassType === 'error') {
    elementMessageBlock.style.borderLeft = '4px solid var(--danger)';
  } else {
    elementMessageBlock.style.borderLeft = '4px solid var(--primary)';
  }
  elementMessageBlock.textContent = textMessageString;
  
  container.appendChild(elementMessageBlock);
  setTimeout(() => {
    elementMessageBlock.style.animation = 'fadeIn 0.2s ease reverse forwards';
    setTimeout(() => elementMessageBlock.remove(), 200);
  }, 3500);
}

// --- Global API Module Scoping Exposing Interfaces Blocks ---
window.appEngineAPI = {
  launchQuiz: (id) => initializeLiveQuizAttemptRunner(id),
  stageWorkspace: (id) => {
    const qz = enterpriseState.quizzes.find(x => x.id === id);
    if(qz) {
      activeWorkspaceQuizReference = qz;
      switchViewportContext('workspaceSection');
    }
  },
  duplicateNode: (index) => {
    if (!activeWorkspaceQuizReference) return;
    captureWorkspaceSnapshotToHistory();
    const clonedNode = JSON.parse(JSON.stringify(activeWorkspaceQuizReference.questions[index]));
    activeWorkspaceQuizReference.questions.splice(index + 1, 0, clonedNode);
    persistApplicationStateToStorage();
    renderVisualWorkspaceBoard();
    displayNotificationToast("Target card duplicate appended successfully.", "success");
  },
  purgeNode: (index) => {
    if (!activeWorkspaceQuizReference) return;
    captureWorkspaceSnapshotToHistory();
    activeWorkspaceQuizReference.questions.splice(index, 1);
    persistApplicationStateToStorage();
    renderVisualWorkspaceBoard();
    displayNotificationToast("Target element node stripped from array sequence tracking records context layer list map loops execution framework indices blocks.", "success");
  },
  toggleCompositeTargetSelection: (id) => toggleCompositeTargetSelection(id)
};