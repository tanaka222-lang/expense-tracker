console.log('script.js підключено');

const operations = [
    { amount: 2000, type: 'дохід', category: 'Стипендія' },
    { amount: 150, type: 'витрата', category: 'Їжа' },
    { amount: 30, type: 'витрата', category: 'Транспорт' },
    { amount: 250, type: 'витрата', category: 'Розваги' },
    { amount: 500, type: 'дохід', category: 'Підробіток' },
    { amount: 90, type: 'витрата', category: 'Їжа' },
];

const listContainer = document.querySelector('#transactions-list');
const balanceElement = document.querySelector('#balance');
const form = document.querySelector('#operation-form');
const typeSelect = document.querySelector('#type');
const amountInput = document.querySelector('#amount');
const categoryInput = document.querySelector('#category');
const amountError = document.querySelector('#amount-error');
const submitButton = document.querySelector('#submit-btn');

// прибирає статичні приклади, які лишились у розмітці з практикуму 2
function removeStaticExamples() {
    const examples = document.querySelectorAll('.static-example');
    examples.forEach((item) => item.remove());
    console.log(`Видалено статичних елементів: ${examples.length}`);
}

// рахує доходи, витрати і підсумковий баланс
function calcBalance(list) {
    let income = 0;
    let expense = 0;

    for (let i = 0; i < list.length; i++) {
        if (list[i].type === 'дохід') {
            income += list[i].amount;
        } else {
            expense += list[i].amount;
        }
    }

    return { income, expense, balance: income - expense };
}

// переводить частину від загальної суми у відсотки
const toPercent = (part, total) => Math.round(part / total * 100);

// створює li для кожної операції масиву і додає його в список на сторінці
function renderOperations(list) {
    listContainer.innerHTML = '';

    for (const op of list) {
        const item = document.createElement('li');
        const sign = op.type === 'дохід' ? '+' : '-';

        item.textContent = `${sign}${op.amount} грн (${op.type})`;
        item.classList.add('operation');
        item.classList.add(op.type === 'дохід' ? 'income' : 'expense');
        item.setAttribute('data-amount', op.amount);
        item.dataset.category = op.category;

        listContainer.append(item);
    }

    console.log(`Створено елементів списку: ${listContainer.children.length}`);
}

// оновлює текст елементів підсумку, які вже є в розмітці
function updateSummary(list) {
    const result = calcBalance(list);
    const spent = result.income > 0 ? toPercent(result.expense, result.income) : 100;

    balanceElement.textContent = `${result.balance} грн`;
    document.querySelector('#income-total').textContent = `+${result.income} грн`;
    document.querySelector('#expense-total').textContent = `-${result.expense} грн`;
    document.querySelector('#balance-hint').textContent = `Витрачено ${spent} % доходу`;
    document.querySelector('#budget-fill').style.width = `${Math.min(spent, 100)}%`;

    const status = document.querySelector('#balance-status');
    if (result.balance > 0) {
        status.textContent = '✓ Бюджет у нормі';
    } else {
        status.textContent = '! Витрат більше ніж доходів';
    }

    console.log(`Баланс оновлено: ${result.balance} грн`);
}

// перевіряє суму: нуль і від'ємне значення не приймаються
function validateAmount() {
    const value = Number(amountInput.value);

    if (amountInput.value !== '' && value <= 0) {
        amountInput.setCustomValidity('Сума має бути більшою за 0');
        amountError.textContent = 'Сума має бути більшою за 0';
        return false;
    }

    amountInput.setCustomValidity('');
    amountError.textContent = '';
    return true;
}

// живе виправлення підказки під полем суми
amountInput.addEventListener('input', validateAmount);

// змінює напис на кнопці залежно від обраного типу операції
typeSelect.addEventListener('change', () => {
    submitButton.textContent = typeSelect.value === 'дохід' ? 'Додати дохід' : 'Додати витрату';
});

// додає операцію в масив, перемальовує список і перераховує баланс без перезавантаження
form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!validateAmount()) {
        amountInput.reportValidity();
        return;
    }

    const newOperation = {
        amount: Number(amountInput.value),
        type: typeSelect.value,
        category: categoryInput.value.trim(),
    };

    operations.push(newOperation);
    renderOperations(operations);
    updateSummary(operations);

    console.log('Додано операцію:', newOperation);
    console.log(`Усього операцій у масиві: ${operations.length}`);

    form.reset();
    submitButton.textContent = 'Додати витрату';
    amountError.textContent = '';
});

removeStaticExamples();
renderOperations(operations);
updateSummary(operations);
// ---------- Практикум 9: дані з зовнішнього API ----------

// мок операцій з відкритого API JSONPlaceholder: name - призначення, body - коментар
const API_URL = 'https://jsonplaceholder.typicode.com/comments?postId=2';
const RATES_URL = 'https://api.frankfurter.app/latest';

const apiList = document.querySelector('#api-list');
const apiStatus = document.querySelector('#api-status');
const reloadButton = document.querySelector('#reload-btn');
const convertButton = document.querySelector('#convert-btn');
const convResult = document.querySelector('#conv-result');

// малює отримані з сервера записи тим самим способом, що й основний список
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