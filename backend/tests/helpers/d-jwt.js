'use strict';
module.exports = id => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const value = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 60 })}`;
  return `Bearer ${value}.${require('node:crypto').createHmac('sha256', process.env.JWT_SECRET).update(value).digest('base64url')}`;
};
