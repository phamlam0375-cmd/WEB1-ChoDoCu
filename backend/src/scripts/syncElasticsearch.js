
'use strict';

const { sequelize } = require('../models');
const elasticClient = require('../config/elasticsearch');
const { syncAllListings } = require('../services/elasticsearch.service');

async function main() {
    try {
        await sequelize.authenticate();
        console.log('Đã kết nối MySQL');

        await elasticClient.ping();
        console.log('Đã kết nối Elasticsearch');

        const result = await syncAllListings();

        console.log(`Đồng bộ hoàn tất: cập nhật ${result.total}, không đổi ${result.unchanged}, xóa ${result.removed}`);
    } catch (error) {
        console.error('Lỗi đồng bộ:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
        await elasticClient.close();
    }
}

main();
