/** AI 서버가 결과 전달할 때만 사용. AI_WEBHOOK_SECRET 설정 시 헤더 검증 */
exports.verifyAiWebhook = (req, res, next) => {
  const secret = process.env.AI_WEBHOOK_SECRET;
  if (!secret) return next();
  const header = req.headers['x-ai-webhook-secret'];
  if (header !== secret) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  next();
};
