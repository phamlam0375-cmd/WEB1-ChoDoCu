
'use strict';

const { Op } = require('sequelize');
const elasticClient = require('../config/elasticsearch');
const {
    Listings,
    Categories,
    Users,
    ListingMedia,
    ListingPromotions
} = require('../models');


const normalizeVietnamese = (text) => {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
};
const searchListings = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập từ khóa tìm kiếm'
            });
        }

        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

        const normalizedQuery = normalizeVietnamese(q);
        const isShortSingleWordQuery =
            normalizedQuery.length >= 2 &&
            !/\s/.test(normalizedQuery);
        const searchOptions = {
            index: 'products',
            from: (page - 1) * limit,
            size: limit,
        };
        let result;

        if (isShortSingleWordQuery) {
            result = await elasticClient.search({
                ...searchOptions,
                query: {
                    bool: {
                        must: [{
                            match_bool_prefix: {
                                TitleNormalized: normalizedQuery
                            }
                        }],
                        filter: [
                            { term: { 'Status.keyword': 'ACTIVE' } }
                        ]
                    }
                }
            });
        }

        const shortQueryTotal = typeof result?.hits.total === 'number'
            ? result.hits.total
            : result?.hits.total?.value || 0;

        if (!result || shortQueryTotal === 0) {
            result = await elasticClient.search({
                ...searchOptions,
                query: {
                    bool: {
                        must: [{
                            bool: {
                                should: [
                                    {
                                        multi_match: {
                                            query: q,
                                            fields: [
                                                'Title^3',
                                                'Description',
                                                'CategoryName^2'
                                            ],
                                            operator: 'and'
                                        }
                                    },
                                    {
                                        multi_match: {
                                            query: normalizedQuery,
                                            fields: [
                                                'TitleNormalized^3',
                                                'DescriptionNormalized',
                                                'CategoryNameNormalized^2'
                                            ],
                                            operator: 'and'
                                        }
                                    }
                                ],
                                minimum_should_match: 1
                            }
                        }],
                        filter: [
                            { term: { 'Status.keyword': 'ACTIVE' } }
                        ]
                    }
                }
            });
        }

        // Nếu không tìm thấy kết quả chính xác,
        // thử tìm gần đúng để xử lý lỗi chính tả.
        const exactTotal = typeof result.hits.total === 'number'
            ? result.hits.total
            : result.hits.total?.value || 0;

        if (exactTotal === 0) {
            result = await elasticClient.search({
                ...searchOptions,
                query: {
                    bool: {
                        must: [
                            {
                                bool: {
                                    should: [
                                        {
                                            multi_match: {
                                                query: normalizedQuery,
                                                fields: [
                                                    'TitleNormalized^5',
                                                    'DescriptionNormalized',
                                                    'CategoryNameNormalized^2'
                                                ],
                                                fuzziness: 'AUTO',
                                                prefix_length: 0,
                                                operator: 'and'
                                            }
                                        },
                                        {
                                            multi_match: {
                                                query: q,
                                                fields: [
                                                    'Title^5',
                                                    'Description',
                                                    'CategoryName^2'
                                                ],
                                                fuzziness: 'AUTO',
                                                prefix_length: 0,
                                                operator: 'and'
                                            }
                                        }
                                    ],
                                    minimum_should_match: 1
                                }
                            }
                        ],
                        filter: [
                            { term: { 'Status.keyword': 'ACTIVE' } }
                        ]
                    }
                }
            });
        }
        const ids = result.hits.hits.map(hit => hit._source.ListingId);

        const listings = await Listings.findAll({
            where: {
                ListingId: { [Op.in]: ids },
                Status: 'ACTIVE'
            },
            include: [
                {
                    model: Categories,
                    as: 'Category',
                    attributes: ['CategoryId', 'CategoryName']
                },
                {
                    model: Users,
                    as: 'Seller',
                    attributes: ['UserId', 'FullName', 'EmailVerified', 'AvatarUrl']
                },
                {
                    model: ListingMedia,
                    as: 'Media',
                    attributes: ['MediaId', 'MediaUrl', 'MediaType', 'SortOrder'],
                    separate: true,
                    order: [['SortOrder', 'ASC']]
                },
                {
                    model: ListingPromotions,
                    as: 'Promotions',
                    attributes: ['PromotionId', 'StartsAt', 'EndsAt'],
                    required: false,
                    where: {
                        Status: 'ACTIVE',
                        StartsAt: { [Op.lte]: new Date() },
                        EndsAt: { [Op.gt]: new Date() },
                    },
                }
            ]
        });

        const listingMap = new Map(
            listings.map(item => [String(item.ListingId), item])
        );

        const sortedListings = ids
            .map(id => listingMap.get(String(id)))
            .filter(Boolean);

        const total = typeof result.hits.total === 'number'
            ? result.hits.total
            : result.hits.total?.value || 0;

        return res.status(200).json({
            success: true,
            message: 'Tìm kiếm sản phẩm thành công',
            data: sortedListings,
            pagination: {
                page,
                limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit)
            }
        });

   } catch (error) {
    console.error('Elasticsearch search error:', error.message);

    const elasticUnavailable = [
        'ConnectionError',
        'TimeoutError',
        'NoLivingConnectionsError'
    ].includes(error.name);

    return res.status(elasticUnavailable ? 503 : 500).json({
        success: false,
        message: elasticUnavailable
            ? 'Hệ thống tìm kiếm tạm thời không khả dụng. Vui lòng thử lại sau.'
            : 'Lỗi tìm kiếm sản phẩm'
    });
}
};

module.exports = { searchListings };
