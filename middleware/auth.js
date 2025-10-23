const jwt = require('jsonwebtoken');
const Member = require('../models/member.model');

const secret = process.env.JWT_SECRET || 'secretkey';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('Auth middleware - Authorization header:', authHeader);
  console.log('Auth middleware - Token:', token ? 'Present' : 'Missing');
  
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const payload = jwt.verify(token, secret);
    console.log('Auth middleware - Payload:', payload);
    const member = await Member.findById(payload.id);
    if (!member) return res.status(401).json({ message: 'Invalid token' });
    
    // Check if member is blocked
    if (member.isBlocked) {
      return res.status(403).json({ 
        message: 'Account is blocked', 
        reason: member.blockReason,
        blockedAt: member.blockedAt 
      });
    }
    
    console.log('Auth middleware - Member found:', member.email, 'isAdmin:', member.isAdmin);
    console.log('Auth middleware - Member ID:', member._id.toString());
    req.user = member;
    next();
  } catch (err) {
    console.error('Auth middleware - Error:', err.message);
    return res.status(403).json({ message: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ message: 'Admin only' });
  next();
}

module.exports = { authenticateToken, requireAdmin };
