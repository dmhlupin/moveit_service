// public/js/manage-import.js

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('importFile');
    if (fileInput) {
        fileInput.addEventListener('change', onFileSelected);
    }

    const encodingSelect = document.getElementById('importEncoding');
    if (encodingSelect) {
        encodingSelect.addEventListener('change', () => {
            if (fileInput && fileInput.files.length > 0) {
                onFileSelected();
            }
        });
    }
});

// ============================================================
// ПРЕДПРОСМОТР
// ============================================================

async function onFileSelected() {
    const fileInput = document.getElementById('importFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        clearPreview();
        return;
    }

    const file = fileInput.files[0];
    const encoding = document.getElementById('importEncoding').value;

    try {
        const csvText = await readFileAsText(file, encoding);
        renderPreview(csvText);
    } catch (err) {
        console.error(err);
        showToast('❌ Ошибка чтения файла', 'error');
    }
}

function renderPreview(csvText) {
    const card = document.getElementById('importPreviewCard');
    const table = document.getElementById('previewTable');
    const info = document.getElementById('previewInfo');

    const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) {
        card.style.display = 'none';
        return;
    }

    const STANDARD_HEADERS = [
        'Корпоративный ИД', 'Наименование', 'Производитель',
        'Группа', 'Вид', 'Инвентарный номер', 'Конечный остаток', 'Описание'
    ];

    const firstLine = lines[0].toLowerCase();
    const hasHeaders = firstLine.includes('корпоративный ид') ||
                       firstLine.includes('model_corporate_id') ||
                       firstLine.includes('артикул');

    let headers;
    let dataLines;

    if (hasHeaders) {
        headers = lines[0].split(';').map(h => h.trim());
        dataLines = lines.slice(1);
    } else {
        headers = STANDARD_HEADERS;
        dataLines = lines;
    }

    const previewLines = dataLines.slice(0, 5);

    let html = '<thead><tr>';
    headers.forEach(h => { html += `<th>${escapeHtml(h)}</th>`; });
    html += '</tr></thead><tbody>';

    previewLines.forEach(line => {
        const values = line.split(';').map(v => v.trim());
        html += '<tr>';
        headers.forEach((_, idx) => {
            html += `<td>${escapeHtml(values[idx] || '')}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';

    table.innerHTML = html;

    const total = dataLines.length;
    const shown = previewLines.length;
    let infoText = `Всего строк данных: ${total}. Показано: ${shown}.`;
    if (hasHeaders) {
        infoText += ' Заголовки распознаны.';
    } else {
        infoText += ' Заголовков нет — стандартный порядок колонок.';
    }

    let warning = '';
    const previewText = previewLines.join(' ');
    if (previewText.includes('\uFFFD')) {
        warning = `
            <div class="preview-warning">
                ⚠️ Обнаружены символы замены (�). Попробуйте сменить кодировку.
            </div>
        `;
    }

    info.innerHTML = `<strong>${infoText}</strong>${warning}`;
    card.style.display = 'block';
}

function clearPreview() {
    const card = document.getElementById('importPreviewCard');
    if (card) card.style.display = 'none';
}

// ============================================================
// ИМПОРТ
// ============================================================

async function submitImport() {
    const molId = document.getElementById('importMol').value;
    const fileInput = document.getElementById('importFile');
    const encoding = document.getElementById('importEncoding').value;
    const skipDuplicates = document.getElementById('importSkipDuplicates').checked;
    const btn = document.getElementById('importSubmitBtn');

    if (!molId) {
        showToast('❌ Выберите МОЛа', 'error');
        return;
    }
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('❌ Выберите файл CSV', 'error');
        return;
    }

    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('❌ Файл должен быть в формате CSV', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Импорт...';

    try {
        const csvText = await readFileAsText(file, encoding);

        const response = await fetch('/api/manage/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                csvText,
                molId: parseInt(molId, 10),
                skipDuplicates,
            }),
        });

        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            renderReport(result.report, result.importId);
        } else {
            showToast('❌ ' + result.error, 'error');
            if (result.report) renderReport(result.report, null);
        }
    } catch (err) {
        console.error('❌ Ошибка импорта:', err);
        showToast('❌ Ошибка импорта: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📥 Импортировать';
    }
}

function renderReport(report, importId) {
    const card = document.getElementById('importReportCard');
    const body = document.getElementById('importReportBody');

    let html = `
        <div class="import-report-grid">
            <div class="import-report-item success">
                <div class="import-report-number">${report.equipment_created || 0}</div>
                <div class="import-report-label">Создано экземпляров</div>
            </div>
            <div class="import-report-item">
                <div class="import-report-number">${report.models_created || 0}</div>
                <div class="import-report-label">Создано моделей</div>
            </div>
            <div class="import-report-item">
                <div class="import-report-number">${report.categories_created || 0}</div>
                <div class="import-report-label">Создано категорий</div>
            </div>
            <div class="import-report-item">
                <div class="import-report-number">${report.types_created || 0}</div>
                <div class="import-report-label">Создано типов</div>
            </div>
            <div class="import-report-item warning">
                <div class="import-report-number">${report.skipped_duplicates || 0}</div>
                <div class="import-report-label">Пропущено дубликатов</div>
            </div>
            <div class="import-report-item ${report.errors.length > 0 ? 'danger' : 'success'}">
                <div class="import-report-number">${report.errors.length || 0}</div>
                <div class="import-report-label">Ошибок</div>
            </div>
        </div>
    `;

    if (report.errors && report.errors.length > 0) {
        html += `
            <div class="import-errors">
                <h4>❌ Ошибки (импорт откачен)</h4>
                <ul>
                    ${report.errors.map(e => `<li>Строка ${e.line}: ${escapeHtml(e.message)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    if (importId && report.equipment_created > 0) {
        html += `
            <div style="margin-top: 16px;">
                <button onclick="cancelLastImport('${importId}')" class="btn btn-danger">
                    🗑️ Отменить импорт
                </button>
            </div>
        `;
    }

    body.innerHTML = html;
    card.style.display = 'block';
}

async function cancelLastImport(importId) {
    if (!confirm('Удалить все данные, созданные этим импортом? Это действие нельзя отменить.')) {
        return;
    }

    try {
        const response = await fetch('/api/manage/import/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ importId }),
        });
        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            document.getElementById('importReportCard').style.display = 'none';
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('❌ Ошибка соединения', 'error');
    }
}

function downloadTemplate() {
    window.location.href = '/api/manage/import/template';
}

// ============================================================
// ЧТЕНИЕ ФАЙЛА
// ============================================================

function readFileAsText(file, encoding = 'windows-1251') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const bytes = new Uint8Array(e.target.result);

            if (encoding === 'utf-8') {
                resolve(new TextDecoder('utf-8').decode(bytes));
                return;
            }
            if (encoding === 'windows-1251') {
                resolve(new TextDecoder('windows-1251').decode(bytes));
                return;
            }

            const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            if (utf8Text.includes('\uFFFD')) {
                resolve(new TextDecoder('windows-1251').decode(bytes));
            } else {
                resolve(utf8Text);
            }
        };
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsArrayBuffer(file);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}