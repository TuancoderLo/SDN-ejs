const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const membersController = require('../controllers/membersController');

// Admin routes
router.get('/', authenticateToken, requireAdmin, membersController.getAllMembers);
router.get('/collectors', authenticateToken, requireAdmin, membersController.getCollectors);
router.put('/:id/admin', authenticateToken, requireAdmin, membersController.updateAdminStatus);
router.patch('/:id/block', authenticateToken, requireAdmin, membersController.blockMember);
router.patch('/:id/unblock', authenticateToken, requireAdmin, membersController.unblockMember);

// Member routes
router.get('/me', authenticateToken, membersController.getMyProfile);
router.put('/me', authenticateToken, membersController.updateMyProfile);
router.put('/me/password', authenticateToken, membersController.changePassword);

module.exports = router;
