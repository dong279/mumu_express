/**
 * 카카오 지도/로컬 API 라우트
 * - GET /api/map/search?query=...  키워드 장소 검색
 * - GET /api/map/address?query=...  주소 검색
 * - GET /api/map/coord2address?lng=...&lat=...  좌표→주소
 */

const express = require('express');
const router = express.Router();
const { isConfigured } = require('../config/kakao');
const { searchByKeyword, searchByAddress, coord2Address } = require('../api/kakaoMap.service');

/** 키워드로 장소 검색 */
router.get('/search', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: '카카오 지도 API 키가 설정되지 않았습니다.'
      });
    }
    const query = req.query.query;
    if (!query || !String(query).trim()) {
      return res.status(400).json({ success: false, error: 'query 파라미터가 필요합니다.' });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const size = parseInt(req.query.size, 10) || 15;
    const x = req.query.x ? parseFloat(req.query.x) : undefined;
    const y = req.query.y ? parseFloat(req.query.y) : undefined;
    const radius = req.query.radius ? parseInt(req.query.radius, 10) : undefined;
    const data = await searchByKeyword(query, { page, size, x, y, radius });
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('kakao search:', error);
    res.status(500).json({
      success: false,
      error: error.message || '장소 검색 중 오류가 발생했습니다.'
    });
  }
});

/** 주소 검색(좌표 포함) */
router.get('/address', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: '카카오 지도 API 키가 설정되지 않았습니다.'
      });
    }
    const query = req.query.query;
    if (!query || !String(query).trim()) {
      return res.status(400).json({ success: false, error: 'query 파라미터가 필요합니다.' });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const size = parseInt(req.query.size, 10) || 10;
    const data = await searchByAddress(query, { page, size });
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('kakao address:', error);
    res.status(500).json({
      success: false,
      error: error.message || '주소 검색 중 오류가 발생했습니다.'
    });
  }
});

/** 좌표 → 주소 변환 */
router.get('/coord2address', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: '카카오 지도 API 키가 설정되지 않았습니다.'
      });
    }
    const lng = req.query.lng ?? req.query.x;
    const lat = req.query.lat ?? req.query.y;
    if (lng == null || lat == null || lng === '' || lat === '') {
      return res.status(400).json({
        success: false,
        error: 'lng(경도), lat(위도) 파라미터가 필요합니다.'
      });
    }
    const data = await coord2Address(lng, lat);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('kakao coord2address:', error);
    res.status(500).json({
      success: false,
      error: error.message || '좌표 변환 중 오류가 발생했습니다.'
    });
  }
});

/** API 키 설정 여부 확인 (프론트에서 지도 사용 전 체크용) */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    configured: isConfigured(),
    message: isConfigured()
      ? '카카오 지도 API가 연결되어 있습니다.'
      : 'KAKAO_REST_API_KEY를 설정해주세요.'
  });
});

module.exports = router;
