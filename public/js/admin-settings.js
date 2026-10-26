// public/js/admin-settings.js
// 5.11.5: бэкап базы данных.

async function downloadBackup() {
    const btn = document.getElementById('backupBtn');
    const result = document.getElementById('backupResult');
    if (!btn || !result) return;

    btn.disabled = true;
    btn.textContent = '⏳ Создание бэкапа...';
    result.innerHTML = '';

    try {
        const response = await fetch('/api/admin/backup/download', {
            method: 'GET',
            credentials: 'same-origin',
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        // Имя файла из Content-Disposition
        const cd = response.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename="?([^";]+)"?/);
        const filename = match ? match[1] : `moveit-backup-${Date.now()}.db`;

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        result.innerHTML = `
            <div style="padding: var(--space-sm) var(--space-md); background: var(--success-bg); border-left: 3px solid var(--success); border-radius: var(--radius-sm); color: var(--text-primary);">
                ✅ Бэкап скачан: <strong>${filename}</strong>
            </div>
        `;

        if (typeof showToast === 'function') {
            showToast('✅ Бэкап готов', 'success');
        }
    } catch (error) {
        console.error('Ошибка бэкапа:', error);
        result.innerHTML = `
            <div style="padding: var(--space-sm) var(--space-md); background: var(--danger-bg); border-left: 3px solid var(--danger); border-radius: var(--radius-sm); color: var(--text-primary);">
                ❌ ${error.message}
            </div>
        `;
        if (typeof showToast === 'function') {
            showToast('❌ Не удалось создать бэкап', 'error');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '📥 Скачать бэкап базы';
    }
}