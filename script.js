/*
 * Практикум 10. Обрано Vue 3 і підключено через CDN: потрібен лише один тег script,
 * розмітка лишається звичайним HTML, без JSX і без Babel, тому сторінка працює
 * без збірки й Node.js. Ручний рендер списку з практикуму 7 (createElement,
 * append, querySelector) для цієї ділянки більше не потрібен - його замінив
 * компонент ExpenseRow, а баланс став обчислюваним значенням.
 */

const { createApp } = Vue;

// компонент одного рядка операції: отримує дані через props і не звертається до глобальних змінних
const ExpenseRow = {
    props: ['id', 'amount', 'type', 'category'],
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
            <button type="button" class="operation__remove" @click="$emit('remove', id)">Видалити</button>
        </li>
    `,
};

createApp({
    components: { ExpenseRow },

    data() {
        return {
            operations: [
                { id: 1, amount: 2000, type: 'дохід', category: 'Стипендія' },
                { id: 2, amount: 150, type: 'витрата', category: 'Їжа' },
                { id: 3, amount: 30, type: 'витрата', category: 'Транспорт' },
                { id: 4, amount: 250, type: 'витрата', category: 'Розваги' },
                { id: 5, amount: 500, type: 'дохід', category: 'Підробіток' },
                { id: 6, amount: 90, type: 'витрата', category: 'Їжа' },
            ],
            nextId: 7,
            form: { type: 'витрата', amount: '', category: '' },
            amountError: '',
        };
    },

    computed: {
        // похідні значення: перераховуються самі, щойно зміниться масив операцій
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
    },

    methods: {
        // додає нову операцію в реактивний масив
        addOperation() {
            const amount = Number(this.form.amount);

            if (amount <= 0) {
                this.amountError = 'Сума має бути більшою за 0';
                return;
            }

            this.operations.push({
                id: this.nextId,
                amount,
                type: this.form.type,
                category: this.form.category.trim(),
            });

            this.nextId += 1;
            this.amountError = '';
            this.form.amount = '';
            this.form.category = '';

            console.log('Додано операцію, новий баланс:', this.balance);
        },

        // подія від дочірнього компонента: видаляє операцію за id
        removeOperation(id) {
            this.operations = this.operations.filter((op) => op.id !== id);
            console.log('Видалено операцію', id, '– баланс:', this.balance);
        },
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