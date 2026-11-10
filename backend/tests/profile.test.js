"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const app = require("../src/app");
const { Users } = require("../src/models");

const profile = {
  UserId: 315,
  FullName: "Test User",
  Email: "test@example.test",
  Phone: null,
  Address: null,
  AvatarUrl: null,
  Status: "ACTIVE",
  Roles: [{ RoleName: "USER" }],
  update: async function (values) {
    Object.assign(this, values);
    return this;
  },
};

async function setup(t, findOne = async () => null) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_DEV_HEADER: process.env.AUTH_DEV_HEADER,
  };
  process.env.NODE_ENV = "development";
  process.env.AUTH_DEV_HEADER = "true";
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  t.mock.method(Users, "findByPk", async (id) => id === profile.UserId ? profile : null);
  t.mock.method(Users, "findOne", findOne);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const request = async (body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/me`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-user-id": String(profile.UserId) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { request };
}

test("PATCH /me updates only the authenticated user's editable profile fields", async (t) => {
  const { request } = await setup(t);
  const result = await request({
    fullName: "Updated User",
    phone: "+84 901-234-567",
    address: "District 1",
    avatarUrl: "/api/v1/uploads/avatar-123.png",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.data.UserId, profile.UserId);
  assert.equal(result.body.data.FullName, "Updated User");
  assert.equal(result.body.data.Phone, "+84901234567");
  assert.equal(result.body.data.Address, "District 1");
  assert.equal(result.body.data.AvatarUrl, "/api/v1/uploads/avatar-123.png");
  assert.equal(result.body.data.Email, profile.Email);
})

test("PATCH /me refuses email changes and duplicate phone numbers", async (t) => {
  const { request } = await setup(t, async () => ({ UserId: 999 }));

  const emailChange = await request({
    fullName: "Updated User",
    phone: "",
    address: "",
    email: "other@example.test",
  });
  assert.equal(emailChange.status, 400);

  const duplicatePhone = await request({
    fullName: "Updated User",
    phone: "0901234567",
    address: "",
  });
  assert.equal(duplicatePhone.status, 409);
})
