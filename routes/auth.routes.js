const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);

// Admin protected routes
router.post('/register/admin', authenticateToken, requireAdmin, authController.registerAdmin);

module.exports = router;
