// routes/settings/pages.js
// Страница «Системные настройки» (только admin).
// 5.11.5: бэкап базы данных.

const fs = require('fs');
const path = require('path');
const { renderPageFor } = require('../../utils/layout');

async function renderSettings(req, res) {
  try {
    const htmlPath = path.join(__dirname, '..', '..', 'views', 'admin-settings.html');
    const content = fs.readFileSync(htmlPath, 'utf8');

    renderPageFor(req, res, {
      title: 'Системные настройки – MoveIT service',
      content,
      pageJs: '/js/admin-settings.js',
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки настроек:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
}

module.exports = { renderSettings };