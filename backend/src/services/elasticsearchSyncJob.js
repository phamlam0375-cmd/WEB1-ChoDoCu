'use strict';

const { syncAllListings } = require('./elasticsearch.service');

let running = false;

async function runSync() {
    if (running) return;

    running = true;

    try {
        const result = await syncAllListings();

        console.log(`[Elasticsearch] Cập nhật ${result.total}, không đổi ${result.unchanged}, xóa ${result.removed}`);
    } catch (error) {
        console.error(
            '[Elasticsearch] Đồng bộ thất bại:',
            error.message
        );
    } finally {
        running = false;
    }
}

function startElasticsearchSyncJob() {
    // Đồng bộ lần đầu khi khởi động
    runSync();

    // Sau đó đồng bộ mỗi 30 giây
    return setInterval(runSync, 30 * 1000);
}

module.exports = { startElasticsearchSyncJob };