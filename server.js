require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Import CORS
const connectDB = require('./config/db');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const jwt = require('jsonwebtoken');


if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error('MONGO_URI or JWT_SECRET is missing from .env');
    process.exit(1);
}


const app = express();
const PORT = 3000;

connectDB();

// Middleware
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json()); // Parse incoming JSON data

// Base health check
app.get('/', (req, res) => {
    res.status(200).send('CareerConnect Server is running!');
});

// Sprint 1 Feature: User Registration
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    // Check that email and password were provided
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check whether the email is already registered
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user to MongoDB
    const newUser = await User.create({
        email,
        password: hashedPassword
    });

    // Return the created user's safe information
    res.status(201).json({
        message: 'User registered successfully!',
        user: {
            id: newUser._id,
            email: newUser.email
        }
    });
}); 


// Sprint 1 Feature: User Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Check that email and password were provided
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find the user in MongoDB
    const user = await User.findOne({ email });

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
        user: {
            id: user._id,
            email: user.email
        }
    });
});


// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
