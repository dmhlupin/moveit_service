// routes/workplaces/index.js
// Сборка роутов рабочих мест (после 5.10.2).

const pages = require('./pages');
const offices = require('./offices');
const rooms = require('./rooms');
const workplaces = require('./workplaces');
const summary = require('./summary');

module.exports = {
  ...pages,
  ...offices,
  ...rooms,
  ...workplaces,
  ...summary,
};