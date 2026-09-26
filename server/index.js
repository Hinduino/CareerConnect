const app = require('./server');

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
