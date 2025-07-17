const { Router } = require('express');
const router = Router();

// Simple test route
router.get('/test', (req, res) => {
    res.json({ message: 'Test route working' });
});

module.exports = router;
