const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const brandsController = require('../controllers/brandsController');

// Admin routes
router.get('/', authenticateToken, requireAdmin, brandsController.getAllBrands);
router.get('/:id', authenticateToken, requireAdmin, brandsController.getBrandById);
router.post('/', authenticateToken, requireAdmin, brandsController.createBrand);
router.put('/:id', authenticateToken, requireAdmin, brandsController.updateBrand);
router.delete('/:id', authenticateToken, requireAdmin, brandsController.deleteBrand);
router.patch('/:id/restore', authenticateToken, requireAdmin, brandsController.restoreBrand);

module.exports = router;
