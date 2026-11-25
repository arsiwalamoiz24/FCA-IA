/**
 * ledger-engine.js
 * Deterministic double-entry journal, two-sided T-Ledger balancing, and Trial Balance engine.
 * Strict accounting equilibrium guarantee: sum(debits) === sum(credits).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JobShopLedger = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ACCOUNT_TYPES = {
    'Sundry Debtors': 'Asset',
    'Bank / Cash': 'Asset',
    'Sales Revenue': 'Revenue',
    'Output GST': 'Liability'
  };

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function createEmptyLedger() {
    return {
      nextEntrySeq: 1,
      entries: []
    };
  }

  function cloneLedger(ledger) {
    return JSON.parse(JSON.stringify(ledger || createEmptyLedger()));
  }

  function validateEntryBalanced(entry) {
    var drSum = 0;
    var crSum = 0;
    (entry.lines || []).forEach(function (line) {
      if (line.side === 'Dr') drSum += Number(line.amount) || 0;
      if (line.side === 'Cr') crSum += Number(line.amount) || 0;
    });
    return Math.abs(round2(drSum) - round2(crSum)) < 0.01 && round2(drSum) > 0;
  }

  function postCreditSale(ledger, payload) {
    var next = cloneLedger(ledger);
    var p = payload || {};
    var taxable = round2(Math.max(0, Number(p.taxableAmount) || 0));
    var gstRate = Math.max(0, Number(p.gstRatePct) || 0);
    var gstAmount = round2(taxable * (gstRate / 100));
    var grossAmount = round2(taxable + gstAmount);

    if (grossAmount <= 0) {
      throw new Error('Cannot post a sale entry with zero or negative amount.');
    }

    var customer = (p.customerName || 'Customer').trim();
    var quoteId = p.quoteId || 'QTN-001';
    var jobId = p.jobId || 'JOB-001';
    var dateStr = p.date || new Date().toISOString().slice(0, 10);

    var lines = [
      { account: 'Sundry Debtors', side: 'Dr', amount: grossAmount, party: customer, opposite: 'To Sales Revenue A/c' },
      { account: 'Sales Revenue', side: 'Cr', amount: taxable, party: customer, opposite: 'By Sundry Debtors (' + customer + ')' }
    ];
    if (gstAmount > 0) {
      lines.push({ account: 'Output GST', side: 'Cr', amount: gstAmount, party: customer, opposite: 'By Sundry Debtors (' + customer + ')' });
    }

    var entry = {
      id: 'JE-' + String(next.nextEntrySeq).padStart(4, '0'),
      date: dateStr,
      type: 'CREDIT_SALE',
      quoteId: quoteId,
      jobId: jobId,
      customerName: customer,
      lines: lines,
      narration: 'Being credit sale booked on customer acceptance of Quote ' + quoteId + ' (' + jobId + ') for ' + customer + '.'
    };

    if (!validateEntryBalanced(entry)) {
      throw new Error('Journal entry rejected: Debits do not equal Credits.');
    }

    next.nextEntrySeq += 1;
    next.entries.push(entry);
    return next;
  }

  function postPaymentReceipt(ledger, payload) {
    var next = cloneLedger(ledger);
    var p = payload || {};
    var amount = round2(Math.max(0, Number(p.amount) || 0));
    if (amount <= 0) {
      throw new Error('Payment receipt amount must be greater than zero.');
    }

    var customer = (p.customerName || 'Customer').trim();
    var mode = p.paymentMode || 'NEFT / Bank';
    var dateStr = p.date || new Date().toISOString().slice(0, 10);
    var ref = p.reference || 'RCPT-' + String(next.nextEntrySeq).padStart(3, '0');

    var entry = {
      id: 'JE-' + String(next.nextEntrySeq).padStart(4, '0'),
      date: dateStr,
      type: 'PAYMENT_RECEIPT',
      quoteId: ref,
      jobId: '',
      customerName: customer,
      lines: [
        { account: 'Bank / Cash', side: 'Dr', amount: amount, party: customer, opposite: 'To Sundry Debtors (' + customer + ')' },
        { account: 'Sundry Debtors', side: 'Cr', amount: amount, party: customer, opposite: 'By Bank / Cash (' + mode + ')' }
      ],
      narration: 'Being payment received via ' + mode + ' from ' + customer + ' (Ref: ' + ref + ').'
    };

    if (!validateEntryBalanced(entry)) {
      throw new Error('Receipt entry rejected: Debits do not equal Credits.');
    }

    next.nextEntrySeq += 1;
    next.entries.push(entry);
    return next;
  }

  function computeTAccounts(ledger) {
    var map = {};
    Object.keys(ACCOUNT_TYPES).forEach(function (acc) {
      map[acc] = {
        name: acc,
        type: ACCOUNT_TYPES[acc],
        debits: [],
        credits: [],
        rawDebitTotal: 0,
        rawCreditTotal: 0,
        closingSide: 'Dr',
        closingBalance: 0,
        balancedTotal: 0
      };
    });

    (ledger && ledger.entries ? ledger.entries : []).forEach(function (entry) {
      entry.lines.forEach(function (line) {
        if (!map[line.account]) {
          map[line.account] = {
            name: line.account,
            type: 'Other',
            debits: [],
            credits: [],
            rawDebitTotal: 0,
            rawCreditTotal: 0,
            closingSide: 'Dr',
            closingBalance: 0,
            balancedTotal: 0
          };
        }
        var target = map[line.account];
        var item = {
          date: entry.date,
          entryId: entry.id,
          particulars: line.opposite,
          amount: round2(line.amount)
        };
        if (line.side === 'Dr') {
          target.debits.push(item);
          target.rawDebitTotal = round2(target.rawDebitTotal + item.amount);
        } else {
          target.credits.push(item);
          target.rawCreditTotal = round2(target.rawCreditTotal + item.amount);
        }
      });
    });

    Object.keys(map).forEach(function (name) {
      var acc = map[name];
      if (acc.rawDebitTotal >= acc.rawCreditTotal) {
        acc.closingSide = 'Dr';
        acc.closingBalance = round2(acc.rawDebitTotal - acc.rawCreditTotal);
        acc.balancedTotal = acc.rawDebitTotal;
      } else {
        acc.closingSide = 'Cr';
        acc.closingBalance = round2(acc.rawCreditTotal - acc.rawDebitTotal);
        acc.balancedTotal = acc.rawCreditTotal;
      }
    });

    return map;
  }

  function computeTrialBalance(tAccounts) {
    var rows = [];
    var totalDebit = 0;
    var totalCredit = 0;

    Object.keys(tAccounts).forEach(function (name) {
      var acc = tAccounts[name];
      if (acc.rawDebitTotal === 0 && acc.rawCreditTotal === 0) return;

      var drBal = acc.closingSide === 'Dr' ? acc.closingBalance : 0;
      var crBal = acc.closingSide === 'Cr' ? acc.closingBalance : 0;
      totalDebit = round2(totalDebit + drBal);
      totalCredit = round2(totalCredit + crBal);

      rows.push({
        account: acc.name,
        type: acc.type,
        debitBalance: drBal,
        creditBalance: crBal
      });
    });

    return {
      rows: rows,
      totalDebit: totalDebit,
      totalCredit: totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }

  return {
    createEmptyLedger: createEmptyLedger,
    postCreditSale: postCreditSale,
    postPaymentReceipt: postPaymentReceipt,
    computeTAccounts: computeTAccounts,
    computeTrialBalance: computeTrialBalance
  };
}));
