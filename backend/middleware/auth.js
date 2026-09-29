const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }

  try {
    const farmer = await prisma.farmer.findUnique({ where: { id: decoded.id } });
    if (!farmer || farmer.isActive === false) return res.status(401).json({ message: 'Farmer account is inactive or unavailable' });
    req.farmer = { ...farmer, _id: farmer.id };
    next();
  } catch (error) {
    next(error);
  }
};

const adminOnly = (req, res, next) => {
  if (req.farmer?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { protect, adminOnly };
