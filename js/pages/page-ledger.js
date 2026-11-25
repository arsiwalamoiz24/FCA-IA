/**
 * page-ledger.js
 * Controls Page 4 (ledger.html): Formal Commercial Quotation, Order Acceptance trigger,
 * Payment Settlement posting, General Journal, T-Accounts, and Trial Balance.
 */
(function (root) {
  'use strict';

  var state = root.JobShopState.load();
  var fmt = root.JobShopState.formatINR;
  var esc = root.JobShopState.escapeHTML;

  function getActiveQuoteTotals() {
    var costSummary = root.JobShopCosting.calculateJobCostSheet(state.costInputs);
    var gstRate = Math.max(0, Number(state.jobMeta.gstRatePct) || 0);
    var taxable = costSummary.quotationPrice;
    var gstAmt = Math.round((taxable * (gstRate / 100) + Number.EPSILON) * 100) / 100;
    var grandTotal = Math.round((taxable + gstAmt + Number.EPSILON) * 100) / 100;
    return {
      costSummary: costSummary,
      taxable: taxable,
      gstRate: gstRate,
      gstAmt: gstAmt,
      grandTotal: grandTotal
    };
  }

  function syncInputs() {
    document.getElementById('qtn-workshop-name').value = state.workshop.name;
    document.getElementById('qtn-id').value = state.jobMeta.quoteId;
    document.getElementById('qtn-customer').value = state.jobMeta.customerName;
    document.getElementById('qtn-date').value = state.jobMeta.issueDate;
    document.getElementById('qtn-validity').value = state.jobMeta.validityDays;
    document.getElementById('qtn-gst-rate').value = String(state.jobMeta.gstRatePct || 0);
    document.getElementById('rcpt-date').value = state.jobMeta.issueDate;
  }

  function renderQuotationCard() {
    var q = getActiveQuoteTotals();
    var c = q.costSummary;

    document.getElementById('qtn-display-workshop').textContent = state.workshop.name;
    document.getElementById('qtn-display-tagline').textContent = state.workshop.tagline;
    document.getElementById('qtn-display-gstin').textContent = 'GSTIN: ' + state.workshop.gstin;
    document.getElementById('qtn-display-id').textContent = state.jobMeta.quoteId;
    document.getElementById('qtn-display-date').textContent = state.jobMeta.issueDate;
    document.getElementById('qtn-display-valid').textContent = state.jobMeta.validityDays + ' Days';
    document.getElementById('qtn-display-customer').textContent = state.jobMeta.customerName;
    document.getElementById('qtn-display-job').textContent = state.jobMeta.jobId;

    var gstRow = q.gstRate > 0
      ? '<tr><td>IGST / CGST+SGST (' + q.gstRate + '%)</td><td class="num">&mdash;</td><td class="num">' + fmt(q.gstAmt) + '</td></tr>'
      : '';

    document.getElementById('qtn-items-body').innerHTML = '' +
      '<tr>' +
        '<td><strong>' + esc(state.jobMeta.partName) + '</strong>' +
          '<span class="working-subline">Ref: ' + esc(state.jobMeta.jobId) + ' | ' + esc(state.costInputs.sourceLabel) + '</span>' +
        '</td>' +
        '<td class="num">' + c.quantity + ' units @ ' + fmt(c.perUnit.quotationPrice) + '</td>' +
        '<td class="num">' + fmt(q.taxable) + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td colspan="2">Taxable Order Subtotal (Cost of Sales ' + fmt(c.costOfSales) + ' + Profit ' + fmt(c.profitAmount) + ')</td>' +
        '<td class="num">' + fmt(q.taxable) + '</td>' +
      '</tr>' +
      gstRow +
      '<tr class="total-row">' +
        '<td colspan="2">TOTAL QUOTATION VALUE</td>' +
        '<td class="num">' + fmt(q.grandTotal) + '</td>' +
      '</tr>';

    var alreadyAccepted = (state.jobMeta.acceptedQuoteIds || []).indexOf(state.jobMeta.quoteId) !== -1;
    var acceptStatus = document.getElementById('quote-accept-status');
    if (alreadyAccepted) {
      acceptStatus.className = 'badge badge-forest';
      acceptStatus.textContent = 'ACCEPTED & POSTED TO LEDGER';
    } else {
      acceptStatus.className = 'badge badge-navy';
      acceptStatus.textContent = 'DRAFT QUOTATION';
    }
  }

  function renderAccountingBooks() {
    var tAccounts = root.JobShopLedger.computeTAccounts(state.ledger);
    var tb = root.JobShopLedger.computeTrialBalance(tAccounts);

    // 1. Summary KPIs
    var debtorsBal = tAccounts['Sundry Debtors'].closingSide === 'Dr' ? tAccounts['Sundry Debtors'].closingBalance : 0;
    var salesBal = tAccounts['Sales Revenue'].closingBalance;
    var cashBal = tAccounts['Bank / Cash'].closingBalance;

    document.getElementById('kpi-debtors').textContent = fmt(debtorsBal);
    document.getElementById('kpi-sales').textContent = fmt(salesBal);
    document.getElementById('kpi-cash').textContent = fmt(cashBal);
    document.getElementById('kpi-tb-status').textContent = tb.rows.length === 0
      ? 'No Postings Yet'
      : (tb.isBalanced ? 'Balanced (' + fmt(tb.totalDebit) + ')' : 'Imbalance Detected');

    // Prefill receipt amount to outstanding debtors balance if empty or 0
    var rcptAmtEl = document.getElementById('rcpt-amount');
    if (rcptAmtEl && (!rcptAmtEl.dataset.userEdited || Number(rcptAmtEl.value) === 0)) {
      rcptAmtEl.value = debtorsBal > 0 ? debtorsBal.toFixed(2) : '';
    }
    document.getElementById('btn-post-receipt').disabled = debtorsBal <= 0;

    // 2. General Journal Table
    var jBody = document.getElementById('journal-tbody');
    if (state.ledger.entries.length === 0) {
      jBody.innerHTML = '<tr><td colspan="5" class="muted-note">No journal entries posted yet. Click "Accept Quotation & Post Credit Sale" above to record an accounting transaction.</td></tr>';
    } else {
      var rows = [];
      state.ledger.entries.forEach(function (entry) {
        entry.lines.forEach(function (line, idx) {
          var indent = line.side === 'Cr' ? '&nbsp;&nbsp;&nbsp;&nbsp;To ' + esc(line.account) + ' A/c' : esc(line.account) + ' A/c &nbsp;&nbsp;Dr.';
          rows.push(
            '<tr>' +
              '<td>' + (idx === 0 ? esc(entry.date) : '') + '</td>' +
              '<td>' + (idx === 0 ? esc(entry.id) : '') + '</td>' +
              '<td>' + indent + '</td>' +
              '<td class="num">' + (line.side === 'Dr' ? fmt(line.amount) : '') + '</td>' +
              '<td class="num">' + (line.side === 'Cr' ? fmt(line.amount) : '') + '</td>' +
            '</tr>'
          );
        });
        rows.push(
          '<tr><td></td><td></td><td colspan="3" class="muted-note"><em>(' + esc(entry.narration) + ')</em></td></tr>'
        );
      });
      jBody.innerHTML = rows.join('');
    }

    // 3. T-Accounts Grid
    var activeAccounts = ['Sundry Debtors', 'Sales Revenue', 'Bank / Cash'];
    if (tAccounts['Output GST'].rawCreditTotal > 0) activeAccounts.push('Output GST');

    var tGrid = document.getElementById('t-accounts-container');
    tGrid.innerHTML = activeAccounts.map(function (name) {
      var acc = tAccounts[name];
      var drHtml = acc.debits.map(function (d) {
        return '<div class="t-entry-row"><span>' + esc(d.entryId) + ': ' + esc(d.particulars) + '</span><span class="amt">' + fmt(d.amount) + '</span></div>';
      }).join('');
      var crHtml = acc.credits.map(function (c) {
        return '<div class="t-entry-row"><span>' + esc(c.entryId) + ': ' + esc(c.particulars) + '</span><span class="amt">' + fmt(c.amount) + '</span></div>';
      }).join('');

      // Add c/d balancing line on shorter side if non-zero
      if (acc.closingBalance > 0) {
        if (acc.closingSide === 'Dr') {
          crHtml += '<div class="t-entry-row cd-row"><span>By Balance c/d</span><span class="amt">' + fmt(acc.closingBalance) + '</span></div>';
        } else {
          drHtml += '<div class="t-entry-row cd-row"><span>To Balance c/d</span><span class="amt">' + fmt(acc.closingBalance) + '</span></div>';
        }
      }

      if (!drHtml) drHtml = '<div class="t-entry-row muted-note"><span>&mdash;</span><span class="amt">0.00</span></div>';
      if (!crHtml) crHtml = '<div class="t-entry-row muted-note"><span>&mdash;</span><span class="amt">0.00</span></div>';

      var badgeText = acc.closingBalance > 0
        ? 'Bal: ' + fmt(acc.closingBalance) + ' (' + acc.closingSide + ')'
        : 'Nil Balance';

      return '' +
        '<div class="t-account-box">' +
          '<div class="t-account-header">' +
            '<span>' + esc(acc.name) + ' A/c (' + esc(acc.type) + ')</span>' +
            '<span class="badge">' + esc(badgeText) + '</span>' +
          '</div>' +
          '<div class="t-sides">' +
            '<div class="t-side-dr">' +
              '<div class="t-side-title"><span>Dr. (Particulars)</span><span>Amount (₹)</span></div>' +
              drHtml +
              '<div class="t-total-row"><span>Total</span><span>' + fmt(acc.balancedTotal) + '</span></div>' +
            '</div>' +
            '<div>' +
              '<div class="t-side-title"><span>Cr. (Particulars)</span><span>Amount (₹)</span></div>' +
              crHtml +
              '<div class="t-total-row"><span>Total</span><span>' + fmt(acc.balancedTotal) + '</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    // 4. Trial Balance Table
    var tbBody = document.getElementById('trial-balance-tbody');
    if (tb.rows.length === 0) {
      tbBody.innerHTML = '<tr><td colspan="4" class="muted-note">Trial Balance awaits first journal posting.</td></tr>';
    } else {
      tbBody.innerHTML = tb.rows.map(function (r) {
        return '<tr>' +
          '<td>' + esc(r.account) + '</td>' +
          '<td>' + esc(r.type) + '</td>' +
          '<td class="num">' + (r.debitBalance > 0 ? fmt(r.debitBalance) : '&mdash;') + '</td>' +
          '<td class="num">' + (r.creditBalance > 0 ? fmt(r.creditBalance) : '&mdash;') + '</td>' +
        '</tr>';
      }).join('') +
      '<tr class="total-row">' +
        '<td colspan="2">TRIAL BALANCE TOTAL (Equilibrium Check: ' + (tb.isBalanced ? 'Dr = Cr Verified' : 'Mismatch') + ')</td>' +
        '<td class="num">' + fmt(tb.totalDebit) + '</td>' +
        '<td class="num">' + fmt(tb.totalCredit) + '</td>' +
      '</tr>';
    }
  }

  function showToast(msg, isErr) {
    var box = document.getElementById('ledger-feedback');
    if (!box) return;
    box.style.display = 'block';
    box.className = isErr ? 'callout callout-rust' : 'callout callout-forest';
    box.textContent = msg;
  }

  function bindEvents() {
    ['qtn-workshop-name', 'qtn-id', 'qtn-customer', 'qtn-date', 'qtn-validity'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        state.workshop.name = document.getElementById('qtn-workshop-name').value.trim() || 'Precision Fab Workshop';
        state.jobMeta.quoteId = document.getElementById('qtn-id').value.trim() || 'QTN-001';
        state.jobMeta.customerName = document.getElementById('qtn-customer').value.trim() || 'Customer';
        state.jobMeta.issueDate = document.getElementById('qtn-date').value || '2026-11-26';
        state.jobMeta.validityDays = Number(document.getElementById('qtn-validity').value) || 15;
        root.JobShopState.save(state);
        root.JobShopNav.renderHeader('ledger');
        renderQuotationCard();
      });
    });

    document.getElementById('qtn-gst-rate').addEventListener('change', function (e) {
      state.jobMeta.gstRatePct = Number(e.target.value) || 0;
      root.JobShopState.save(state);
      renderQuotationCard();
    });

    document.getElementById('rcpt-amount').addEventListener('input', function (e) {
      e.target.dataset.userEdited = '1';
    });

    document.getElementById('btn-accept-quote').addEventListener('click', function () {
      try {
        var q = getActiveQuoteTotals();
        state.ledger = root.JobShopLedger.postCreditSale(state.ledger, {
          date: state.jobMeta.issueDate,
          quoteId: state.jobMeta.quoteId,
          jobId: state.jobMeta.jobId,
          customerName: state.jobMeta.customerName,
          taxableAmount: q.taxable,
          gstRatePct: q.gstRate
        });
        if (state.jobMeta.acceptedQuoteIds.indexOf(state.jobMeta.quoteId) === -1) {
          state.jobMeta.acceptedQuoteIds.push(state.jobMeta.quoteId);
        }
        root.JobShopState.save(state);
        renderQuotationCard();
        renderAccountingBooks();
        showToast('Quotation accepted! Credit sale posted: Dr. Sundry Debtors ' + fmt(q.grandTotal) + ' / Cr. Sales Revenue ' + fmt(q.taxable) + '.', false);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('btn-post-receipt').addEventListener('click', function () {
      try {
        var amt = Number(document.getElementById('rcpt-amount').value) || 0;
        var mode = document.getElementById('rcpt-mode').value;
        var date = document.getElementById('rcpt-date').value || state.jobMeta.issueDate;
        var ref = document.getElementById('rcpt-ref').value.trim();

        var tAccounts = root.JobShopLedger.computeTAccounts(state.ledger);
        var openDebtors = tAccounts['Sundry Debtors'].closingSide === 'Dr' ? tAccounts['Sundry Debtors'].closingBalance : 0;
        if (amt > openDebtors + 0.01) {
          throw new Error('Payment amount (' + fmt(amt) + ') exceeds open Sundry Debtors balance (' + fmt(openDebtors) + ').');
        }

        state.ledger = root.JobShopLedger.postPaymentReceipt(state.ledger, {
          date: date,
          customerName: state.jobMeta.customerName,
          amount: amt,
          paymentMode: mode,
          reference: ref
        });
        document.getElementById('rcpt-amount').dataset.userEdited = '';
        root.JobShopState.save(state);
        renderAccountingBooks();
        showToast('Payment receipt posted: Dr. Bank / Cash ' + fmt(amt) + ' / Cr. Sundry Debtors ' + fmt(amt) + '.', false);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('btn-clear-ledger').addEventListener('click', function () {
      state.ledger = root.JobShopLedger.createEmptyLedger();
      state.jobMeta.acceptedQuoteIds = [];
      document.getElementById('rcpt-amount').dataset.userEdited = '';
      root.JobShopState.save(state);
      renderQuotationCard();
      renderAccountingBooks();
      showToast('Ledger history cleared cleanly.', false);
    });

    document.getElementById('btn-print-ledger').addEventListener('click', function () {
      root.print();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    root.JobShopNav.renderHeader('ledger');
    root.JobShopNav.renderJobStatusBar();
    syncInputs();
    renderQuotationCard();
    renderAccountingBooks();
    bindEvents();
  });
}(window));
