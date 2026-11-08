
'use strict';

const elasticClient = require('../config/elasticsearch');
const { Listings, Categories } = require('../models');

const INDEX_NAME = 'products';

// Chuyển tiếng Việt có dấu thành không dấu
const normalizeVietnamese = (text) => {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
};

// Đồng bộ một sản phẩm
async function syncListing(listingId) {
    const listing = await Listings.findByPk(listingId, {
        include: [{
            model: Categories,
            as: 'Category',
            attributes: ['CategoryName']
        }]
    });

    // Sản phẩm không tồn tại hoặc không còn ACTIVE
    if (!listing || listing.Status !== 'ACTIVE') {
        await removeListing(listingId);
        return;
    }

    await elasticClient.index({
        index: INDEX_NAME,
        id: String(listing.ListingId),
        document: {
            ListingId: listing.ListingId,
            Title: listing.Title,
            TitleNormalized: normalizeVietnamese(listing.Title),

            Description: listing.Description || '',
            DescriptionNormalized: normalizeVietnamese(
                listing.Description
            ),

            Price: Number(listing.Price),
            CategoryId: listing.CategoryId,

            CategoryName: listing.Category?.CategoryName || '',
            CategoryNameNormalized: normalizeVietnamese(
                listing.Category?.CategoryName
            ),

            Status: listing.Status,
            Location: listing.Location || ''
        }
    });
}

// Xóa sản phẩm khỏi Elasticsearch
async function removeListing(listingId) {
    try {
        await elasticClient.delete({
            index: INDEX_NAME,
            id: String(listingId)
        });
    } catch (error) {
        if (error.meta?.statusCode !== 404) {
            throw error;
        }
    }
}

// Đồng bộ toàn bộ sản phẩm từ MySQL

async function syncAllListings() {
    const listings = await Listings.findAll({
        where: { Status: 'ACTIVE' },
        include: [{
            model: Categories,
            as: 'Category',
            attributes: ['CategoryName']
        }]
    });

    const activeIds = new Set();
    let synced = 0;
    let unchanged = 0;
    let removed = 0;

    for (const listing of listings) {
        const id = String(listing.ListingId);
        activeIds.add(id);

        const document = {
            ListingId: listing.ListingId,
            Title: listing.Title,
            TitleNormalized: normalizeVietnamese(listing.Title),
            Description: listing.Description || '',
            DescriptionNormalized: normalizeVietnamese(listing.Description),
            Price: Number(listing.Price),
            CategoryId: listing.CategoryId,
            CategoryName: listing.Category?.CategoryName || '',
            CategoryNameNormalized: normalizeVietnamese(
                listing.Category?.CategoryName
            ),
            Status: listing.Status,
            Location: listing.Location || ''
        };

        let existing = null;

        try {
            const result = await elasticClient.get({
                index: INDEX_NAME,
                id
            });
            existing = result._source;
        } catch (error) {
            if (error.meta?.statusCode !== 404) {
                throw error;
            }
        }

        if (
            existing &&
            Object.keys(document).every(
                key => existing[key] === document[key]
            )
        ) {
            unchanged++;
            continue;
        }

        await elasticClient.index({
            index: INDEX_NAME,
            id,
            document
        });

        synced++;
    }

    // Lấy ID hiện có trong Elasticsearch
    const indexedIds = new Set();
    let searchAfter;

    while (true) {
        const response = await elasticClient.search({
            index: INDEX_NAME,
            size: 500,
            _source: ['ListingId'],
            sort: [{ ListingId: 'asc' }],
            ...(searchAfter
                ? { search_after: searchAfter }
                : {}),
            query: { match_all: {} }
        });

        const hits = response.hits.hits;

        if (hits.length === 0) break;

        for (const hit of hits) {
            indexedIds.add(String(hit._id));
        }

        if (hits.length < 500) break;

        searchAfter = hits[hits.length - 1].sort;
    }

    // Xóa sản phẩm không còn ACTIVE
    for (const id of indexedIds) {
        if (!activeIds.has(id)) {
            await removeListing(id);
            removed++;
        }
    }

    // Chỉ refresh khi có thay đổi
    if (synced > 0 || removed > 0) {
        await elasticClient.indices.refresh({
            index: INDEX_NAME
        });
    }

    return {
        success: true,
        total: synced,
        unchanged,
        removed
    };
}


module.exports = {
    syncListing,
    removeListing,
    syncAllListings
};
