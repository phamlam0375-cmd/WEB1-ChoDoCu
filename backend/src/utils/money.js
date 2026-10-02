'use strict';

function toCents(value) {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new TypeError('Invalid money value');
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function fromCents(value) {
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function addMoney(first, second) {
  return fromCents(toCents(first) + toCents(second));
}

function asApiNumber(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric * 100) ? numeric : String(value);
}

module.exports = { addMoney, asApiNumber };
