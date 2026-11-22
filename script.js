/*
 * Практикум 10. Обрано Vue 3 і підключено через CDN: потрібен лише один тег script,
 * розмітка лишається звичайним HTML, без JSX і без Babel, тому сторінка працює
 * без збірки й Node.js.
 *
 * Практикум 11. Дані застосунку зберігаються між перезавантаженнями сторінки:
 * спершу через localStorage (JSON.stringify/parse), далі - в IndexedDB
 * (сховище "transactions", keyPath "id", autoIncrement). Під час першого запуску
 * виконується одноразова міграція записів з localStorage в IndexedDB.
 *
 * Практикум 12. Кругова діаграма розподілу витрат за категоріями на Canvas:
 * сектори малюються через ctx.arc() за даними агрегації byCategory, поява секторів
 * анімується циклом requestAnimationFrame після кожної зміни даних.
 *
 * Практикум 13. Застосунок перетворено на SPA з hash-based маршрутизацією без фреймворку:
 * «/» - останні операції та форма, «/category/:category» - витрати однієї категорії,
 * «/stats» - агрегація за категоріями з діаграмою. Роутер (таблиця маршрутів, matchRoute,
 * navigate, hashchange) написано вручну в кінці файлу, а Vue лише рендерить обрану сторінку.
 *
 * Практикум 14. Секція «Транзакції з локального сервера» отримує дані з власного Node.js-сервера
 * (server/server.js): GET /api/transactions і GET /api/transactions?category=... замість
 * JSONPlaceholder. Патерн запиту той самий: async/await + response.ok + try/catch.
 *
 * Практикум 15. Аудит безпеки (див. README.md): дані користувача й API ніколи не підставляються
 * в innerHTML - лише через textContent, createElement чи інтерполяцію Vue {{ }}, яка екранує HTML.
 */

// ---------- Практикум 11: модель даних і ключі сховищ ----------

const DB_NAME = 'expense-tracker-db';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

const LS_DATA_KEY = 'expense-tracker-operations';
const LS_MIGRATED_KEY = 'expense-tracker-migrated';

// початкові дані для першого запуску: id присвоює IndexedDB (autoIncrement)
const DEFAULT_OPERATIONS = [
    { amount: 2000, type: 'дохід', category: 'Стипендія', date: '2026-10-01' },
    { amount: 150, type: 'витрата', category: 'Їжа', date: '2026-10-02' },
    { amount: 30, type: 'витрата', category: 'Транспорт', date: '2026-10-02' },
    { amount: 250, type: 'витрата', category: 'Розваги', date: '2026-10-03' },
    { amount: 500, type: 'дохід', category: 'Підробіток', date: '2026-10-04' },
    { amount: 90, type: 'витрата', category: 'Їжа', date: '2026-10-05' },
];

// ---------- Крок 2: збереження в localStorage ----------

// записує масив операцій у localStorage рядком JSON
function saveToLocalStorage(items) {
    try {
        localStorage.setItem(LS_DATA_KEY, JSON.stringify(items));
    } catch (error) {
        console.error('Не вдалося записати дані в localStorage:', error);
    }
}

// читає масив операцій з localStorage; пошкоджений JSON не має ламати застосунок
function loadFromLocalStorage() {
    const raw = localStorage.getItem(LS_DATA_KEY);

    if (!raw) {
        return [];
    }

    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Пошкоджені дані в localStorage, список починається з порожнього:', error);
        return [];
    }
}

// ---------- Кроки 5-7: IndexedDB ----------

// з'єднання з базою відкривається один раз і далі перевикористовується
let dbPromise = null;

// відкриває базу; object store створюється лише в onupgradeneeded
function openDB() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('IndexedDB не підтримується цим браузером'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                console.log(`Створено object store "${STORE_NAME}"`);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null; // наступний виклик спробує відкрити базу знову
            reject(request.error);
        };
    });

    return dbPromise;
}

// спільна функція запису: put() і створює новий запис, і оновлює наявний з тим самим id
async function putItem(item) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const request = transaction.objectStore(STORE_NAME).put(item);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// додає новий запис без id: ключ присвоює autoIncrement, функція повертає новий id
function addItem(item) {
    const record = { ...item };
    delete record.id;
    return putItem(record);
}

// оновлює наявний запис: id обов'язковий, дубліката не створюється
function updateItem(item) {
    if (item.id === undefined) {
        return Promise.reject(new Error('updateItem: у записі немає id'));
    }
    return putItem(item);
}

// повертає всі записи сховища
async function getAllItems() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// видаляє запис за ключем
async function deleteItem(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const request = transaction.objectStore(STORE_NAME).delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ---------- Крок 8: одноразова міграція localStorage -> IndexedDB ----------

async function migrateFromLocalStorage() {
    if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') {
        return;
    }

    const stored = await getAllItems();

    if (stored.length > 0) {
        localStorage.setItem(LS_MIGRATED_KEY, 'true');
        return;
    }

    // перший запуск: якщо в localStorage порожньо, кладемо туди початкові дані
    let items = loadFromLocalStorage();

    if (items.length === 0) {
        items = DEFAULT_OPERATIONS;
        saveToLocalStorage(items);
    }

    for (const item of items) {
        await addItem(item); // ключ присвоїть autoIncrement
    }

    localStorage.setItem(LS_MIGRATED_KEY, 'true');
    console.log(`Міграція з localStorage в IndexedDB: перенесено записів ${items.length}`);
}

// ---------- Практикум 12: кругова діаграма на Canvas ----------

const PIE_SIZE = 300;            // логічний розмір полотна, як у атрибутах width/height
const PIE_DURATION = 700;        // тривалість анімації появи секторів, мс
const PIE_HOVER_SHIFT = 10;      // наскільки виділений сектор висувається назовні, px
const PIE_COLORS = ['#ea580c', '#2563eb', '#7c3aed', '#0d9488', '#db2777', '#ca8a04', '#64748b'];

// контекст не кладемо в реактивні дані Vue: проксі ламає виклики методів canvas
let pieCtx = null;

// плавне сповільнення в кінці анімації: t від 0 до 1
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// геометрія діаграми в логічних координатах полотна
function pieGeometry() {
    const radius = PIE_SIZE / 2 - PIE_HOVER_SHIFT - 4;
    return { cx: PIE_SIZE / 2, cy: PIE_SIZE / 2, radius, inner: radius * 0.55 };
}

// малює один кадр: progress - яка частка кола вже «розгорнута» (0..1),
// hoverIndex - номер виділеного сектора або -1
function drawPie(ctx, slices, progress, hoverIndex) {
    const { cx, cy, radius, inner } = pieGeometry();
    const dpr = window.devicePixelRatio || 1;
    const total = slices.reduce((sum, slice) => sum + slice.sum, 0);

    // масштаб під щільність пікселів екрана, далі працюємо в логічних px
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // очищення обов'язкове: інакше новий кадр накладається на попередній
    ctx.clearRect(0, 0, PIE_SIZE, PIE_SIZE);

    if (total === 0) {
        return;
    }

    let start = -Math.PI / 2; // перший сектор починається зверху, «о 12-й»

    slices.forEach((slice, index) => {
        const angle = (slice.sum / total) * Math.PI * 2 * progress;

        // save/restore: зсув виділеного сектора не впливає на інші сектори
        ctx.save();

        if (index === hoverIndex) {
            const middle = start + angle / 2;
            ctx.translate(Math.cos(middle) * PIE_HOVER_SHIFT, Math.sin(middle) * PIE_HOVER_SHIFT);
        }

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();
        start += angle;
    });

    // отвір у центрі (кільцева діаграма) і підпис
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const active = slices[hoverIndex];
    const title = active ? active.category : 'Усього витрат';
    const value = active ? `${active.percent} %` : `${Math.round(total * progress)} грн`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#475467';
    ctx.font = '600 14px Inter, "Segoe UI", Arial, sans-serif';
    ctx.fillText(title, cx, cy - 14, inner * 1.8);
    ctx.fillStyle = '#1f2933';
    ctx.font = '800 24px Manrope, "Segoe UI", Arial, sans-serif';
    ctx.fillText(value, cx, cy + 12, inner * 1.8);
}

// визначає, на який сектор вказує точка (x, y); -1 - повз діаграму
function pieHitTest(slices, x, y) {
    const { cx, cy, radius, inner } = pieGeometry();
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.hypot(dx, dy);

    if (distance < inner || distance > radius + PIE_HOVER_SHIFT) {
        return -1;
    }

    // кут від верхньої точки за годинниковою стрілкою, 0..2π
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) {
        angle += Math.PI * 2;
    }

    const total = slices.reduce((sum, slice) => sum + slice.sum, 0);
    let start = 0;

    for (let i = 0; i < slices.length; i++) {
        const end = start + (slices[i].sum / total) * Math.PI * 2;
        if (angle >= start && angle < end) {
            return i;
        }
        start = end;
    }

    return -1;
}

// ---------- Практикум 13: допоміжні функції маршрутів ----------

// посилання на сторінку категорії; назва кодується, бо може містити кирилицю й пробіли
function categoryLink(category) {
    return '#/category/' + encodeURIComponent(category);
}

// поточний шлях маршруту - частина адреси після «#»; порожній хеш означає головну
function getCurrentPath() {
    return location.hash.slice(1) || '/';
}

// ---------- Практикум 15: повідомлення про додану операцію ----------

const toast = document.querySelector('#toast');
let toastTimer = null;

// показує повідомлення на 4 секунди.
// Безпека (практикум 15): раніше рядок збирався шаблоном і записувався в innerHTML, тож категорія
// <img src=x onerror="alert('XSS')"> виконувалась як HTML. Тепер розмітку створює createElement,
// а дані користувача потрапляють у DOM лише як текстові вузли - браузер не розбирає їх як HTML.
function showToast(operation) {
    const label = operation.type === 'дохід' ? 'Додано дохід' : 'Додано витрату';
    const amount = document.createElement('strong');

    amount.textContent = `${operation.amount} грн`;
    toast.replaceChildren(`${label} `, amount, ` у категорію «${operation.category}»`);

    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.hidden = true;
    }, 4000);
}

// ---------- Vue-застосунок ----------

const { createApp } = Vue;

// компонент одного рядка операції: отримує дані через props
const ExpenseRow = {
    props: ['id', 'amount', 'type', 'category', 'date'],
    emits: ['remove'],
    computed: {
        isIncome() {
            return this.type === 'дохід';
        },
        sign() {
            return this.isIncome ? '+' : '-';
        },
        // Практикум 13: категорія витрати веде на її сторінку
        link() {
            return categoryLink(this.category);
        },
    },
    template: `
        <li class="operation" :class="isIncome ? 'income' : 'expense'">
            <span>{{ sign }}{{ amount }} грн</span>
            <span v-if="isIncome" class="operation__category">{{ category }}</span>
            <a v-else class="operation__category" :href="link" data-link>{{ category }}</a>
            <span class="operation__date">{{ date }}</span>
            <button type="button" class="operation__remove" @click="$emit('remove', id)">Видалити</button>
        </li>
    `,
};

// vm - корінь застосунку; через нього view-функції роутера перемикають сторінки
const vm = createApp({
    components: { ExpenseRow },

    data() {
        return {
            operations: [],
            form: {
                type: 'витрата',
                amount: '',
                category: '',
                date: new Date().toISOString().slice(0, 10),
            },
            amountError: '',
            dbError: '',
            storageInfo: 'Завантаження даних…',
            pieProgress: 0,   // 0..1 - поточна частка «розгорнутого» кола
            pieHover: -1,     // номер виділеного сектора
            pieFrame: null,   // id запиту requestAnimationFrame, щоб його можна було скасувати
            isLoaded: false,  // чи прочитано дані зі сховища
            page: '',         // поточна сторінка: home / category / stats / not-found
            routeParams: {},  // параметри маршруту, наприклад { category: 'Їжа' }
            currentPath: '/', // шлях, для якого показано сторінку
        };
    },

    computed: {
        income() {
            return this.operations
                .filter((op) => op.type === 'дохід')
                .reduce((sum, op) => sum + op.amount, 0);
        },
        expense() {
            return this.operations
                .filter((op) => op.type === 'витрата')
                .reduce((sum, op) => sum + op.amount, 0);
        },
        balance() {
            return this.income - this.expense;
        },
        spentPercent() {
            if (this.income === 0) {
                return 100;
            }
            return Math.min(Math.round(this.expense / this.income * 100), 100);
        },
        statusText() {
            return this.balance > 0 ? '✓ Бюджет у нормі' : '! Витрат більше ніж доходів';
        },
        buttonText() {
            return this.form.type === 'дохід' ? 'Додати дохід' : 'Додати витрату';
        },
        // клієнтська агрегація: сума витрат за кожною категорією
        byCategory() {
            const totals = {};

            for (const op of this.operations) {
                if (op.type !== 'витрата') {
                    continue;
                }

                if (!totals[op.category]) {
                    totals[op.category] = { category: op.category, sum: 0, count: 0 };
                }

                totals[op.category].sum += op.amount;
                totals[op.category].count += 1;
            }

            return Object.values(totals).sort((a, b) => b.sum - a.sum);
        },
        // ---------- Практикум 13: дані для сторінок ----------

        // «/»: останні 10 операцій, нові зверху
        recentOperations() {
            return [...this.operations]
                .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
                .slice(0, 10);
        },
        // «/category/:category»: витрати лише обраної категорії
        categoryOperations() {
            return this.operations.filter(
                (op) => op.type === 'витрата' && op.category === this.routeParams.category,
            );
        },
        categoryTotal() {
            return this.categoryOperations.reduce((sum, op) => sum + op.amount, 0);
        },
        categoryShare() {
            return this.expense === 0 ? 0 : Math.round(this.categoryTotal / this.expense * 100);
        },

        // дані для діаграми: колір і відсоток кожної категорії від усіх витрат
        pieSlices() {
            return this.byCategory.map((row, index) => ({
                ...row,
                color: PIE_COLORS[index % PIE_COLORS.length],
                percent: this.expense === 0 ? 0 : Math.round(row.sum / this.expense * 100),
            }));
        },
        // текстовий опис діаграми для екранних читачів
        pieAriaLabel() {
            const parts = this.pieSlices.map((slice) => `${slice.category} ${slice.percent} %`);
            return 'Розподіл витрат за категоріями: ' + parts.join(', ');
        },
    },

    watch: {
        // будь-яка зміна агрегованих даних (додавання, видалення) запускає анімацію заново,
        // якщо діаграма зараз на екрані
        pieSlices() {
            this.pieHover = -1;
            if (this.page === 'stats') {
                this.$nextTick(() => this.startPieAnimation());
            }
        },
        // Практикум 13: діаграма існує лише на сторінці «/stats»
        page(newPage, oldPage) {
            if (oldPage === 'stats') {
                // вихід з екрана: скасовуємо кадр анімації й відпускаємо контекст
                this.stopPieAnimation();
                this.pieHover = -1;
                pieCtx = null;
            }
            if (newPage === 'stats') {
                // canvas з'являється в DOM лише після рендеру, тому чекаємо $nextTick
                this.$nextTick(() => {
                    this.initPie();
                    this.startPieAnimation();
                });
            }
        },
    },

    methods: {
        // ---------- Практикум 13: перемикання сторінок ----------

        // викликається view-функціями роутера: Vue замінює вміст <main> на потрібну сторінку
        showPage(name, params = {}) {
            this.page = name;
            this.routeParams = params;
            this.currentPath = getCurrentPath();
        },

        categoryLink,

        // ---------- Практикум 12: цикл анімації діаграми ----------

        // готує новий canvas: фізичний розмір під щільність пікселів, щоб діаграма не була розмитою
        initPie() {
            const canvas = this.$refs.pie;

            if (!canvas) {
                pieCtx = null;
                return;
            }

            const dpr = window.devicePixelRatio || 1;
            canvas.width = PIE_SIZE * dpr;
            canvas.height = PIE_SIZE * dpr;
            pieCtx = canvas.getContext('2d');
        },

        // запускає появу секторів від 0 до повного кола через requestAnimationFrame
        startPieAnimation() {
            this.stopPieAnimation();

            let startTime = null;

            const step = (time) => {
                if (startTime === null) {
                    startTime = time;
                }

                // 1) оновлюємо стан: частка часу анімації, що минула
                const t = Math.min((time - startTime) / PIE_DURATION, 1);
                this.pieProgress = easeOutCubic(t);

                // 2) очищаємо й перемальовуємо кадр
                this.renderPie();

                // 3) просимо наступний кадр, доки анімація не завершилась
                this.pieFrame = t < 1 ? requestAnimationFrame(step) : null;
            };

            this.pieFrame = requestAnimationFrame(step);
        },

        // скасовує запланований кадр, якщо анімація ще триває
        stopPieAnimation() {
            if (this.pieFrame !== null) {
                cancelAnimationFrame(this.pieFrame);
                this.pieFrame = null;
            }
        },

        // малює поточний стан діаграми
        renderPie() {
            if (pieCtx) {
                drawPie(pieCtx, this.pieSlices, this.pieProgress, this.pieHover);
            }
        },

        // виділяє сектор; поза анімацією перемальовує один кадр
        setPieHover(index) {
            if (this.pieHover === index) {
                return;
            }

            this.pieHover = index;

            if (this.pieFrame === null) {
                requestAnimationFrame(() => this.renderPie());
            }
        },

        // переводить координати курсора в логічні координати полотна і шукає сектор
        onPieMove(event) {
            const rect = event.target.getBoundingClientRect();
            const x = (event.clientX - rect.left) * PIE_SIZE / rect.width;
            const y = (event.clientY - rect.top) * PIE_SIZE / rect.height;

            this.setPieHover(pieHitTest(this.pieSlices, x, y));
        },

        // читає всі записи з IndexedDB і дублює їх у localStorage як резервну копію
        async reloadOperations() {
            this.operations = await getAllItems();
            saveToLocalStorage(this.operations);
            this.storageInfo = `IndexedDB: ${this.operations.length} записів у сховищі "${STORE_NAME}"`;
        },

        // додає операцію: спочатку запис у сховище, потім перечитування списку
        async addOperation() {
            const amount = Number(this.form.amount);

            if (amount <= 0) {
                this.amountError = 'Сума має бути більшою за 0';
                return;
            }

            this.amountError = '';

            // категорія з одних пробілів після trim() стала б порожнім рядком
            const category = this.form.category.trim();

            if (category === '') {
                this.dbError = 'Вкажіть назву категорії.';
                return;
            }

            this.dbError = '';

            try {
                const operation = {
                    amount,
                    type: this.form.type,
                    category,
                    date: this.form.date,
                };
                const id = await addItem(operation);

                await this.reloadOperations();
                showToast(operation);
                console.log('Збережено операцію в IndexedDB, id =', id, '– баланс:', this.balance);
            } catch (error) {
                this.dbError = 'Не вдалося зберегти операцію у сховище.';
                console.error('Помилка запису в IndexedDB:', error);
                return;
            }

            this.form.amount = '';
            this.form.category = '';
        },

        // подія від дочірнього компонента: видаляє запис зі сховища
        async removeOperation(id) {
            try {
                await deleteItem(id);
                await this.reloadOperations();
                console.log('Видалено операцію', id, '– баланс:', this.balance);
            } catch (error) {
                this.dbError = 'Не вдалося видалити операцію зі сховища.';
                console.error('Помилка видалення з IndexedDB:', error);
            }
        },
    },

    // після монтування: міграція і завантаження даних зі сховища
    async mounted() {
        try {
            await migrateFromLocalStorage();
            await this.reloadOperations();
        } catch (error) {
            // IndexedDB може бути недоступна, наприклад у приватному режимі деяких браузерів
            this.dbError = 'Сховище IndexedDB недоступне, показано резервну копію з localStorage.';
            this.operations = loadFromLocalStorage();
            this.storageInfo = `Резервна копія: ${this.operations.length} записів у localStorage`;
            console.error('Помилка відкриття IndexedDB:', error);
        }

        this.isLoaded = true;
    },
    // коректне завершення: незавершений кадр анімації скасовується
    beforeUnmount() {
        this.stopPieAnimation();
    },
}).mount('#app');

// ---------- Практикум 9: дані з зовнішнього API (поза Vue-застосунком) ----------

// Практикум 14: відносна адреса - запит іде на той самий сервер, що віддав сторінку (localhost:3000)
const API_URL = '/api/transactions';
const RATES_URL = 'https://api.frankfurter.dev/v1/latest';

const apiList = document.querySelector('#api-list');
const apiStatus = document.querySelector('#api-status');
const reloadButton = document.querySelector('#reload-btn');
const convertButton = document.querySelector('#convert-btn');
const convResult = document.querySelector('#conv-result');
const apiCategory = document.querySelector('#api-category');

// малює транзакції, отримані з локального сервера
function renderApiOperations(items) {
    apiList.innerHTML = '';

    for (const item of items) {
        const li = document.createElement('li');
        const title = document.createElement('h3');
        const text = document.createElement('p');
        const isIncome = item.type === 'дохід';

        title.textContent = `${isIncome ? '+' : '-'}${item.amount} грн · ${item.category}`;
        text.textContent = `${item.date} · ${item.type}`;

        li.classList.add('api-item', isIncome ? 'api-item--income' : 'api-item--expense');
        li.setAttribute('data-id', item.id);
        li.append(title, text);
        apiList.append(li);
    }
}

// заповнює список категорій для фільтра з повного набору транзакцій
function fillCategoryOptions(items) {
    const selected = apiCategory.value;
    const categories = [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'uk'));

    apiCategory.length = 1; // лишаємо тільки «Усі категорії»

    for (const category of categories) {
        apiCategory.add(new Option(category, category));
    }

    apiCategory.value = categories.includes(selected) ? selected : '';
}

// завантажує транзакції з локального сервера; категорія передається query-параметром,
// а фільтрує вже сервер. Перевірка статусу й обробка помилок - як у практикумі 9
async function loadApiOperations() {
    const category = apiCategory.value;
    const url = category ? `${API_URL}?${new URLSearchParams({ category })}` : API_URL;

    apiStatus.classList.remove('api-status--error');
    apiStatus.textContent = 'Завантаження…';
    reloadButton.disabled = true;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Отримано з ${url}:`, data);

        if (!category) {
            fillCategoryOptions(data);
        }

        renderApiOperations(data);
        apiStatus.textContent = category
            ? `Категорія «${category}»: записів ${data.length} (відфільтровано на сервері)`
            : `Завантажено записів: ${data.length}`;
    } catch (error) {
        apiList.innerHTML = '';
        apiStatus.textContent = 'Не вдалося завантажити дані з локального сервера. Переконайтеся, що його запущено (npm start у теці server) і сторінку відкрито з http://localhost:3000.';
        apiStatus.classList.add('api-status--error');
        console.error('Помилка запиту до локального сервера:', error);
    } finally {
        reloadButton.disabled = false;
    }
}

// конвертує суму через відкритий API Frankfurter
async function convertAmount() {
    const amount = Number(document.querySelector('#conv-amount').value);
    const from = document.querySelector('#conv-from').value;
    const to = document.querySelector('#conv-to').value;

    convResult.classList.remove('api-status--error');

    if (amount <= 0) {
        convResult.textContent = 'Введіть суму більшу за 0';
        convResult.classList.add('api-status--error');
        return;
    }

    if (from === to) {
        convResult.textContent = 'Виберіть різні валюти';
        convResult.classList.add('api-status--error');
        return;
    }

    convResult.textContent = 'Отримуємо курс…';
    convertButton.disabled = true;

    try {
        const response = await fetch(`${RATES_URL}?amount=${amount}&from=${from}&to=${to}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('Курс від Frankfurter:', data);

        convResult.textContent = `${amount} ${from} = ${data.rates[to]} ${to} (курс на ${data.date})`;
    } catch (error) {
        convResult.textContent = 'Курс тимчасово недоступний, спробуйте пізніше.';
        convResult.classList.add('api-status--error');
        console.error('Помилка запиту курсу:', error);
    } finally {
        convertButton.disabled = false;
    }
}

reloadButton.addEventListener('click', loadApiOperations);
apiCategory.addEventListener('change', loadApiOperations);
convertButton.addEventListener('click', convertAmount);

loadApiOperations();

// ---------- Практикум 13: клієнтська маршрутизація (hash-based) ----------

const homeExtras = document.querySelector('#home-extras');

/*
 * Таблиця маршрутів: патерн шляху -> view-функція.
 * Сегмент із двокрапкою (:category) - параметр, його значення потрапляє в params.
 * Шлях зберігається після «#», тому сервер його не бачить і F5 на будь-якому маршруті працює.
 */
const routes = [
    { path: '/', view: viewHome },
    { path: '/category/:category', view: viewCategory },
    { path: '/stats', view: viewStats },
];

// зіставляє шлях з патернами по сегментах; повертає { route, params } або null
function matchRoute(path) {
    const pathParts = path.split('/').filter(Boolean);

    for (const route of routes) {
        const routeParts = route.path.split('/').filter(Boolean);

        if (routeParts.length !== pathParts.length) {
            continue;
        }

        const params = {};
        const matched = routeParts.every((part, index) => {
            if (part.startsWith(':')) {
                params[part.slice(1)] = decodeURIComponent(pathParts[index]);
                return true;
            }
            return part === pathParts[index];
        });

        if (matched) {
            return { route, params };
        }
    }

    return null;
}

// ---------- view-функції: кожна показує свою сторінку в контейнері <main id="page"> ----------

// «/» - останні операції, форма і секції практикуму 9
function viewHome() {
    vm.showPage('home');
    homeExtras.hidden = false;
    document.title = 'Операції · Трекер витрат';
}

// «/category/:category» - витрати однієї категорії з того ж масиву з IndexedDB
function viewCategory(params) {
    vm.showPage('category', params);
    homeExtras.hidden = true;
    document.title = `${params.category} · Трекер витрат`;
}

// «/stats» - агрегація за категоріями і діаграма
function viewStats() {
    vm.showPage('stats');
    homeExtras.hidden = true;
    document.title = 'Статистика · Трекер витрат';
}

// маршрут не знайдено - сторінка з посиланням на головну замість порожнього екрана
function viewNotFound() {
    vm.showPage('not-found');
    homeExtras.hidden = true;
    document.title = 'Не знайдено · Трекер витрат';
}

// позначає активний пункт меню
function updateActiveLinks(path) {
    const section = '/' + (path.split('/')[1] || '');

    document.querySelectorAll('.nav a[data-link]').forEach((link) => {
        const linkPath = link.getAttribute('href').slice(1);
        const active = linkPath === section || (section === '/category' && linkPath === '/stats');

        if (active) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

// знаходить маршрут для поточного шляху і викликає його view-функцію
function renderRoute() {
    const path = getCurrentPath();
    let match = null;

    try {
        match = matchRoute(path);
    } catch (error) {
        // decodeURIComponent кидає виняток на пошкодженому %-кодуванні - вважаємо, що маршруту немає
        console.warn('Некоректний шлях:', path, error);
    }

    if (match) {
        match.route.view(match.params);
    } else {
        viewNotFound();
    }

    updateActiveLinks(path);
    window.scrollTo(0, 0);
    console.log('Маршрут:', path, match ? match.params : '(не знайдено)');
}

// клієнтська навігація: змінює хеш, а рендер виконає обробник hashchange
function navigate(path) {
    if (getCurrentPath() === path) {
        renderRoute();
        return;
    }
    location.hash = path;
}

// перехоплення кліків по внутрішніх посиланнях з data-link (делегування на document,
// тож працює і для посилань, які Vue створює пізніше)
document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');

    if (!link || event.ctrlKey || event.metaKey || event.shiftKey) {
        return; // Ctrl/Cmd/Shift+клік - відкриття в новій вкладці лишаємо браузеру
    }

    event.preventDefault();
    navigate(link.getAttribute('href').slice(1));
});

// кнопки «назад»/«вперед» і ручна зміна адреси змінюють хеш - перемальовуємо сторінку
window.addEventListener('hashchange', renderRoute);

// перший рендер для адреси, з якою відкрили сторінку
renderRoute();
