"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Op } = require("sequelize");
const { Listings } = require("../src/models");
const elasticClient = require("../src/config/elasticsearch");
const { getAllListing } = require("../src/controllers/listing.controller");
const { searchListings } = require("../src/controllers/search.controller");

const publicStatuses = ["ACTIVE", "RESERVED", "SOLD"];

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("public listing pages include active, reserved, and sold listings", async (t) => {
  let query;
  t.mock.method(Listings, "findAndCountAll", async (options) => {
    query = options;
    return {
      count: 3,
      rows: publicStatuses.map((Status, index) => ({
        ListingId: index + 1,
        Status,
      })),
    };
  });

  const response = createResponse();
  await getAllListing({ query: { page: "1", limit: "2" } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query.where.Status[Op.in], publicStatuses);
  assert.equal(response.body.pagination.totalItems, 3);
  assert.equal(response.body.pagination.totalPages, 2);
});

test("listing search preserves active-only filtering in Elasticsearch and database", async (t) => {
  let searchRequest;
  let listingQuery;
  t.mock.method(elasticClient, "search", async (request) => {
    searchRequest = request;
    return {
      hits: {
        total: { value: 1 },
        hits: [{ _source: { ListingId: 7 } }],
      },
    };
  });
  t.mock.method(Listings, "findAll", async (options) => {
    listingQuery = options;
    return [{ ListingId: 7, Status: "ACTIVE" }];
  });

  const response = createResponse();
  await searchListings({ query: { q: "điện thoại", page: "1", limit: "10" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(searchRequest.query.bool.filter[0].term["Status.keyword"], "ACTIVE");
  assert.equal(listingQuery.where.Status, "ACTIVE");
  assert.deepEqual(response.body.data.map((listing) => listing.Status), ["ACTIVE"]);
});

test("short partial searches prioritize title prefixes over category matches", async (t) => {
  const searchRequests = [];
  t.mock.method(elasticClient, "search", async (request) => {
    searchRequests.push(request);
    return {
      hits: {
        total: { value: 1 },
        hits: [{ _source: { ListingId: 42 } }],
      },
    };
  });
  t.mock.method(Listings, "findAll", async (options) => {
    assert.deepEqual(options.where.ListingId[Op.in], [42]);
    return [{ ListingId: 42, Title: "Áo Messi", Status: "ACTIVE" }];
  });

  const response = createResponse();
  await searchListings({ query: { q: "me", page: "1", limit: "10" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(searchRequests.length, 1);
  assert.equal(
    searchRequests[0].query.bool.must[0].match_bool_prefix.TitleNormalized,
    "me",
  );
  assert.equal(searchRequests[0].query.bool.filter[0].term["Status.keyword"], "ACTIVE");
  assert.deepEqual(response.body.data.map((listing) => listing.Title), ["Áo Messi"]);
});

test("single-word prefixes of any length match product titles", async (t) => {
  const searchRequests = [];
  t.mock.method(elasticClient, "search", async (request) => {
    searchRequests.push(request);
    return {
      hits: {
        total: { value: 1 },
        hits: [{ _source: { ListingId: 43 } }],
      },
    };
  });
  t.mock.method(Listings, "findAll", async () => [
    { ListingId: 43, Title: "Áo Ronaldo", Status: "ACTIVE" },
  ]);

  const response = createResponse();
  await searchListings({ query: { q: "ronal", page: "1", limit: "10" } }, response);

  assert.equal(searchRequests.length, 1);
  assert.equal(
    searchRequests[0].query.bool.must[0].match_bool_prefix.TitleNormalized,
    "ronal",
  );
  assert.deepEqual(response.body.data.map((listing) => listing.Title), ["Áo Ronaldo"]);
});

test("fuzzy fallback corrects transposed letters across indexed product fields", async (t) => {
  const searchRequests = [];
  t.mock.method(elasticClient, "search", async (request) => {
    searchRequests.push(request);
    if (searchRequests.length < 3) {
      return { hits: { total: { value: 0 }, hits: [] } };
    }

    return {
      hits: {
        total: { value: 1 },
        hits: [{ _source: { ListingId: 44 } }],
      },
    };
  });
  t.mock.method(Listings, "findAll", async () => [
    { ListingId: 44, Title: "Áo Ronaldo", Status: "ACTIVE" },
  ]);

  const response = createResponse();
  await searchListings({ query: { q: "roanldo", page: "1", limit: "10" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(searchRequests.length, 3);
  const fuzzyQuery = searchRequests[2].query.bool.must[0].bool.should;
  assert.deepEqual(fuzzyQuery[0].multi_match.fields, [
    "TitleNormalized^5",
    "DescriptionNormalized",
    "CategoryNameNormalized^2",
  ]);
  assert.equal(fuzzyQuery[0].multi_match.fuzziness, "AUTO");
  assert.equal(fuzzyQuery[0].multi_match.prefix_length, 0);
  assert.deepEqual(response.body.data.map((listing) => listing.Title), ["Áo Ronaldo"]);
});
