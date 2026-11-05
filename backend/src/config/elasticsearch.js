
'use strict';

const { Client } = require('@elastic/elasticsearch');

const elasticClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

module.exports = elasticClient;
