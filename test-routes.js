const express = require('express');
const app = express();

// Test basic route
app.get('/', (req, res) => {
    res.json({ message: 'Test route working' });
});

// Test with wildcard
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Not found' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});
