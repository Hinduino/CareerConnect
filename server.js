const express = require('express');
const cors = require('cors'); // Import CORS
const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json()); // Parse incoming JSON data

// Base health check
app.get('/', (req, res) => {
    res.status(200).send('CareerConnect Server is running!');
});

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
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
