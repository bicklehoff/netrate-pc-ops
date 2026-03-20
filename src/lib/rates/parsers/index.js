/**
 * Rate sheet parser registry.
 * Each parser module exports: parseRates, parseLLPAs, parse, lenderId
 */

const everstream = require('./everstream');

const parsers = { everstream };

function getParser(lenderId) {
  return parsers[lenderId] || null;
}

module.exports = { parsers, getParser };
