/**
 * Rate sheet parser registry.
 * Each parser module exports: parseRates, parseLLPAs, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const everstream = require('./everstream');
const tls = require('./tls');
const keystone = require('./keystone');
const swmc = require('./swmc');
const amwest = require('./amwest');
const windsor = require('./windsor');

const parsers = { everstream, tls, keystone, swmc, amwest, windsor };

function getParser(lenderId) {
  return parsers[lenderId] || null;
}

module.exports = { parsers, getParser };
