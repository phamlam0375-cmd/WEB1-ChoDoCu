'use strict';
// Lựa chọn triển khai: tái sử dụng TTL/cooldown/lượt sai D08; thêm hạn mức cấp lại.
module.exports = Object.freeze({ codeTtlSeconds: 600, cooldownSeconds: 60, maxAttempts: 5, issueWindowSeconds: 3600, maxIssuesPerWindow: 5 });
