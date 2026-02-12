const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const { authenticateToken } = require('../middlewares/auth');

// 팔로우 / 언팔로우
router.post('/:userId', authenticateToken, followController.follow);
router.delete('/:userId', authenticateToken, followController.unfollow);

// 특정 유저의 팔로워/팔로잉 목록 (공개)
router.get('/followers/:userId', followController.getFollowers);
router.get('/following/:userId', followController.getFollowing);

// 내 팔로워/팔로잉 목록 (편의용, 토큰 필요)
router.get('/me/followers', authenticateToken, followController.getMyFollowers);
router.get('/me/following', authenticateToken, followController.getMyFollowing);

module.exports = router;

