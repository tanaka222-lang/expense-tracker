/*
 * Практикум 14. Найпростіший сервер трекера витрат на вбудованому модулі http (без залежностей).
 *
 *  - роздає статичні файли застосунку (index.html, css/, script.js) з батьківської теки;
 *  - GET /api/transactions                 - усі локальні транзакції;
 *  - GET /api/transactions?category=Їжа    - фільтр за категорією безпосередньо на сервері;
 *  - GET /api/transactions/:id             - одна транзакція або 404.
 *
 * Статика і API працюють на одному порту (один origin), тож CORS не потрібен.
 * Запуск: npm start (або node server.js) у теці server/, далі http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, '..');             // корінь клієнтської частини
const HIDDEN_DIRS = ['server', '.git', 'node_modules', 'Звіти']; // службові теки не роздаємо

// локальні дані домену: 9 транзакцій у тій самій формі, що й у практикумах 6, 9, 11
const transactions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'transactions.json'), 'utf8'));

// Content-Type за розширенням файлу
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

// відповідь у форматі JSON з правильним заголовком і статус-кодом
function sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

// ---------- API ----------

function handleApi(req, res, url) {
    if (req.method !== 'GET') {
        return sendJson(res, 405, { error: `Метод ${req.method} не підтримується` });
    }

    // /api/transactions/7 -> ['api', 'transactions', '7']
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[1] !== 'transactions' || parts.length > 3) {
        return sendJson(res, 404, { error: `Ендпоінт ${url.pathname} не знайдено` });
    }

    // GET /api/transactions/:id
    if (parts.length === 3) {
        const item = transactions.find((t) => String(t.id) === parts[2]);

        if (!item) {
            return sendJson(res, 404, { error: `Транзакцію з id ${parts[2]} не знайдено` });
        }
        return sendJson(res, 200, item);
    }

    // GET /api/transactions?category=... - фільтр виконується на сервері, без урахування регістру
    const category = (url.searchParams.get('category') || '').trim();

    if (category) {
        const wanted = category.toLowerCase();
        const filtered = transactions.filter((t) => t.category.toLowerCase() === wanted);
        return sendJson(res, 200, filtered);
    }

    // GET /api/transactions - увесь масив
    return sendJson(res, 200, transactions);
}

// ---------- статичні файли ----------

function serveStatic(req, res, url) {
    let pathname;

    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('400: некоректна адреса');
    }

    if (pathname.endsWith('/')) {
        pathname += 'index.html';
    }

    const filePath = path.join(PUBLIC_DIR, pathname);
    const relative = path.relative(PUBLIC_DIR, filePath);
    const topDir = relative.split(path.sep)[0];

    // захист: не виходимо за межі теки застосунку (../) і не віддаємо службові теки
    if (relative.startsWith('..') || path.isAbsolute(relative) || HIDDEN_DIRS.includes(topDir)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404: файл не знайдено');
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('404: файл не знайдено');
        }

        const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
    });
}

// ---------- сервер ----------

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // журнал запитів: метод, адреса і статус відповіді
    res.on('finish', () => {
        let shown = req.url;
        try {
            shown = decodeURI(req.url); // кирилиця в адресі читається в журналі
        } catch {
            // адреса з пошкодженим %-кодуванням виводиться як є
        }
        console.log(`${new Date().toLocaleTimeString('uk-UA')}  ${req.method} ${shown} -> ${res.statusCode}`);
    });

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        handleApi(req, res, url);
    } else {
        serveStatic(req, res, url);
    }
});

server.listen(PORT, () => {
    console.log(`Сервер запущено: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/transactions`);
});
