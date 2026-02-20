/**
 * 카카오 로컬 REST API 호출 서비스
 * - 키워드로 장소 검색
 * - 주소 검색(좌표 변환)
 * - 좌표 → 주소 변환
 */

const { KAKAO_BASE_URL, isConfigured, getHeaders } = require('../config/kakao');

async function searchByKeyword(query, options = {}) {
  if (!isConfigured()) {
    throw new Error('KAKAO_REST_API_KEY가 설정되지 않았습니다.');
  }
  const { page = 1, size = 15, x, y, radius } = options;
  const params = new URLSearchParams({
    query: String(query).trim(),
    page: String(page),
    size: String(Math.min(Number(size) || 15, 30))
  });
  if (x != null && y != null) {
    params.set('x', String(x));
    params.set('y', String(y));
    if (radius != null) params.set('radius', String(radius));
  }
  const url = `${KAKAO_BASE_URL}/v2/local/search/keyword.json?${params}`;
  const res = await fetch(url, { headers: getHeaders() });
  const data = await res.json();
  if (data.error_type) {
    const msg = data.message || data.error_type;
    throw new Error(msg);
  }
  return data;
}

async function searchByAddress(query, options = {}) {
  if (!isConfigured()) {
    throw new Error('KAKAO_REST_API_KEY가 설정되지 않았습니다.');
  }
  const { page = 1, size = 10 } = options;
  const params = new URLSearchParams({
    query: String(query).trim(),
    page: String(page),
    size: String(Math.min(Number(size) || 10, 30))
  });
  const url = `${KAKAO_BASE_URL}/v2/local/search/address.json?${params}`;
  const res = await fetch(url, { headers: getHeaders() });
  const data = await res.json();
  if (data.error_type) {
    const msg = data.message || data.error_type;
    throw new Error(msg);
  }
  return data;
}

async function coord2Address(lng, lat) {
  if (!isConfigured()) {
    throw new Error('KAKAO_REST_API_KEY가 설정되지 않았습니다.');
  }
  const x = String(lng).trim();
  const y = String(lat).trim();
  const params = new URLSearchParams({ x, y });
  const url = `${KAKAO_BASE_URL}/v2/local/geo/coord2address.json?${params}`;
  const res = await fetch(url, { headers: getHeaders() });
  const data = await res.json();
  if (data.error_type) {
    const msg = data.message || data.error_type;
    throw new Error(msg);
  }
  return data;
}

module.exports = {
  searchByKeyword,
  searchByAddress,
  coord2Address
};
