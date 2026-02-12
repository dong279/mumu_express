const jwt = require('jsonwebtoken');

// 토큰 생성
exports.generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// 토큰 검증
exports.verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};