// Express 5 để req.body là undefined khi request không có body JSON.
// Gán object rỗng để controller đọc req.body.xxx không bị lỗi 500; phần kiểm tra
// dữ liệu bắt buộc sẽ trả lỗi 400 như bình thường.
function ensureBody(req, _res, next) {
  if (req.body === undefined || req.body === null) req.body = {};
  next();
}

module.exports = { ensureBody };
