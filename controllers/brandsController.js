const Brand = require('../models/brand.model');
const Perfume = require('../models/perfume.model');

// Admin only: get all brands (including soft-deleted)
const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find(); // Get all brands including deleted ones
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: get brand by id (including deleted ones)
const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json(brand);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: create brand
const createBrand = async (req, res) => {
  try {
    // Check if request body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request body cannot be empty' });
    }
    
    const brand = new Brand(req.body);
    await brand.save();
    res.status(201).json(brand);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Admin only: update brand (including deleted ones)
const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json(brand);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Admin only: delete brand (soft delete if has products)
const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.id, isDeleted: false });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    
    // Check if brand has any perfumes
    const perfumeCount = await Perfume.countDocuments({ brand: req.params.id });
    
    if (perfumeCount > 0) {
      // Soft delete - brand has products
      brand.isDeleted = true;
      brand.deletedAt = new Date();
      await brand.save();
      res.json({ 
        message: 'Brand soft deleted (has products)', 
        softDeleted: true,
        productCount: perfumeCount
      });
    } else {
      // Hard delete - brand has no products
      await Brand.findByIdAndDelete(req.params.id);
      res.json({ 
        message: 'Brand permanently deleted (no products)', 
        softDeleted: false
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: restore soft-deleted brand
const restoreBrand = async (req, res) => {
  try {
    console.log('Restore request for brand ID:', req.params.id);
    
    // First, let's check if the brand exists at all
    const allBrand = await Brand.findById(req.params.id);
    console.log('Brand found by ID:', allBrand ? {
      _id: allBrand._id,
      brandName: allBrand.brandName,
      isDeleted: allBrand.isDeleted,
      deletedAt: allBrand.deletedAt
    } : 'Brand not found');
    
    // Find brand that is either marked as deleted or has deletedAt date
    const brand = await Brand.findOne({ 
      _id: req.params.id, 
      $or: [
        { isDeleted: true },
        { deletedAt: { $exists: true, $ne: null } }
      ]
    });
    
    console.log('Brand found for restore:', brand ? {
      _id: brand._id,
      brandName: brand.brandName,
      isDeleted: brand.isDeleted,
      deletedAt: brand.deletedAt
    } : 'No deleted brand found');
    
    if (!brand) {
      return res.status(404).json({ message: 'Deleted brand not found' });
    }
    
    // Restore the brand
    brand.isDeleted = false;
    brand.deletedAt = null;
    await brand.save();
    
    res.json({ 
      message: 'Brand restored successfully', 
      brand: brand
    });
  } catch (err) {
    console.error('Error restoring brand:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  restoreBrand
};
