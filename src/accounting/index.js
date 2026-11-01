'use strict';

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000;
const MAX_BALANCE_CENTS = 99999999;

function formatBalance(balanceCents) {
  return (balanceCents / 100).toFixed(2);
}

function parseAmount(input) {
  const value = String(input).trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const amountCents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amountCents) && amountCents <= MAX_BALANCE_CENTS
    ? amountCents
    : null;
}

class DataProgram {
  constructor(initialBalanceCents = INITIAL_BALANCE_CENTS) {
    this.storageBalanceCents = initialBalanceCents;
  }

  execute(operation, balanceCents) {
    const operationType = String(operation).trim().toUpperCase();

    if (operationType === 'READ') {
      return this.storageBalanceCents;
    }

    if (operationType === 'WRITE') {
      if (!Number.isSafeInteger(balanceCents) || balanceCents < 0 || balanceCents > MAX_BALANCE_CENTS) {
        throw new RangeError('Balance is outside the supported account range.');
      }
      this.storageBalanceCents = balanceCents;
      return this.storageBalanceCents;
    }

    return undefined;
  }
}

class Operations {
  constructor(dataProgram = new DataProgram()) {
    this.dataProgram = dataProgram;
  }

  execute(operation, amountCents) {
    const operationType = String(operation).trim().toUpperCase();

    if (operationType === 'TOTAL') {
      return { operation: 'TOTAL', balanceCents: this.total() };
    }

    if (operationType === 'CREDIT') {
      return { operation: 'CREDIT', balanceCents: this.credit(amountCents) };
    }

    if (operationType === 'DEBIT') {
      return { operation: 'DEBIT', ...this.debit(amountCents) };
    }

    return undefined;
  }

  total() {
    return this.dataProgram.execute('READ');
  }

  credit(amountCents) {
    const currentBalanceCents = this.dataProgram.execute('READ');
    const newBalanceCents = currentBalanceCents + amountCents;
    this.dataProgram.execute('WRITE', newBalanceCents);
    return newBalanceCents;
  }

  debit(amountCents) {
    const currentBalanceCents = this.dataProgram.execute('READ');
    if (currentBalanceCents < amountCents) {
      return { approved: false, balanceCents: currentBalanceCents };
    }

    const newBalanceCents = currentBalanceCents - amountCents;
    this.dataProgram.execute('WRITE', newBalanceCents);
    return { approved: true, balanceCents: newBalanceCents };
  }
}

function displayMenu(output) {
  output.write('--------------------------------\n');
  output.write('Account Management System\n');
  output.write('1. View Balance\n');
  output.write('2. Credit Account\n');
  output.write('3. Debit Account\n');
  output.write('4. Exit\n');
  output.write('--------------------------------\n');
}

async function runApp(input = process.stdin, output = process.stdout) {
  const readlineInterface = readline.createInterface({ input, output });
  const lines = readlineInterface[Symbol.asyncIterator]();
  const ask = async (prompt) => {
    output.write(prompt);
    const nextLine = await lines.next();
    return nextLine.done ? '4' : nextLine.value;
  };
  const operations = new Operations();
  let continueRunning = true;

  try {
    while (continueRunning) {
      displayMenu(output);
      const choice = await ask('Enter your choice (1-4): ');

      switch (choice.trim()) {
        case '1':
          output.write(`Current balance: ${formatBalance(operations.total())}\n`);
          break;
        case '2': {
          const amountCents = parseAmount(await ask('Enter credit amount: '));
          if (amountCents === null) {
            output.write('Invalid amount, please enter a non-negative amount with up to two decimal places.\n');
            break;
          }
          try {
            const balanceCents = operations.credit(amountCents);
            output.write(`Amount credited. New balance: ${formatBalance(balanceCents)}\n`);
          } catch (error) {
            output.write(`${error.message}\n`);
          }
          break;
        }
        case '3': {
          const amountCents = parseAmount(await ask('Enter debit amount: '));
          if (amountCents === null) {
            output.write('Invalid amount, please enter a non-negative amount with up to two decimal places.\n');
            break;
          }
          const result = operations.debit(amountCents);
          if (!result.approved) {
            output.write('Insufficient funds for this debit.\n');
          } else {
            output.write(`Amount debited. New balance: ${formatBalance(result.balanceCents)}\n`);
          }
          break;
        }
        case '4':
          continueRunning = false;
          break;
        default:
          output.write('Invalid choice, please select 1-4.\n');
      }
    }

    output.write('Exiting the program. Goodbye!\n');
  } finally {
    readlineInterface.close();
  }
}

if (require.main === module) {
  runApp().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DataProgram,
  INITIAL_BALANCE_CENTS,
  MAX_BALANCE_CENTS,
  Operations,
  formatBalance,
  parseAmount,
  runApp,
};
