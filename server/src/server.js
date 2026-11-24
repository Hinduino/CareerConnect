const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors'); // Import CORS
const multer = require('multer');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const profilePictureRoutes = require('./routes/profilePictureRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { startApplicationReminderScheduler } = require('./services/applicationReminderService');

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error('MONGO_URI or JWT_SECRET is missing from .env');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;


if (process.env.NODE_ENV !== 'test') {
    connectDB().then(startApplicationReminderScheduler);
}

// Middleware
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json()); // Parse incoming JSON data

// Base health check
app.get('/', (req, res) => {
    res.status(200).json({ message: 'CareerConnect Server is running!' });
});

app.use('/api', authRoutes);
app.use('/api/profile/picture', profilePictureRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling
// Express only treats a middleware as an error handler when it takes all four
// arguments, so `next` must stay even though most errors are answered here.
app.use((err, req, res, next) => {
    // If a response was already partly sent, we can't send a new one: hand the
    // error to Express's default handler, which closes the connection safely.
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'File is too large. Maximum size is 5MB.'
            : err.message;
        return res.status(400).json({ error: message });
    }
    if (err && err.message && (
        err.message.includes('Only PDF, DOC, and DOCX')
        || err.message.includes('images are allowed')
    )) {
        return res.status(400).json({ error: err.message });
    }

    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}

module.exports = app; // Export the app for testing purposes
