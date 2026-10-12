'use strict';
const zlib = require('node:zlib');
const jpeg = require('jpeg-js');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const content = Buffer.concat([Buffer.from(name), data]), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(content));
  return Buffer.concat([size, content, crc]);
}
function pngReceipt() {
  const header = Buffer.alloc(13); header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
  const row = Buffer.from([0, 20, 150, 70, 255, 20, 150, 70, 255]);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat([row, row]))), chunk('IEND', Buffer.alloc(0))]);
}
const jpgReceipt = () => jpeg.encode({ width: 2, height: 2, data: Buffer.alloc(16, 255) }, 80).data;
module.exports = { pngReceipt, jpgReceipt };
