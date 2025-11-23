const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Path to the global quizzes folder
const QUIZ_FOLDER = path.join(__dirname, 'quizzes');

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // This serves your index.html, css, js

// Ensure quiz folder exists
if (!fs.existsSync(QUIZ_FOLDER)) {
    fs.mkdirSync(QUIZ_FOLDER);
}

// 1. GET ALL QUIZZES (Global Library)
app.get('/api/quizzes', (req, res) => {
    fs.readdir(QUIZ_FOLDER, (err, files) => {
        if (err) return res.status(500).json({ error: "Failed to read library" });

        const quizzes = [];
        files.forEach(file => {
            if (path.extname(file) === '.json') {
                try {
                    const data = fs.readFileSync(path.join(QUIZ_FOLDER, file), 'utf8');
                    const json = JSON.parse(data);
                    // Add filename as ID to ensure uniqueness
                    json.id = file;
                    json.isPublic = true; 
                    quizzes.push(json);
                } catch (e) {
                    console.error("Error reading quiz:", file);
                }
            }
        });
        // Send newest first
        res.json(quizzes.reverse()); 
    });
});

// 2. SAVE A NEW QUIZ
app.post('/api/quizzes', (req, res) => {
    const quizData = req.body;
    
    // Create a safe filename based on Exam Name + Timestamp
    const safeName = (quizData.meta.exam || "quiz").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${Date.now()}_${safeName}.json`;
    const filePath = path.join(QUIZ_FOLDER, filename);

    // Save to server folder
    fs.writeFile(filePath, JSON.stringify(quizData, null, 2), (err) => {
        if (err) return res.status(500).json({ error: "Failed to save quiz" });
        console.log(`Saved: ${filename}`);
        res.json({ success: true, message: "Saved to Global Library" });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});