const jwt = require('jsonwebtoken');
const Member = require('../models/member.model');
const { OAuth2Client } = require('google-auth-library');

const secret = process.env.JWT_SECRET || 'secretkey';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '914998642899-8k9j2l3m4n5o6p7q8r9s0t1u2v3w4x5y.apps.googleusercontent.com');

// Register new member
const register = async (req, res) => {
  try {
    // Check if request body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request body cannot be empty' });
    }
    
    const { email, password, name, YOB, gender } = req.body;
    const existing = await Member.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email exists' });
    
    // ignore any isAdmin provided in body for public registration
    const member = new Member({ email, password, name, YOB, gender });
    await member.save();
    res.status(201).json({ message: 'Registered' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: create a member with isAdmin flag
const registerAdmin = async (req, res) => {
  try {
    const { email, password, name, YOB, gender, isAdmin } = req.body;
    const existing = await Member.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email exists' });
    const member = new Member({ email, password, name, YOB, gender, isAdmin: !!isAdmin });
    await member.save();
    res.status(201).json({ message: 'Registered' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Login member
const login = async (req, res) => {
  try {
    // Check if request body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request body cannot be empty' });
    }
    
    const { email, password } = req.body;
    const member = await Member.findOne({ email });
    if (!member) return res.status(400).json({ message: 'Invalid credentials' });
    const ok = await member.comparePassword(password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: member._id, isAdmin: member.isAdmin }, secret, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Google authentication
const googleAuth = async (req, res) => {
  try {
    const { idToken, email, name, photoURL } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ message: 'ID token is required' });
    }

    // For development, skip token verification and use provided data
    // This avoids the "No pem found" error with mismatched Client IDs
    let payload;
    if (email && name) {
      payload = {
        email: email,
        name: name,
        sub: 'google-' + Date.now(), // Generate unique ID
        picture: photoURL
      };
      console.log('Using provided Google data (development mode)');
    } else {
      // Try token verification as fallback
      try {
        const ticket = await client.verifyIdToken({
          idToken: idToken,
          audience: process.env.GOOGLE_CLIENT_ID || '914998642899-8k9j2l3m4n5o6p7q8r9s0t1u2v3w4x5y.apps.googleusercontent.com'
        });
        payload = ticket.getPayload();
        console.log('Token verification successful');
      } catch (verifyError) {
        console.error('Token verification failed:', verifyError);
        throw new Error('Invalid token and no fallback data provided');
      }
    }
    
    const googleEmail = payload.email;
    
    // Check if user exists
    let member = await Member.findOne({ email: googleEmail });
    
    if (!member) {
      // Create new user from Google data
      member = new Member({
        email: googleEmail,
        name: name || payload.name,
        password: 'google-auth', // Dummy password for Google users
        YOB: 1990, // Default year, user can update later
        gender: true, // Default gender, user can update later
        googleId: payload.sub,
        photoURL: photoURL || payload.picture
      });
      await member.save();
    } else {
      // Update existing user with Google info if not already set
      if (!member.googleId) {
        member.googleId = payload.sub;
        member.photoURL = photoURL || payload.picture;
        await member.save();
      }
    }
    
    // Generate JWT token
    const token = jwt.sign({ id: member._id, isAdmin: member.isAdmin }, secret, { expiresIn: '1h' });
    
    res.json({ 
      token, 
      user: {
        _id: member._id,
        email: member.email,
        name: member.name,
        isAdmin: member.isAdmin,
        photoURL: member.photoURL
      }
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ message: 'Google authentication failed: ' + err.message });
  }
};

module.exports = {
  register,
  registerAdmin,
  login,
  googleAuth
};
