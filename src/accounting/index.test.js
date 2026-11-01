'use strict';

const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { test } = require('node:test');

const {
  DataProgram,
  INITIAL_BALANCE_CENTS,
  MAX_BALANCE_CENTS,
  Operations,
  parseAmount,
  runApp,
} = require('./index');

async function runMenu(...inputs) {
  let output = '';
  const outputStream = new Writable({
    write(chunk, encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  await runApp(Readable.from([`${inputs.join('\n')}\n`]), outputStream);
  return output;
}

test('TC-001 displays the account menu when the application starts', async () => {
  const output = await runMenu('4');

  assert.match(output, /Account Management System/);
  assert.match(output, /1\. View Balance/);
  assert.match(output, /2\. Credit Account/);
  assert.match(output, /3\. Debit Account/);
  assert.match(output, /4\. Exit/);
});

test('TC-002 returns the initial balance of 1000.00', () => {
  const operations = new Operations();

  assert.equal(operations.total(), INITIAL_BALANCE_CENTS);
});

test('TC-003 credits 250.00 and persists 1250.00', () => {
  const operations = new Operations();

  assert.equal(operations.credit(25000), 125000);
  assert.equal(operations.total(), 125000);
});

test('TC-004 accepts a zero credit without changing the balance', () => {
  const operations = new Operations();

  assert.equal(operations.credit(0), INITIAL_BALANCE_CENTS);
  assert.equal(operations.total(), INITIAL_BALANCE_CENTS);
});

test('TC-005 accepts the maximum supported amount and reports overflow safely', async () => {
  assert.equal(parseAmount('999999.99'), MAX_BALANCE_CENTS);

  const output = await runMenu('2', '999999.99', '4');
  assert.match(output, /Balance is outside the supported account range\./);
  assert.match(output, /Exiting the program\. Goodbye!/);
});

test('TC-006 debits 250.00 from the current balance', () => {
  const operations = new Operations();

  const result = operations.debit(25000);

  assert.deepEqual(result, { approved: true, balanceCents: 75000 });
  assert.equal(operations.total(), 75000);
});

test('TC-007 allows a debit equal to the current balance', () => {
  const operations = new Operations();

  assert.deepEqual(operations.debit(INITIAL_BALANCE_CENTS), {
    approved: true,
    balanceCents: 0,
  });
  assert.equal(operations.total(), 0);
});

test('TC-008 rejects a debit greater than the current balance', () => {
  const operations = new Operations();

  assert.deepEqual(operations.debit(100001), {
    approved: false,
    balanceCents: INITIAL_BALANCE_CENTS,
  });
  assert.equal(operations.total(), INITIAL_BALANCE_CENTS);
});

test('TC-009 accepts a zero debit without changing the balance', () => {
  const operations = new Operations();

  assert.deepEqual(operations.debit(0), {
    approved: true,
    balanceCents: INITIAL_BALANCE_CENTS,
  });
  assert.equal(operations.total(), INITIAL_BALANCE_CENTS);
});

test('TC-010 persists multiple credit, debit, and inquiry operations', () => {
  const operations = new Operations();

  assert.equal(operations.credit(30000), 130000);
  assert.deepEqual(operations.debit(12550), {
    approved: true,
    balanceCents: 117450,
  });
  assert.equal(operations.total(), 117450);
});

test('TC-011 uses the latest credited balance for debit validation', () => {
  const operations = new Operations();

  assert.equal(operations.credit(10000), 110000);
  assert.deepEqual(operations.debit(110001), {
    approved: false,
    balanceCents: 110000,
  });
  assert.equal(operations.total(), 110000);
});

test('TC-012 rejects an invalid menu choice and keeps the application usable', async () => {
  const output = await runMenu('0', '1', '4');

  assert.match(output, /Invalid choice, please select 1-4\./);
  assert.match(output, /Current balance: 1000\.00/);
  assert.equal((output.match(/Account Management System/g) || []).length, 3);
});

test('TC-013 exits normally after menu option 4', async () => {
  const output = await runMenu('4');

  assert.match(output, /Exiting the program\. Goodbye!/);
});

test('TC-014 reads the balance stored by DataProgram', () => {
  const dataProgram = new DataProgram();
  dataProgram.execute('WRITE', 137525);

  assert.equal(dataProgram.execute('READ'), 137525);
});

test('TC-015 writes and then reads an updated balance', () => {
  const dataProgram = new DataProgram();

  dataProgram.execute('WRITE', 87540);

  assert.equal(dataProgram.execute('READ'), 87540);
});

test('TC-016 ignores an unsupported data operation', () => {
  const dataProgram = new DataProgram();

  assert.equal(dataProgram.execute('ARCHIVE', 50000), undefined);
  assert.equal(dataProgram.execute('READ'), INITIAL_BALANCE_CENTS);
});

test('TC-017 ignores an unsupported operations request', () => {
  const operations = new Operations();

  assert.equal(operations.execute('ARCHIVE', 50000), undefined);
  assert.equal(operations.total(), INITIAL_BALANCE_CENTS);
});

test('TC-018 shares balance state between Operations and DataProgram', () => {
  const dataProgram = new DataProgram();
  const operations = new Operations(dataProgram);

  operations.credit(5000);
  assert.equal(dataProgram.execute('READ'), 105000);
  operations.debit(2000);
  assert.equal(dataProgram.execute('READ'), 103000);
});