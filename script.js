console.log('script.js підключено');

const operations = [
    { amount: 2000, type: 'дохід' },
    { amount: 150, type: 'витрата' },
    { amount: 30, type: 'витрата' },
    { amount: 250, type: 'витрата' },
    { amount: 500, type: 'дохід' },
    { amount: 90, type: 'витрата' },
];

const listContainer = document.querySelector('#transactions-list');
const balanceElement = document.querySelector('#balance');

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

        listContainer.append(item);
    }

    console.log(`Створено елементів списку: ${listContainer.children.length}`);
}

// оновлює текст елементів підсумку, які вже є в розмітці
function updateSummary(list) {
    const result = calcBalance(list);
    const spent = toPercent(result.expense, result.income);

    balanceElement.textContent = `${result.balance} грн`;
    document.querySelector('#income-total').textContent = `+${result.income} грн`;
    document.querySelector('#expense-total').textContent = `-${result.expense} грн`;
    document.querySelector('#balance-hint').textContent = `Витрачено ${spent} % доходу`;
    document.querySelector('#budget-fill').style.width = `${spent}%`;

    const status = document.querySelector('#balance-status');
    if (result.balance > 0) {
        status.textContent = '✓ Бюджет у нормі';
    } else {
        status.textContent = '! Витрат більше ніж доходів';
    }

    console.log(`Баланс оновлено: ${result.balance} грн`);
}

removeStaticExamples();
renderOperations(operations);
updateSummary(operations);