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
    },
    template: `
        <li class="operation" :class="isIncome ? 'income' : 'expense'">
            <span>{{ sign }}{{ amount }} грн</span>
            <span class="operation__category">{{ category }}</span>
            <span class="operation__date">{{ date }}</span>
            <button type="button" class="operation__remove" @click="$emit('remove', id)">Видалити</button>
        </li>
    `,
};

createApp({
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
        // будь-яка зміна агрегованих даних (додавання, видалення) запускає анімацію заново
        pieSlices() {
            this.pieHover = -1;
            this.$nextTick(() => this.startPieAnimation());
        },
    },

    methods: {
        // ---------- Практикум 12: цикл анімації діаграми ----------

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

            try {
                const id = await addItem({
                    amount,
                    type: this.form.type,
                    category: this.form.category.trim(),
                    date: this.form.date,
                });

                await this.reloadOperations();
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

    // після монтування: підготовка Canvas, міграція і завантаження даних зі сховища
    async mounted() {
        // фізичний розмір полотна збільшуємо під щільність пікселів, щоб діаграма не була розмитою
        const canvas = this.$refs.pie;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = PIE_SIZE * dpr;
        canvas.height = PIE_SIZE * dpr;
        pieCtx = canvas.getContext('2d');

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
    },
    // коректне завершення: незавершений кадр анімації скасовується
    beforeUnmount() {
        this.stopPieAnimation();
    },
}).mount('#app');

// ---------- Практикум 9: дані з зовнішнього API (поза Vue-застосунком) ----------

const API_URL = 'https://jsonplaceholder.typicode.com/comments?postId=2';
const RATES_URL = 'https://api.frankfurter.dev/v1/latest';

const apiList = document.querySelector('#api-list');
const apiStatus = document.querySelector('#api-status');
const reloadButton = document.querySelector('#reload-btn');
const convertButton = document.querySelector('#convert-btn');
const convResult = document.querySelector('#conv-result');

// малює записи, отримані з API
function renderApiOperations(items) {
    apiList.innerHTML = '';

    for (const item of items) {
        const li = document.createElement('li');
        const title = document.createElement('h3');
        const text = document.createElement('p');

        title.textContent = item.name;
        text.textContent = item.body;

        li.classList.add('api-item');
        li.setAttribute('data-id', item.id);
        li.append(title, text);
        apiList.append(li);
    }
}

// завантажує приклади операцій з API з перевіркою статусу й обробкою помилок
async function loadApiOperations() {
    apiStatus.classList.remove('api-status--error');
    apiStatus.textContent = 'Завантаження…';
    reloadButton.disabled = true;

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Отримано з API:', data);

        renderApiOperations(data.slice(0, 5));
        apiStatus.textContent = `Завантажено записів: ${data.length}, показано перші 5`;
    } catch (error) {
        apiList.innerHTML = '';
        apiStatus.textContent = 'Не вдалося завантажити дані. Перевірте з\'єднання та натисніть «Оновити».';
        apiStatus.classList.add('api-status--error');
        console.error('Помилка запиту до API:', error);
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
convertButton.addEventListener('click', convertAmount);

loadApiOperations();
