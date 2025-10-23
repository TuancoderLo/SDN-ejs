const Perfume = require('../models/perfume.model');
const Brand = require('../models/brand.model');

// Admin only: test route
const testRoute = (req, res) => {
  res.json({ message: 'Perfumes API is working!' });
};

// Admin only: list all perfumes with full details
const getAllPerfumes = async (req, res) => {
  try {
    const { q, brand } = req.query; // q: perfumeName, brand: brandName or id
    const filter = {};
    if (q) filter.perfumeName = { $regex: q, $options: 'i' };
    if (brand) {
      // try id first
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(brand);
      if (isObjectId) filter.brand = brand;
      else {
        const b = await Brand.findOne({ brandName: brand });
        if (b) filter.brand = b._id;
        else filter.brand = null; // no matches
      }
    }
    const perfumes = await Perfume.find(filter).populate('brand').populate('comments.author', 'email name');
    res.json(perfumes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: get perfume detail
const getPerfumeById = async (req, res) => {
  try {
    const p = await Perfume.findById(req.params.id).populate('brand').populate('comments.author', 'email name');
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: create
const createPerfume = async (req, res) => {
  try {
    console.log('POST /api/perfumes - Request body:', req.body);
    console.log('POST /api/perfumes - User:', req.user ? req.user.email : 'No user');
    
    // Check if request body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request body cannot be empty' });
    }
    
    // Validate required fields
    const requiredFields = ['perfumeName', 'brand', 'price', 'volume', 'concentration', 'targetAudience', 'uri', 'description', 'ingredients'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    const perfume = new Perfume(req.body);
    await perfume.save();
    res.status(201).json(perfume);
  } catch (err) {
    console.error('POST /api/perfumes - Error:', err);
    res.status(400).json({ message: err.message });
  }
};

// Admin only: update
const updatePerfume = async (req, res) => {
  try {
    const p = await Perfume.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(p);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Admin only: delete
const deletePerfume = async (req, res) => {
  try {
    await Perfume.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Member: post a comment on a perfume (one comment per member per perfume)
const addComment = async (req, res) => {
  try {
    const p = await Perfume.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Perfume not found' });
    const existing = p.comments.find(c => c.author && c.author.toString() === req.user._id.toString());
    if (existing) return res.status(400).json({ message: 'You have already commented on this perfume' });
    const { rating, content } = req.body;
    
    // Debug log to see user ID being saved
    console.log('Add Comment - User ID being saved:', req.user._id.toString());
    
    p.comments.push({ rating, content, author: req.user._id });
    await p.save();
    res.status(201).json({ message: 'Comment added' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Member: edit a comment on a perfume
const editComment = async (req, res) => {
  try {
    const p = await Perfume.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Perfume not found' });
    
    const comment = p.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    
    // Debug log to see ownership check
    console.log('Edit Comment - Comment author:', comment.author.toString());
    console.log('Edit Comment - Request user ID:', req.user._id.toString());
    console.log('Edit Comment - Are they equal (toString)?', comment.author.toString() === req.user._id.toString());
    console.log('Edit Comment - Are they equal (equals)?', comment.author.equals(req.user._id));
    
    // Check if user owns this comment
    if (!comment.author.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only edit your own comments' });
    }
    
    const { rating, content } = req.body;
    if (rating !== undefined) comment.rating = rating;
    if (content !== undefined) comment.content = content;
    
    await p.save();
    res.json({ message: 'Comment updated' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Member: delete a comment on a perfume
const deleteComment = async (req, res) => {
  try {
    const p = await Perfume.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Perfume not found' });
    
    const comment = p.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    
    // Debug log to see ownership check
    console.log('Comment author:', comment.author.toString());
    console.log('Request user ID:', req.user._id.toString());
    console.log('Are they equal (toString)?', comment.author.toString() === req.user._id.toString());
    console.log('Are they equal (equals)?', comment.author.equals(req.user._id));
    
    // Check if user owns this comment
    if (!comment.author.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }
    
    comment.deleteOne();
    await p.save();
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  testRoute,
  getAllPerfumes,
  getPerfumeById,
  createPerfume,
  updatePerfume,
  deletePerfume,
  addComment,
  editComment,
  deleteComment
};
