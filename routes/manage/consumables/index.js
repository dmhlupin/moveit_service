// routes/manage/consumables/index.js
// ============================================================
// Сборка роутов /manage/consumables (5.16.2b).
//
// HTML:
//   GET /manage/consumables                → renderConsumablesPage
//
// JSON API (все — под requireRole(['admin','supervisor','mol'])):
//   POST   /manage/consumables/api/item-models
//   PUT    /manage/consumables/api/item-models/:id
//   DELETE /manage/consumables/api/item-models/:id
//   POST   /manage/consumables/api/items
//   PUT    /manage/consumables/api/items/:id
//   DELETE /manage/consumables/api/items/:id
//
// Подключение в server.js:
//   const consumables = require('./routes/manage/consumables');
//   app.get('/manage/consumables', requireRole(['admin','supervisor','mol']), consumables.renderPage);
//   app.use('/manage/consumables/api', requireRole(['admin','supervisor','mol']), consumables.apiRouter);
// ============================================================

const express = require('express');

const { renderConsumablesPage } = require('./pages');
const {
  createItemModelAPI,
  updateItemModelAPI,
  deleteItemModelAPI,
  createItemAPI,
  updateItemAPI,
  deleteItemAPI,
  listItemModelsAPI,      // 🆕
  getItemAPI,             // 🆕
} = require('./api');

// ---------- API-роутер ----------
const apiRouter = express.Router();

// GET (для модалки)
apiRouter.get('/item-models',     listItemModelsAPI);
apiRouter.get('/items/:id',       getItemAPI);

// POST / PUT / DELETE
apiRouter.post('/item-models',     createItemModelAPI);
apiRouter.put('/item-models/:id',  updateItemModelAPI);
apiRouter.delete('/item-models/:id', deleteItemModelAPI);

apiRouter.post('/items',      createItemAPI);
apiRouter.put('/items/:id',   updateItemAPI);
apiRouter.delete('/items/:id', deleteItemAPI);

module.exports = {
  renderPage: renderConsumablesPage,
  apiRouter,
};