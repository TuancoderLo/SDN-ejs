const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const perfumesController = require('../controllers/perfumesController');

// Admin routes
router.get('/test', authenticateToken, requireAdmin, perfumesController.testRoute);
router.get('/', authenticateToken, requireAdmin, perfumesController.getAllPerfumes);
router.get('/:id', authenticateToken, requireAdmin, perfumesController.getPerfumeById);
router.post('/', authenticateToken, requireAdmin, perfumesController.createPerfume);
router.put('/:id', authenticateToken, requireAdmin, perfumesController.updatePerfume);
router.delete('/:id', authenticateToken, requireAdmin, perfumesController.deletePerfume);

// Member routes (comments)
router.post('/:id/comments', authenticateToken, perfumesController.addComment);
router.put('/:id/comments/:commentId', authenticateToken, perfumesController.editComment);
router.delete('/:id/comments/:commentId', authenticateToken, perfumesController.deleteComment);

module.exports = router;
