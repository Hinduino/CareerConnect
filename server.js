require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Import CORS
const multer = require('multer');
const connectDB = require('./config/db');
const resumeRoutes = require('./routes/resumeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

// Middleware
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json()); // Parse incoming JSON data

// Base health check
app.get('/', (req, res) => {
    res.status(200).send('CareerConnect Server is running!');
});

app.use('/api/resumes', resumeRoutes);

// Sprint 1 Feature: User Registration Mock API
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // In Sprint 2, this will save to a database. For Sprint 1, we just return success.
    res.status(201).json({ 
        message: 'User registered successfully!', 
        user: { email } 
    });
});

// Error handling
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'File is too large. Maximum size is 5MB.'
            : err.message;
        return res.status(400).json({ error: message });
    }
    if (err && err.message && err.message.includes('Only PDF, DOC, and DOCX')) {
        return res.status(400).json({ error: err.message });
    }

    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
