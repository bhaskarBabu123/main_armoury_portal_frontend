const mongoose = require('mongoose');
const User = require('./models/User'); // adjust path if needed
require('dotenv').config();

const MONGO_URI = 'mongodb+srv://bhaskarAntoty123:MQEJ1W9gtKD547hy@bhaskarantony.wagpkay.mongodb.net/armoury_main?retryWrites=true&w=majority';

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected');

    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log('Admin already exists:', existingAdmin.email);
      process.exit();
    }

    const admin = new User({
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@ksrp.gov.in',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      isActive: true
    });

    await admin.save();

    console.log('✅ Admin user created successfully');
    console.log('Email:', admin.email);
    console.log('Password:', process.env.ADMIN_PASSWORD || 'Admin@123');

    process.exit();
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
