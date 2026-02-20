/**
 * 카카오 지도/로컬 REST API 설정
 * @see https://developers.kakao.com/docs/latest/ko/local/dev-guide
 */

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';
const KAKAO_BASE_URL = 'https://dapi.kakao.com';

function isConfigured() {
  return Boolean(KAKAO_REST_API_KEY && KAKAO_REST_API_KEY.trim());
}

function getHeaders() {
  return {
    Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

module.exports = {
  KAKAO_REST_API_KEY,
  KAKAO_BASE_URL,
  isConfigured,
  getHeaders
};
