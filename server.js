const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { validateDocument } = require('./src/validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.docx') {
            cb(null, true);
        } else {
            cb(new Error('Only .docx files are allowed!'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Routes
app.post('/api/validate', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const documentType = req.body.documentType || 'assignment';
        const validationResults = await validateDocument(req.file.path, documentType);

        res.json({
            success: true,
            results: validationResults,
            filename: req.file.originalname
        });

        // Clean up uploaded file after validation
        const fs = require('fs');
        setTimeout(() => {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }, 5000);

    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Root route - serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'SAIACS Style Validator is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SAIACS Style Validator running on http://localhost:${PORT}`);

    // Create uploads directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
});
