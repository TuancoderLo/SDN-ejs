const Member = require('../models/member.model');

// Helper to remove sensitive fields
function sanitize(member) {
  if (!member) return member;
  const obj = member.toObject ? member.toObject() : Object.assign({}, member);
  delete obj.password;
  return obj;
}

// Admin: get all members
const getAllMembers = async (req, res) => {
  try {
    const members = await Member.find().select('-password');
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: get all members via /collectors endpoint
const getCollectors = async (req, res) => {
  try {
    const members = await Member.find().select('-password');
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Member: get own profile
const getMyProfile = async (req, res) => {
  try {
    // Debug log to see user data
    console.log('User data in getMyProfile:', req.user);
    console.log('YOB field:', req.user.YOB);
    
    res.json({ member: sanitize(req.user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Member: update own profile (cannot change email, password or isAdmin here)
const updateMyProfile = async (req, res) => {
  try {
    const allowed = ['name', 'YOB', 'gender'];
    allowed.forEach((k) => { if (req.body[k] !== undefined) req.user[k] = req.body[k]; });
    await req.user.save();
    res.json({ message: 'Updated', member: sanitize(req.user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Member: change password
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const ok = await req.user.comparePassword(oldPassword);
    if (!ok) return res.status(400).json({ message: 'Old password mismatch' });
    req.user.password = newPassword;
    await req.user.save();
    res.json({ message: 'Password changed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: promote or demote a member (set isAdmin)
const updateAdminStatus = async (req, res) => {
  try {
    const { isAdmin } = req.body;
    if (typeof isAdmin !== 'boolean') return res.status(400).json({ message: 'isAdmin boolean required' });
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    member.isAdmin = isAdmin;
    await member.save();
    res.json({ message: 'Updated', member: sanitize(member) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: block a member
const blockMember = async (req, res) => {
  try {
    const { reason } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    // Cannot block admin users
    if (member.isAdmin) {
      return res.status(400).json({ message: 'Cannot block admin users' });
    }
    
    // Cannot block yourself
    if (member._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }
    
    member.isBlocked = true;
    member.blockedAt = new Date();
    member.blockedBy = req.user._id;
    member.blockReason = reason || 'No reason provided';
    
    await member.save();
    res.json({ 
      message: 'Member blocked successfully', 
      member: sanitize(member) 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: unblock a member
const unblockMember = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    member.isBlocked = false;
    member.blockedAt = null;
    member.blockedBy = null;
    member.blockReason = null;
    
    await member.save();
    res.json({ 
      message: 'Member unblocked successfully', 
      member: sanitize(member) 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllMembers,
  getCollectors,
  getMyProfile,
  updateMyProfile,
  changePassword,
  updateAdminStatus,
  blockMember,
  unblockMember
};
