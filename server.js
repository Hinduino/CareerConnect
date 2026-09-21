const express = require('express');
const app = express();
const PORT = 3000;

// Middleware for basic input validation (parses incoming JSON payloads)
app.use(express.json());

// Basic API endpoint
app.get('/', (req, res) => {
    res.send('CareerConnect Server is running!');
});

// Basic error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('An unexpected error occurred on the server.');
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});