// Setup initial data for testing
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/assignment-mernstack';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to', uri);
    
    const Member = require(path.join(__dirname, '..', 'models', 'member.model'));
    const Brand = require(path.join(__dirname, '..', 'models', 'brand.model'));
    const Perfume = require(path.join(__dirname, '..', 'models', 'perfume.model'));
    
    // Create admin user
    const adminEmail = 'admin@myteam.com';
    let admin = await Member.findOne({ email: adminEmail }).exec();
    if (!admin) {
      admin = new Member({
        email: adminEmail,
        password: 'admin123',
        name: 'Do Nam Trung',
        YOB: 1990,
        gender: true,
        isAdmin: true
      });
      await admin.save();
      console.log('Admin created:', admin.email);
    } else {
      console.log('Admin already exists:', admin.email);
    }
    
    // Create test brands
    const brands = [
      { brandName: 'Chanel' },
      { brandName: 'Dior' },
      { brandName: 'Tom Ford' },
      { brandName: 'Yves Saint Laurent' }
    ];
    
    const createdBrands = [];
    for (const brandData of brands) {
      let brand = await Brand.findOne({ brandName: brandData.brandName }).exec();
      if (!brand) {
        brand = new Brand(brandData);
        await brand.save();
        console.log('Brand created:', brand.brandName);
      } else {
        console.log('Brand already exists:', brand.brandName);
      }
      createdBrands.push(brand);
    }
    
    // Create test perfumes
    const perfumes = [
      {
        perfumeName: 'Chanel No. 5',
        brand: createdBrands[0]._id,
        price: 120.00,
        volume: 100,
        concentration: 'EDP',
        targetAudience: 'female',
        uri: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400',
        description: 'A timeless classic floral fragrance',
        ingredients: 'Rose, Jasmine, Ylang-Ylang, Sandalwood, Vanilla'
      },
      {
        perfumeName: 'Sauvage',
        brand: createdBrands[1]._id,
        price: 95.00,
        volume: 100,
        concentration: 'EDT',
        targetAudience: 'male',
        uri: 'https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=400',
        description: 'A fresh and woody fragrance for men',
        ingredients: 'Bergamot, Pepper, Ambergris, Cedar'
      },
      {
        perfumeName: 'Black Orchid',
        brand: createdBrands[2]._id,
        price: 180.00,
        volume: 50,
        concentration: 'Extrait',
        targetAudience: 'unisex',
        uri: 'https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?w=400',
        description: 'A luxurious and mysterious fragrance',
        ingredients: 'Black Orchid, Dark Chocolate, Patchouli, Incense'
      }
    ];
    
    for (const perfumeData of perfumes) {
      let perfume = await Perfume.findOne({ perfumeName: perfumeData.perfumeName }).exec();
      if (!perfume) {
        perfume = new Perfume(perfumeData);
        await perfume.save();
        console.log('Perfume created:', perfume.perfumeName);
      } else {
        console.log('Perfume already exists:', perfume.perfumeName);
      }
    }
    
    console.log('Setup completed successfully!');
    console.log('Admin login: admin@myteam.com / admin123');
    process.exit(0);
  } catch (err) {
    console.error('Error setting up data:', err);
    process.exit(1);
  }
}

main();
