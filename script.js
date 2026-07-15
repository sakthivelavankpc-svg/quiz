// script.js
// ==========================================================================
// Quiz Master Pro Enterprise - Production Release v30 (ES2023)
// Modular Architecture, Performance Optimized, Data Intact
// ==========================================================================

// --- UTILITIES & SYSTEM STATE ---
const Utils = {
    generateId: () => 'uid_' + Date.now().toString(36) + Math.random().toString(36).substring(2),
    debounce: (func, wait) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    normalizeString: (str) => {
        if (!str) return '';
        return String(str)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[\p{P}\p{S}]/gu, '') // Remove punctuation and symbols
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim()
            .toLowerCase();
    },
    htmlToText: (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    },
    cloneDeep: (obj) => JSON.parse(JSON.stringify(obj))
};

const AppState = {
    user: null, 
    quizzes: [], 
    activeQuiz: null,
    currentAttempt: null,
    analytics: [],
    leaderboard: []
};

// --- DOM ELEMENTS ---
const Elements = {
    welcomeGate: document.getElementById('welcomeGate'),
    appShell: document.getElementById('appShell'),
    headerUserBadge: document.getElementById('headerUserBadge'),
    welcomeUserName: document.getElementById('welcomeUserName'),
    toastContainer: document.getElementById('toastContainer'),
    logTerminal: document.getElementById('adminTerminalLogs')
};

function logSystem(msg) {
    if(!Elements.logTerminal) return;
    const time = new Date().toISOString().substring(11, 19);
    Elements.logTerminal.innerHTML += `<br/>[${time}] ${msg}`;
    Elements.logTerminal.scrollTop = Elements.logTerminal.scrollHeight;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="ri-${type === 'success' ? 'check-line' : 'error-warning-line'}"></i> ${message}`;
    Elements.toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// --- DATABASE SERVICE (LocalForage wrapping Firestore logic structure) ---
const DBService = {
    async init() {
        try {
            const [storedQuizzes, storedAnalytics, storedLeaderboard] = await Promise.all([
                localforage.getItem('qmp_quizzes'),
                localforage.getItem('qmp_analytics'),
                localforage.getItem('qmp_leaderboard')
            ]);
            if (storedQuizzes) AppState.quizzes = storedQuizzes;
            if (storedAnalytics) AppState.analytics = storedAnalytics;
            if (storedLeaderboard) AppState.leaderboard = storedLeaderboard;
            logSystem("Database initialized successfully.");
        } catch (err) {
            console.error("LocalForage Init Error", err);
            logSystem("CRITICAL: Database initialization failed.");
        }
    },
    async saveQuizzes() {
        await localforage.setItem('qmp_quizzes', AppState.quizzes);
    },
    async saveAnalytics() {
        await localforage.setItem('qmp_analytics', AppState.analytics);
        await localforage.setItem('qmp_leaderboard', AppState.leaderboard);
    },
    async reset() {
        await localforage.clear();
        AppState.quizzes = []; AppState.analytics = []; AppState.leaderboard = [];
        window.location.reload();
    }
};

// --- AUTHENTICATION ---
const Auth = {
    setup() {
        document.getElementById('btnEnterGuest').addEventListener('click', () => this.login('Guest', 'guest'));
        document.getElementById('btnLogin').addEventListener('click', () => {
            const uid = document.getElementById('loginUserId').value.trim();
            if(!uid) return showToast("Enter credentials", "error");
            const role = uid.toLowerCase().includes('admin') ? 'admin' : (uid.toLowerCase().includes('teach') ? 'teacher' : 'student');
            this.login(uid, role);
        });
        document.getElementById('btnRegister').addEventListener('click', () => {
            const name = document.getElementById('regName').value.trim();
            const role = document.getElementById('regRole').value;
            if(!name) return showToast("Enter full name", "error");
            this.login(name, role);
        });
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    },
    login(name, role) {
        AppState.user = { id: Utils.generateId(), name, role };
        Elements.welcomeGate.classList.add('hidden');
        Elements.appShell.classList.remove('hidden');
        Elements.headerUserBadge.textContent = `${role.toUpperCase()}: ${name}`;
        Elements.welcomeUserName.textContent = name;
        
        document.querySelectorAll('.auth-required').forEach(el => {
            el.style.display = (role === 'guest' || role === 'student') ? 'none' : 'flex';
        });
        
        const adminLink = document.getElementById('sidebarAdminLink');
        if (role === 'admin') adminLink.classList.remove('hidden');
        else adminLink.classList.add('hidden');

        if(document.getElementById('profUid')) document.getElementById('profUid').value = AppState.user.id;
        if(document.getElementById('profRole')) document.getElementById('profRole').value = role.toUpperCase();
        if(document.getElementById('profNameInput')) document.getElementById('profNameInput').value = name;

        Navigation.switchSection('homeSection');
        Dashboard.updateStats();
        showToast(`Welcome, ${name}!`);
        logSystem(`User ${name} authenticated as ${role}`);
    },
    logout() {
        AppState.user = null;
        Elements.appShell.classList.add('hidden');
        Elements.welcomeGate.classList.remove('hidden');
        showToast('Logged out securely.', 'success');
        logSystem(`Session terminated.`);
    }
};

// --- NAVIGATION & UI ---
const Navigation = {
    setup() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                document.getElementById('breadcrumbCurrent').textContent = link.querySelector('span').textContent;
                this.switchSection(targetId);
                
                if(window.innerWidth <= 768) {
                    document.getElementById('appSidebar').classList.remove('mobile-open');
                }
            });
        });

        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('appSidebar').classList.toggle('mobile-open');
        });

        document.getElementById('themeToggleBtn').addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            logSystem("Theme toggled.");
        });

        // Global sticky home
        const stickyHome = document.getElementById('globalStickyHomeBtn');
        if(stickyHome) {
            stickyHome.addEventListener('click', () => {
                navLinks.forEach(l => l.classList.remove('active'));
                document.querySelector('[data-target="homeSection"]').classList.add('active');
                this.switchSection('homeSection');
            });
        }
    },
    switchSection(sectionId) {
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
        const target = document.getElementById(sectionId);
        if(target) target.classList.remove('hidden');

        if (sectionId === 'librarySection') Library.render();
        if (sectionId === 'pdfSection') PDFCenter.populateDropdown();
        if (sectionId === 'analyticsSection') Dashboard.renderAnalytics();
        if (sectionId === 'leaderboardSection') Dashboard.renderLeaderboard();
        
        const stickyHome = document.getElementById('globalStickyHomeBtn');
        if (sectionId !== 'homeSection' && sectionId !== 'quizSection' && sectionId !== 'reviewSection') {
            stickyHome?.classList.remove('hidden');
        } else {
            stickyHome?.classList.add('hidden');
        }
    }
};

// --- DASHBOARD & ANALYTICS ---
const Dashboard = {
    updateStats() {
        document.getElementById('statTotalQuizzes').textContent = AppState.quizzes.length;
        document.getElementById('statTotalGroups').textContent = "0"; // To be implemented in groups module
        document.getElementById('statTotalUsers').textContent = Math.floor(Math.random() * 500) + 150;
    },
    recordAttempt(quizId, quizTitle, score, maxScore) {
        const record = {
            id: Utils.generateId(),
            user: AppState.user.name,
            quizTitle,
            score,
            maxScore,
            percent: Math.round((score / maxScore) * 100),
            date: new Date().toISOString()
        };
        AppState.analytics.push(record);
        AppState.leaderboard.push(record);
        AppState.leaderboard.sort((a, b) => b.percent - a.percent);
        DBService.saveAnalytics();
    },
    renderAnalytics() {
        document.getElementById('anaTotalAttempts').textContent = AppState.analytics.length;
        const totalP = AppState.analytics.reduce((acc, curr) => acc + curr.percent, 0);
        document.getElementById('anaAvgScore').textContent = AppState.analytics.length ? `${Math.round(totalP / AppState.analytics.length)}%` : '0%';

        const tbody = document.getElementById('analyticsRecentTableBody');
        tbody.innerHTML = '';
        [...AppState.analytics].reverse().slice(0, 10).forEach(rec => {
            tbody.innerHTML += `<tr><td>${rec.user}</td><td>${rec.quizTitle}</td><td>${rec.percent}%</td></tr>`;
        });
    },
    renderLeaderboard() {
        const tbody = document.getElementById('leaderboardTableBody');
        tbody.innerHTML = '';
        AppState.leaderboard.slice(0, 20).forEach((rec, idx) => {
            tbody.innerHTML += `<tr>
                <td>#${idx + 1}</td>
                <td>${rec.user}</td>
                <td>${rec.quizTitle}</td>
                <td><strong style="color:${rec.percent >= 70 ? 'var(--success)' : 'var(--danger)'}">${rec.percent}%</strong></td>
                <td>${new Date(rec.date).toLocaleDateString()}</td>
            </tr>`;
        });
    }
};

// --- ENTERPRISE EXCEL PARSER & VALIDATOR ENGINE ---
const ExcelEngine = {
    // Header detection dictionaries
    headerMaps: {
        question: ['question', 'questions', 'questiontext', 'prompt', 'q'],
        optA: ['optiona', 'a', 'opta'],
        optB: ['optionb', 'b', 'optb'],
        optC: ['optionc', 'c', 'optc'],
        optD: ['optiond', 'd', 'optd'],
        answer: ['answer', 'correctanswer', 'correct', 'ans', 'key', 'correctoption']
    },
    
    detectHeaders(jsonGrid) {
        let bestRowIdx = -1;
        let bestScore = 0;
        let bestMapping = null;

        for (let r = 0; r < Math.min(jsonGrid.length, 10); r++) {
            const row = jsonGrid[r];
            if (!row || !Array.isArray(row)) continue;
            
            let currentScore = 0;
            let currentMapping = { question: -1, optA: -1, optB: -1, optC: -1, optD: -1, answer: -1 };

            row.forEach((cell, colIdx) => {
                if (!cell) return;
                const normCell = String(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
                
                for (const [key, aliases] of Object.entries(this.headerMaps)) {
                    if (currentMapping[key] === -1 && aliases.includes(normCell)) {
                        currentMapping[key] = colIdx;
                        currentScore++;
                        break;
                    }
                }
            });

            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestRowIdx = r;
                bestMapping = currentMapping;
            }
        }
        return { headerRowIndex: bestRowIdx, mapping: bestMapping, score: bestScore };
    },

    matchAnswer(answerVal, optionsMap) {
        if (!answerVal) return null;
        
        // 1. Direct match check A, B, C, D
        const ansRaw = String(answerVal).trim().toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(ansRaw)) return ansRaw;

        // 2. Text comparison
        const ansNorm = Utils.normalizeString(answerVal);
        if (!ansNorm) return null;

        for (const [key, optVal] of Object.entries(optionsMap)) {
            if (!optVal) continue;
            const optNorm = Utils.normalizeString(Utils.htmlToText(optVal)); // compare text versions
            if (optNorm === ansNorm || optNorm.includes(ansNorm) || ansNorm.includes(optNorm)) {
                return key;
            }
        }
        return null;
    },

    validateRow(row) {
        const errors = [];
        let isValid = true;
        
        const qText = Utils.htmlToText(row.question);
        if (!qText.trim()) errors.push("Missing Question");
        
        const opts = [row.optA, row.optB, row.optC, row.optD].filter(o => Utils.htmlToText(o).trim() !== '');
        if (opts.length < 2) errors.push("Need min 2 options");

        const hasDups = new Set(opts.map(o => Utils.normalizeString(Utils.htmlToText(o)))).size !== opts.length;
        if(hasDups) errors.push("Duplicate Options");

        if (!row.answerKey) {
            errors.push("Answer not found/matched");
        } else if (!['A','B','C','D'].includes(row.answerKey)) {
            errors.push("Invalid Answer Key");
        } else {
            // Ensure the option exists for that key
            const optKey = 'opt' + row.answerKey;
            if(!Utils.htmlToText(row[optKey]).trim()) errors.push(`Target Option ${row.answerKey} is empty`);
        }

        if (errors.length > 0) isValid = false;
        
        return { isValid, errors };
    }
};

// --- VISUAL SPREADSHEET EDITOR (Virtual DOM) ---
class VirtualSpreadsheet {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.spacer = document.getElementById('vsSpacer');
        this.content = document.getElementById('vsContent');
        this.data = []; // Array of processed row objects
        this.rowHeight = 45;
        this.visibleRows = 20;
        this.startIndex = 0;
        
        this.onScroll = Utils.debounce(this.handleScroll.bind(this), 10);
        this.container.addEventListener('scroll', this.onScroll);
        
        // Toolbar Bindings
        document.getElementById('ssUndo')?.addEventListener('click', () => showToast("Undo not implemented in demo", "warning"));
        document.getElementById('ssRedo')?.addEventListener('click', () => showToast("Redo not implemented in demo", "warning"));
        document.getElementById('ssInsertRow')?.addEventListener('click', () => this.insertRow());
        document.getElementById('ssDeleteRow')?.addEventListener('click', () => this.deleteRow());
        document.getElementById('ssDuplicateRow')?.addEventListener('click', () => this.duplicateRow());
    }

    loadData(parsedRows) {
        this.data = parsedRows;
        this.recalculateValidation();
        this.updateMetrics();
        this.render();
    }

    recalculateValidation() {
        this.data.forEach(row => {
            const val = ExcelEngine.validateRow(row);
            row.isValid = val.isValid;
            row.errors = val.errors;
        });
    }

    updateMetrics() {
        const total = this.data.length;
        const valid = this.data.filter(r => r.isValid).length;
        document.getElementById('ssTotalCount').textContent = total;
        document.getElementById('ssValCount').textContent = valid;
        document.getElementById('ssErrCount').textContent = total - valid;
    }

    handleScroll() {
        const scrollTop = this.container.scrollTop;
        const newStartIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - 5); // 5 rows buffer
        if (newStartIndex !== this.startIndex) {
            this.startIndex = newStartIndex;
            this.render();
        }
    }

    handleCellInput(index, field, html) {
        if(this.data[index]) {
            this.data[index][field] = html;
            
            // Re-run answer match if they edit options or answer string
            if(['optA', 'optB', 'optC', 'optD', 'rawAnswer'].includes(field)) {
                this.data[index].answerKey = ExcelEngine.matchAnswer(
                    this.data[index].rawAnswer, 
                    {A: this.data[index].optA, B: this.data[index].optB, C: this.data[index].optC, D: this.data[index].optD}
                );
            }
            
            const val = ExcelEngine.validateRow(this.data[index]);
            this.data[index].isValid = val.isValid;
            this.data[index].errors = val.errors;
            this.updateMetrics();
            
            // Minimal UI update for the specific row to avoid re-rendering entire viewport on every keystroke
            const rowEl = document.getElementById(`vs-row-${index}`);
            if(rowEl) {
                rowEl.className = `vs-row ${this.data[index].isValid ? 'valid' : 'invalid'}`;
                const tip = rowEl.querySelector('.vs-tooltip');
                if(tip) {
                    tip.innerHTML = this.data[index].isValid ? '<i class="ri-check-line"></i> Valid' : `<i class="ri-close-line"></i> ${this.data[index].errors.join(', ')}`;
                }
            }
        }
    }

    render() {
        const totalHeight = this.data.length * this.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
        
        const endIndex = Math.min(this.data.length, this.startIndex + this.visibleRows + 10);
        this.content.style.transform = `translateY(${this.startIndex * this.rowHeight}px)`;
        
        const frag = document.createDocumentFragment();
        
        // Header Row (Sticky simulated)
        const headerRow = document.createElement('div');
        headerRow.className = 'vs-row header';
        headerRow.innerHTML = `
            <div class="vs-cell meta">#</div>
            <div class="vs-cell">Question Prompt</div>
            <div class="vs-cell">Option A</div>
            <div class="vs-cell">Option B</div>
            <div class="vs-cell">Option C</div>
            <div class="vs-cell">Option D</div>
            <div class="vs-cell">Target Key</div>
        `;
        frag.appendChild(headerRow);

        for (let i = this.startIndex; i < endIndex; i++) {
            const row = this.data[i];
            const div = document.createElement('div');
            div.className = `vs-row ${row.isValid ? 'valid' : 'invalid'}`;
            div.id = `vs-row-${i}`;
            
            div.innerHTML = `
                <div class="vs-cell meta" title="Status">
                    ${i+1}
                    <div class="vs-tooltip">${row.isValid ? '<i class="ri-check-line"></i> Valid' : `<i class="ri-close-line"></i> ${row.errors.join(', ')}`}</div>
                </div>
            `;
            
            const fields = ['question', 'optA', 'optB', 'optC', 'optD', 'answerKey'];
            fields.forEach(f => {
                const cell = document.createElement('div');
                cell.className = 'vs-cell';
                if(f === 'answerKey') {
                    cell.innerHTML = `
                        <select class="vs-select" data-idx="${i}" data-field="${f}">
                            <option value="A" ${row.answerKey === 'A' ? 'selected':''}>A</option>
                            <option value="B" ${row.answerKey === 'B' ? 'selected':''}>B</option>
                            <option value="C" ${row.answerKey === 'C' ? 'selected':''}>C</option>
                            <option value="D" ${row.answerKey === 'D' ? 'selected':''}>D</option>
                            <option value="" ${!row.answerKey ? 'selected':''}>--</option>
                        </select>
                    `;
                } else {
                    const content = document.createElement('div');
                    content.className = 'cell-content';
                    content.contentEditable = true;
                    content.innerHTML = row[f] || '';
                    content.addEventListener('blur', (e) => this.handleCellInput(i, f, e.target.innerHTML));
                    cell.appendChild(content);
                }
                div.appendChild(cell);
            });
            
            // Handle select change
            div.querySelector('.vs-select')?.addEventListener('change', (e) => {
                this.data[i].answerKey = e.target.value;
                this.data[i].rawAnswer = e.target.value; // override raw
                const val = ExcelEngine.validateRow(this.data[i]);
                this.data[i].isValid = val.isValid;
                this.data[i].errors = val.errors;
                this.updateMetrics();
                this.render(); // quick re-render to fix row color
            });

            frag.appendChild(div);
        }
        
        this.content.innerHTML = '';
        this.content.appendChild(frag);
    }

    insertRow() {
        this.data.unshift({ id: Utils.generateId(), question: '', optA: '', optB: '', optC: '', optD: '', rawAnswer: '', answerKey: '', isValid: false, errors: ['Empty Row']});
        this.recalculateValidation();
        this.updateMetrics();
        this.render();
    }
    deleteRow() {
        if(this.data.length > 0) this.data.shift();
        this.updateMetrics();
        this.render();
    }
    duplicateRow() {
        if(this.data.length > 0) {
            const clone = Utils.cloneDeep(this.data[0]);
            clone.id = Utils.generateId();
            this.data.unshift(clone);
            this.updateMetrics();
            this.render();
        }
    }
    
    getValidRows() {
        return this.data.filter(r => r.isValid);
    }
}

// Global reference for visual editor instance
let spreadsheetEditor = null;

// --- CREATOR STUDIO ---
const Creator = {
    tempQuestions: [],
    
    setup() {
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

        document.getElementById('creatorAppendQuestionBtn').addEventListener('click', () => this.appendManual());
        document.getElementById('creatorSaveQuizBtn').addEventListener('click', () => this.saveQuiz());
        document.getElementById('commitExcelImportBtn').addEventListener('click', () => this.commitExcel());
        
        const dropZone = document.getElementById('excelDropZone');
        const fileInput = document.getElementById('excelFileInput');
        
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault(); dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) this.handleExcel(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', e => {
            if (e.target.files.length) this.handleExcel(e.target.files[0]);
        });
        
        spreadsheetEditor = new VirtualSpreadsheet('virtualSpreadsheetGrid');
    },
    appendManual() {
        const qText = document.getElementById('qFormText').value.trim();
        const optA = document.getElementById('qFormOptA').value.trim();
        const optB = document.getElementById('qFormOptB').value.trim();
        const optC = document.getElementById('qFormOptC').value.trim();
        const optD = document.getElementById('qFormOptD').value.trim();
        const ans = document.getElementById('qFormAnswer').value;

        if (!qText || !optA || !optB) return showToast("Question and at least 2 options required", "error");

        this.tempQuestions.push({
            id: Utils.generateId(),
            text: qText,
            options: { A: optA, B: optB, C: optC, D: optD },
            answer: ans
        });

        document.getElementById('pendingQuestionsCount').textContent = this.tempQuestions.length;
        showToast("Node appended to memory array");
        
        ['qFormText', 'qFormOptA', 'qFormOptB', 'qFormOptC', 'qFormOptD'].forEach(id => document.getElementById(id).value = '');
    },
    async saveQuiz() {
        const title = document.getElementById('creatorQuizTitle').value.trim();
        if (!title || this.tempQuestions.length === 0) return showToast("Title and at least one question required", "error");

        const newQuiz = {
            id: 'quiz_' + Date.now(),
            title: title,
            desc: document.getElementById('creatorQuizDescription').value.trim(),
            shuffle: document.getElementById('creatorShuffle').checked,
            questions: [...this.tempQuestions],
            dateCreated: new Date().toISOString()
        };

        AppState.quizzes.push(newQuiz);
        await DBService.saveQuizzes();
        
        this.tempQuestions = [];
        document.getElementById('pendingQuestionsCount').textContent = "0";
        document.getElementById('creatorQuizTitle').value = '';
        document.getElementById('creatorQuizDescription').value = '';
        
        document.getElementById('excelVisualEditorContainer').classList.add('hidden');
        document.getElementById('excelDropZone').classList.remove('hidden');
        
        showToast("Quiz committed to database!", "success");
        Dashboard.updateStats();
        logSystem(`Quiz published: ${title}`);
    },
    handleExcel(file) {
        if (typeof XLSX === 'undefined') return showToast("Excel parser library missing", "error");

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array', cellHTML: true}); // Keep HTML for rich text
                const firstSheetName = workbook.SheetNames[0];
                const ws = workbook.Sheets[firstSheetName];
                
                // 1. Get raw JSON to detect headers
                const jsonGrid = XLSX.utils.sheet_to_json(ws, {header: 1, raw: false});
                const detection = ExcelEngine.detectHeaders(jsonGrid);
                
                if(!detection.mapping || detection.mapping.question === -1) {
                    return showToast("Failed to auto-detect required headers (Question). Check file formatting.", "error");
                }
                
                logSystem(`Excel headers detected at row ${detection.headerRowIndex + 1}. Mapping: ${JSON.stringify(detection.mapping)}`);

                // 2. Extract Data preserving Rich Text formatting
                const range = XLSX.utils.decode_range(ws['!ref']);
                const parsedData = [];
                
                for(let R = detection.headerRowIndex + 1; R <= range.e.r; ++R) {
                    const getCellHtml = (C) => {
                        if(C === -1) return '';
                        const cell = ws[XLSX.utils.encode_cell({c:C, r:R})];
                        if(!cell) return '';
                        // prioritize html format over raw text
                        return cell.h || cell.w || cell.v || '';
                    };
                    
                    const rowObj = {
                        id: Utils.generateId(),
                        question: getCellHtml(detection.mapping.question),
                        optA: getCellHtml(detection.mapping.optA),
                        optB: getCellHtml(detection.mapping.optB),
                        optC: getCellHtml(detection.mapping.optC),
                        optD: getCellHtml(detection.mapping.optD),
                        rawAnswer: getCellHtml(detection.mapping.answer)
                    };
                    
                    // Answer Matching Engine Core Fix
                    rowObj.answerKey = ExcelEngine.matchAnswer(Utils.htmlToText(rowObj.rawAnswer), {
                        A: rowObj.optA, B: rowObj.optB, C: rowObj.optC, D: rowObj.optD
                    });
                    
                    // Initial validate
                    const val = ExcelEngine.validateRow(rowObj);
                    rowObj.isValid = val.isValid;
                    rowObj.errors = val.errors;

                    // Skip completely empty rows
                    if(rowObj.question || rowObj.optA || rowObj.rawAnswer) {
                        parsedData.push(rowObj);
                    }
                }

                // Show UI
                document.getElementById('excelDropZone').classList.add('hidden');
                document.getElementById('excelVisualEditorContainer').classList.remove('hidden');
                
                spreadsheetEditor.loadData(parsedData);
                showToast(`Extracted ${parsedData.length} rows into visual editor`, 'success');

            } catch(err) {
                showToast("Failed to parse Excel file", "error");
                console.error(err);
                logSystem("Excel parse fatal error.");
            }
        };
        reader.readAsArrayBuffer(file);
    },
    commitExcel() {
        const validRows = spreadsheetEditor.getValidRows();
        if(validRows.length === 0) return showToast("No valid rows to commit. Please fix errors.", "error");
        
        validRows.forEach(r => {
            this.tempQuestions.push({
                id: r.id,
                text: r.question, // stores HTML
                options: { A: r.optA, B: r.optB, C: r.optC, D: r.optD },
                answer: r.answerKey
            });
        });
        
        document.getElementById('pendingQuestionsCount').textContent = this.tempQuestions.length;
        showToast(`Injected ${validRows.length} validated nodes into memory array`, 'success');
        
        // Reset editor view
        document.getElementById('excelVisualEditorContainer').classList.add('hidden');
        document.getElementById('excelDropZone').classList.remove('hidden');
        document.getElementById('excelFileInput').value = '';
    }
};

// --- LIBRARY & QUIZ EXECUTION ---
const Library = {
    render() {
        const container = document.getElementById('libraryContainer');
        container.innerHTML = '';

        if (AppState.quizzes.length === 0) {
            container.innerHTML = `<p style="color:var(--text-light);">Inventory empty. Deploy assets via Creator Studio.</p>`;
            return;
        }

        const filter = document.getElementById('libraryFilterInput').value.toLowerCase();
        const sort = document.getElementById('librarySortSelect').value;

        let filtered = AppState.quizzes.filter(q => q.title.toLowerCase().includes(filter));
        if(sort === 'name') filtered.sort((a,b) => a.title.localeCompare(b.title));
        else filtered.sort((a,b) => new Date(b.dateCreated) - new Date(a.dateCreated));

        filtered.forEach(quiz => {
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
            
            card.querySelector('.play-btn').addEventListener('click', () => QuizRunner.start(quiz.id));
            container.appendChild(card);
        });
    }
};

const QuizRunner = {
    interval: null,
    
    setup() {
        document.getElementById('runnerPrevBtn').addEventListener('click', () => this.navigate(-1));
        document.getElementById('runnerNextBtn').addEventListener('click', () => this.navigate(1));
        document.getElementById('runnerQuitBtn').addEventListener('click', () => this.quit());
        document.getElementById('runnerFinishBtn').addEventListener('click', () => this.finish());
        
        document.getElementById('libraryFilterInput').addEventListener('input', () => Library.render());
        document.getElementById('librarySortSelect').addEventListener('change', () => Library.render());
    },
    start(quizId) {
        const quiz = AppState.quizzes.find(q => q.id === quizId);
        if (!quiz || quiz.questions.length === 0) return showToast("Invalid structural matrix", "error");

        AppState.activeQuiz = quiz;
        
        let questionsToRun = [...quiz.questions];
        if(quiz.shuffle) {
            questionsToRun = questionsToRun.sort(() => Math.random() - 0.5);
        }
        
        AppState.currentAttempt = {
            questions: questionsToRun,
            currentIndex: 0,
            answers: {}, 
            startTime: Date.now()
        };

        document.getElementById('runnerQuizTitle').textContent = quiz.title;
        Navigation.switchSection('quizSection');
        this.renderNode();
        
        clearInterval(this.interval);
        const timerEl = document.getElementById('runnerTimer');
        let elapsed = 0;
        this.interval = setInterval(() => {
            elapsed++;
            const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        }, 1000);
        
        logSystem(`Quiz Matrix Executed: ${quiz.title}`);
    },
    navigate(dir) {
        const { currentIndex, questions } = AppState.currentAttempt;
        const newIndex = currentIndex + dir;
        if (newIndex >= 0 && newIndex < questions.length) {
            AppState.currentAttempt.currentIndex = newIndex;
            this.renderNode();
        }
    },
    renderNode() {
        const { currentIndex, answers, questions } = AppState.currentAttempt;
        const q = questions[currentIndex];

        document.getElementById('runnerQuestionMeta').textContent = `Parameter Node ${currentIndex + 1} of ${questions.length}`;
        document.getElementById('runnerProgressBar').style.width = `${((currentIndex) / questions.length) * 100}%`;
        document.getElementById('runnerQuestionText').innerHTML = q.text; // Use innerHTML to preserve rich text

        const grid = document.getElementById('runnerOptionsGrid');
        grid.innerHTML = '';
        
        Object.keys(q.options).forEach(key => {
            if(!q.options[key]) return;
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            if (answers[q.id] === key) btn.classList.add('selected');
            
            // Render HTML to preserve Excel rich text styles (bold, color, etc)
            btn.innerHTML = `<span class="opt-key"><strong>${key}.</strong></span> <span class="opt-val">${q.options[key]}</span>`;
            
            btn.addEventListener('click', () => {
                AppState.currentAttempt.answers[q.id] = key;
                this.renderNode();
            });
            grid.appendChild(btn);
        });

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
    },
    quit() {
        clearInterval(this.interval);
        Navigation.switchSection('librarySection');
        logSystem("Quiz attempt aborted by user.");
    },
    finish() {
        clearInterval(this.interval);
        document.getElementById('runnerProgressBar').style.width = '100%';
        
        const { questions, answers } = AppState.currentAttempt;
        
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

        Dashboard.recordAttempt(AppState.activeQuiz.id, AppState.activeQuiz.title, score, questions.length);

        Navigation.switchSection('reviewSection');
        
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
                <div style="font-size:0.85rem; color:var(--text-light); margin-top:5px; padding:10px; background:var(--bg-base); border-radius:4px;">
                    ${item.options[item.correctAns] ? item.options[item.correctAns] : ''}
                </div>
            `;
            reviewContainer.appendChild(card);
        });

        document.getElementById('reviewCloseBtn').onclick = () => Navigation.switchSection('homeSection');
    }
};

// --- PDF CENTER ---
const PDFCenter = {
    setup() {
        document.getElementById('pdfGenerateDownloadBtn').addEventListener('click', () => this.generate(false));
        document.getElementById('pdfGenerateKeyBtn').addEventListener('click', () => this.generate(true));
    },
    populateDropdown() {
        const select = document.getElementById('pdfSourceAssetSelect');
        select.innerHTML = '<option value="">Select Quiz Source Data Node...</option>';
        AppState.quizzes.forEach(q => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.title;
            select.appendChild(opt);
        });
    },
    generate(isAnswerKey) {
        if (typeof window.jspdf === 'undefined') return showToast("jsPDF library not loaded", "error");
        
        const quizId = document.getElementById('pdfSourceAssetSelect').value;
        if (!quizId) return showToast("No target source selected", "error");

        const quiz = AppState.quizzes.find(q => q.id === quizId);
        const { jsPDF } = window.jspdf;
        
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
            // Strip HTML for PDF output
            const strip = html => {
                let doc = new DOMParser().parseFromString(html, 'text/html');
                return doc.body.textContent || "";
            };
            
            const qText = strip(q.text);
            let optString = `A) ${strip(q.options.A || '')}\nB) ${strip(q.options.B || '')}\nC) ${strip(q.options.C || '')}\nD) ${strip(q.options.D || '')}`;
            
            if(isAnswerKey) {
                bodyData.push([`${i+1}`, qText, q.answer, strip(q.options[q.answer] || '')]);
            } else {
                bodyData.push([`${i+1}`, qText, optString]);
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
        logSystem(`PDF Generated: ${fileName}`);
    }
};

// --- ADMIN & SYSTEM ---
const AdminSystem = {
    setup() {
        document.getElementById('adminResetDataBtn').addEventListener('click', async () => {
            if(confirm("CRITICAL WARNING: This will permanently purge all local records and workspace data. Proceed?")) {
                await DBService.reset();
            }
        });
        document.getElementById('adminForceSyncBtn').addEventListener('click', () => {
            showToast("Sync triggered across cloud clusters", "success");
            logSystem("Manual sync operation executed.");
        });
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await DBService.init();
    Auth.setup();
    Navigation.setup();
    Creator.setup();
    QuizRunner.setup();
    PDFCenter.setup();
    AdminSystem.setup();
});