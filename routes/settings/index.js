// routes/settings/index.js
const pages = require('./pages');
const api = require('./api');

module.exports = {
  ...pages,
  ...api,
};