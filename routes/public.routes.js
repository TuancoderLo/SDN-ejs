const express = require('express');
const router = express.Router();
const Perfume = require('../models/perfume.model');
const Brand = require('../models/brand.model');

// Public: list perfumes with basic info (for public viewing)
router.get('/public/perfumes', async (req, res) => {
  try {
    const { q, brand } = req.query; // q: perfumeName, brand: brandName or id
    const filter = {};
    if (q) filter.perfumeName = { $regex: q, $options: 'i' };
    if (brand) {
      // try id first
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(brand);
      if (isObjectId) filter.brand = brand;
      else {
        const b = await Brand.findOne({ brandName: brand, isDeleted: false });
        if (b) filter.brand = b._id;
        else filter.brand = null; // no matches
      }
    }
    const perfumes = await Perfume.find(filter)
      .select('perfumeName uri targetAudience brand price volume concentration description ingredients')
      .populate('brand', 'brandName')
      .populate('comments.author', 'name');
    res.json(perfumes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public: get all brands (for public viewing) - including soft-deleted ones
router.get('/public/brands', async (req, res) => {
  try {
    const brands = await Brand.find({}).select('brandName isDeleted deletedAt');
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public: get single perfume by ID
router.get('/public/perfumes/:id', async (req, res) => {
  try {
    console.log('Backend: Getting perfume with ID:', req.params.id);
    const perfume = await Perfume.findById(req.params.id)
      .populate('brand')
      .populate('comments.author', 'name email');
    if (!perfume) {
      return res.status(404).json({ message: 'Perfume not found' });
    }
    
    console.log('Backend: Raw perfume data:', {
      _id: perfume._id,
      perfumeName: perfume.perfumeName,
      brand: perfume.brand,
      imageUrl: perfume.imageUrl,
      uri: perfume.uri
    });
    
    // Format the response
    const formattedPerfume = {
      _id: perfume._id,
      name: perfume.perfumeName,
      brand: perfume.brand?.brandName || 'Unknown Brand',
      price: perfume.price,
      description: perfume.description,
      category: perfume.category || perfume.targetAudience,
      releaseYear: perfume.releaseYear,
      imageUrl: perfume.imageUrl,
      uri: perfume.uri, // Add uri field for compatibility
      comments: perfume.comments || [],
      createdAt: perfume.createdAt,
      updatedAt: perfume.updatedAt
    };
    
    console.log('Backend: Formatted perfume data:', formattedPerfume);
    res.json(formattedPerfume);
  } catch (err) {
    console.error('Backend: Error getting perfume:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
