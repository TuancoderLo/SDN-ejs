// Create an initial admin user so the database and collection are created
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/assignment-mernstack';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to', uri);
    const Member = require(path.join(__dirname, '..', 'models', 'member.model'));
    const email = 'admin@myteam.com';
    const existing = await Member.findOne({ email }).exec();
    if (existing) {
      console.log('Admin already exists:', existing.email);
      process.exit(0);
    }
    const admin = new Member({
      email,
      password: 'admin123',
      name: 'Do Nam Trung',
      YOB: 1990,
      gender: true,
      isAdmin: true
    });
    await admin.save();
    console.log('Admin created:', admin.email);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

main();
