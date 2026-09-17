console.log('script.js підключено');

const operations = [
    { amount: 2000, type: 'дохід' },
    { amount: 150, type: 'витрата' },
    { amount: 30, type: 'витрата' },
    { amount: 250, type: 'витрата' },
    { amount: 500, type: 'дохід' },
    { amount: 90, type: 'витрата' },
];

// виводить у консоль кожну операцію зі знаком + або -
function printOperations(list) {
    for (const op of list) {
        const sign = op.type === 'дохід' ? '+' : '-';
        console.log(`${sign}${op.amount} грн (${op.type})`);
    }
}

// рахує окремо доходи і витрати та повертає підсумковий баланс
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

// пише в консоль, додатний баланс чи ні
function checkBalance(balance) {
    if (balance > 0) {
        console.log(`Баланс додатний: ${balance} грн, все гаразд`);
    } else if (balance === 0) {
        console.log('Баланс нульовий');
    } else {
        console.log(`Баланс від'ємний: ${balance} грн, витрат більше ніж доходів`);
    }
}

// переводить частину від загальної суми у відсотки
const toPercent = (part, total) => Math.round(part / total * 100);

console.log('--- Операції ---');
printOperations(operations);

const result = calcBalance(operations);

console.log('--- Підсумок ---');
console.log(`Кількість операцій: ${operations.length}`);
console.log(`Доходи: ${result.income} грн`);
console.log(`Витрати: ${result.expense} грн`);
checkBalance(result.balance);

const spentPercent = toPercent(result.expense, result.income);
console.log(`Витрачено ${spentPercent}% від доходу`);

console.log('--- Перевірка інших випадків ---');
checkBalance(0);
checkBalance(-120);
console.log(`toPercent(45, 60) = ${toPercent(45, 60)}`);
console.log(`typeof result.balance: ${typeof result.balance}`);