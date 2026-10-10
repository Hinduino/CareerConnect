require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Import CORS
const multer = require('multer');
const connectDB = require('./config/db');
const resumeRoutes = require('./routes/resumeRoutes');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const requireAuth = require('./middleware/auth');

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error('MONGO_URI or JWT_SECRET is missing from .env');
    process.exit(1);
}

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

// The profile fields that are safe to send to / accept from the client
function toProfile(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        bio: user.bio
    };
}

// Sprint 1 Feature: User Registration
app.post('/api/register', async (req, res) => {
    const { email, password, confirmPassword } = req.body;

    // Check that email and password are valid inputs
    if (
        typeof email !== 'string' ||
        !email.trim() ||
        typeof password !== 'string' ||
        !password
    ) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }

    // Normalize the email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate the email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
            error: 'Please enter a valid email address'
        });
    }


    // Validate password requirements
    if (password.length < 8) {
        return res.status(400).json({
            error: 'Password must contain at least 8 characters'
        });
    }

    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({
            error: 'Password must contain at least one uppercase letter'
        });
    }

    if (!/[a-z]/.test(password)) {
        return res.status(400).json({
            error: 'Password must contain at least one lowercase letter'
        });
    }

    if (!/[0-9]/.test(password)) {
        return res.status(400).json({
            error: 'Password must contain at least one number'
        });
    }

    if (!/[^A-Za-z0-9\s]/.test(password)) {
        return res.status(400).json({
            error: 'Password must contain at least one special character'
        });
    }

    if (/\s/.test(password)) {
        return res.status(400).json({
            error: 'Password must not contain spaces'
        });
    }

    // Validate password confirmation
    if (typeof confirmPassword !== 'string' || !confirmPassword) {
        return res.status(400).json({
            error: 'Password confirmation is required'
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({
            error: 'Passwords do not match'
        });
    }

    // Check whether the email is already registered
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user to MongoDB
    const newUser = await User.create({
        email: normalizedEmail,
        password: hashedPassword
    });

    // Return the created user's safe information
    res.status(201).json({
        message: 'User registered successfully!',
        user: toProfile(newUser)
    });
});


// Sprint 1 Feature: User Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Check that email and password were provided
    if (
        typeof email !== 'string' ||
        !email.trim() ||
        typeof password !== 'string' ||
        !password
    ) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize the email before searching
    const normalizedEmail = email.trim().toLowerCase();

    // Find the user in MongoDB
    const user = await User.findOne({ email: normalizedEmail });

    // Reject login if the account does not exist
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare the entered password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    // Reject login if the password is incorrect
    if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create an authentication token
    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Return successful login information
    res.status(200).json({
        message: 'Login successful!',
        token,
        user: toProfile(user)
    });
});

// Profile management: view and update the logged-in user's own profile
app.get('/api/profile', requireAuth, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: toProfile(user) });
});

app.put('/api/profile', requireAuth, async (req, res) => {
    const { name, email, role, location, bio } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
    }
    if (!['job_seeker', 'recruiter'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    const trimmedEmail = email.trim();
    const emailTaken = await User.findOne({ email: trimmedEmail, _id: { $ne: req.user.id } });
    if (emailTaken) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.findByIdAndUpdate(
        req.user.id,
        {
            name: String(name ?? ''),
            email: trimmedEmail,
            role,
            location: String(location ?? ''),
            bio: String(bio ?? '')
        },
        { new: true, runValidators: true }
    );
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile saved successfully!', user: toProfile(user) });
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
