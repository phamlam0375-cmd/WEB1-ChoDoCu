"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Listings, ListingMedia, Users, Categories } = require("../src/models");
const { getListingId } = require("../src/controllers/sellerListing.controller");

test("listing detail includes seller, category, and ordered media", async (t) => {
  let query;
  const listing = {
    ListingId: 12,
    Seller: { UserId: 4, FullName: "Nguyen Van A" },
    Category: { CategoryId: 2, CategoryName: "Điện thoại" },
    Media: [{ MediaId: 8, MediaUrl: "/listings/phone.jpg", SortOrder: 1 }],
  };
  t.mock.method(Listings, "findOne", async (options) => {
    query = options;
    return listing;
  });

  const response = {
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

  await getListingId({ params: { ListingId: "12" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.Seller.FullName, "Nguyen Van A");
  assert.equal(response.body.data.Category.CategoryName, "Điện thoại");
  assert.equal(response.body.data.Media[0].MediaUrl, "/listings/phone.jpg");
  assert.equal(query.include[0].model, Users);
  assert.equal(query.include[0].as, "Seller");
  assert.deepEqual(query.include[0].attributes, ["UserId", "FullName", "EmailVerified", "AvatarUrl"]);
  assert.equal(query.include[1].model, Categories);
  assert.equal(query.include[2].model, ListingMedia);
  assert.equal(query.include[2].separate, true);
  assert.deepEqual(query.include[2].order, [["SortOrder", "ASC"]]);
});
