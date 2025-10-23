const mongoose = require('mongoose');
const Perfume = require('../models/perfume.model');

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/assignment-mernstack';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Sample image URLs for perfumes
const sampleImages = [
  'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1594736797933-d0c29c8d0a8e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1612817159949-195b6eb9e1f1?w=400&h=400&fit=crop'
];

async function addSampleImages() {
  try {
    const perfumes = await Perfume.find({});
    console.log(`Found ${perfumes.length} perfumes to update`);
    
    for (let i = 0; i < perfumes.length; i++) {
      const perfume = perfumes[i];
      const imageIndex = i % sampleImages.length;
      
      // Update perfume with image URL and some additional fields
      await Perfume.findByIdAndUpdate(perfume._id, {
        imageUrl: sampleImages[imageIndex],
        category: perfume.targetAudience || 'Unisex',
        releaseYear: 2020 + (i % 4) // Random year between 2020-2023
      });
      
      console.log(`Updated ${perfume.perfumeName} with image`);
    }
    
    console.log('All perfumes updated with sample images!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating perfumes:', error);
    process.exit(1);
  }
}

addSampleImages();
