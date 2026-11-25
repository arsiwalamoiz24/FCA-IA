/**
 * page-costing.js
 * Controls Page 2 (costing.html): Job Card record, Hierarchical Cost Sheet,
 * Overhead absorption rules, and Markup vs. Margin Profit Calculator.
 */
(function (root) {
  'use strict';

  var state = root.JobShopState.load();
  var fmt = root.JobShopState.formatINR;
  var esc = root.JobShopState.escapeHTML;

  function syncInputsFromState() {
    // Job Card meta
    document.getElementById('jc-job-id').value = state.jobMeta.jobId;
    document.getElementById('jc-customer').value = state.jobMeta.customerName;
    document.getElementById('jc-part').value = state.jobMeta.partName;
    document.getElementById('jc-mrn').value = state.jobMeta.mrnNo;
    document.getElementById('jc-tt').value = state.jobMeta.timeTicketNo;
    document.getElementById('jc-machine').value = state.jobMeta.machineCenter;
    document.getElementById('jc-date').value = state.jobMeta.issueDate;
    document.getElementById('jc-qty').value = state.costInputs.quantity;

    // Direct Costs
    document.getElementById('cs-dm').value = state.costInputs.directMaterial;
    document.getElementById('cs-scrap').value = state.costInputs.scrapCredit;
    document.getElementById('cs-dl-hrs').value = state.costInputs.labourHours;
    document.getElementById('cs-dl-rate').value = state.costInputs.labourRate;
    document.getElementById('cs-de').value = state.costInputs.directExpenses;

    // Overheads
    document.getElementById('cs-foh-mode').value = state.costInputs.factoryOhMode;
    document.getElementById('cs-mach-hrs').value = state.costInputs.machineHours;
    document.getElementById('cs-mhr').value = state.costInputs.machineHourRate;
    document.getElementById('cs-foh-pct').value = state.costInputs.factoryOhPct;
    document.getElementById('cs-foh-fixed').value = state.costInputs.factoryOhFixed;

    document.getElementById('cs-aoh-mode').value = state.costInputs.adminOhMode;
    document.getElementById('cs-aoh-pct').value = state.costInputs.adminOhPct;
    document.getElementById('cs-aoh-fixed').value = state.costInputs.adminOhFixed;

    document.getElementById('cs-soh-mode').value = state.costInputs.sellingOhMode;
    document.getElementById('cs-soh-pct').value = state.costInputs.sellingOhPct;
    document.getElementById('cs-soh-fixed').value = state.costInputs.sellingOhFixed;

    // Profit
    document.getElementById('cs-profit-pct').value = state.costInputs.profitPct;
    updateModeFieldsVisibility();
  }

  function updateModeFieldsVisibility() {
    var fMode = document.getElementById('cs-foh-mode').value;
    document.getElementById('foh-mhr-fields').style.display = fMode === 'mhr' ? 'grid' : 'none';
    document.getElementById('foh-pct-field').style.display = fMode === 'pct_dl' ? 'block' : 'none';
    document.getElementById('foh-fixed-field').style.display = fMode === 'fixed' ? 'block' : 'none';

    var aMode = document.getElementById('cs-aoh-mode').value;
    document.getElementById('aoh-pct-field').style.display = aMode === 'pct_works' ? 'block' : 'none';
    document.getElementById('aoh-fixed-field').style.display = aMode === 'fixed' ? 'block' : 'none';

    var sMode = document.getElementById('cs-soh-mode').value;
    document.getElementById('soh-pct-field').style.display = sMode !== 'fixed' ? 'block' : 'none';
    document.getElementById('soh-fixed-field').style.display = sMode === 'fixed' ? 'block' : 'none';

    var pMode = state.costInputs.profitMode;
    document.getElementById('btn-profit-markup').classList.toggle('active', pMode === 'markup_cost');
    document.getElementById('btn-profit-margin').classList.toggle('active', pMode === 'margin_sales');
  }

  function readAndRenderCostSheet() {
    state.jobMeta.jobId = document.getElementById('jc-job-id').value.trim() || 'JOB-001';
    state.jobMeta.customerName = document.getElementById('jc-customer').value.trim() || 'Client';
    state.jobMeta.partName = document.getElementById('jc-part').value.trim() || 'Custom Job';
    state.jobMeta.mrnNo = document.getElementById('jc-mrn').value.trim() || 'MRN-01';
    state.jobMeta.timeTicketNo = document.getElementById('jc-tt').value.trim() || 'TT-01';
    state.jobMeta.machineCenter = document.getElementById('jc-machine').value.trim() || 'Cell-1';
    state.jobMeta.issueDate = document.getElementById('jc-date').value || '2026-11-26';

    state.costInputs.quantity = Math.max(1, Number(document.getElementById('jc-qty').value) || 1);
    state.costInputs.directMaterial = Number(document.getElementById('cs-dm').value) || 0;
    state.costInputs.scrapCredit = Number(document.getElementById('cs-scrap').value) || 0;
    state.costInputs.labourHours = Number(document.getElementById('cs-dl-hrs').value) || 0;
    state.costInputs.labourRate = Number(document.getElementById('cs-dl-rate').value) || 0;
    state.costInputs.directExpenses = Number(document.getElementById('cs-de').value) || 0;

    state.costInputs.factoryOhMode = document.getElementById('cs-foh-mode').value;
    state.costInputs.machineHours = Number(document.getElementById('cs-mach-hrs').value) || 0;
    state.costInputs.machineHourRate = Number(document.getElementById('cs-mhr').value) || 0;
    state.costInputs.factoryOhPct = Number(document.getElementById('cs-foh-pct').value) || 0;
    state.costInputs.factoryOhFixed = Number(document.getElementById('cs-foh-fixed').value) || 0;

    state.costInputs.adminOhMode = document.getElementById('cs-aoh-mode').value;
    state.costInputs.adminOhPct = Number(document.getElementById('cs-aoh-pct').value) || 0;
    state.costInputs.adminOhFixed = Number(document.getElementById('cs-aoh-fixed').value) || 0;

    state.costInputs.sellingOhMode = document.getElementById('cs-soh-mode').value;
    state.costInputs.sellingOhPct = Number(document.getElementById('cs-soh-pct').value) || 0;
    state.costInputs.sellingOhFixed = Number(document.getElementById('cs-soh-fixed').value) || 0;

    state.costInputs.profitPct = Number(document.getElementById('cs-profit-pct').value) || 0;

    root.JobShopState.save(state);

    var res = root.JobShopCosting.calculateJobCostSheet(state.costInputs);

    // KPI tiles
    document.getElementById('kpi-prime').textContent = fmt(res.primeCost);
    document.getElementById('kpi-works').textContent = fmt(res.worksCost);
    document.getElementById('kpi-total-cost').textContent = fmt(res.costOfSales);
    document.getElementById('kpi-quote').textContent = fmt(res.quotationPrice);
    document.getElementById('kpi-unit-quote').textContent = fmt(res.perUnit.quotationPrice) + ' / unit';

    // Formal Job Card Display
    document.getElementById('job-card-summary').innerHTML = '' +
      '<div class="meta-cell"><label>Job Order No.</label><span>' + esc(state.jobMeta.jobId) + '</span></div>' +
      '<div class="meta-cell"><label>Customer</label><span>' + esc(state.jobMeta.customerName) + '</span></div>' +
      '<div class="meta-cell"><label>Material Req. (MRN)</label><span>' + esc(state.jobMeta.mrnNo) + '</span></div>' +
      '<div class="meta-cell"><label>Time Ticket / Machine</label><span>' + esc(state.jobMeta.timeTicketNo) + ' (' + esc(state.jobMeta.machineCenter) + ')</span></div>';

    // Cost Sheet Table Rows
    var scrapHtml = res.scrapCredit > 0
      ? '<tr><td>Less: Recoverable Scrap Realized<span class="working-subline">Chip / scrap recovery credit deducted at Works level</span></td><td class="num">(' + fmt(res.scrapCredit) + ')</td><td class="num">(' + fmt(res.perUnit.scrapCredit) + ')</td></tr>'
      : '';

    var tbody = document.getElementById('cost-sheet-tbody');
    tbody.innerHTML = '' +
      '<tr><td>Direct Materials Consumed<span class="working-subline">Issued per ' + esc(state.jobMeta.mrnNo) + ' (' + esc(state.costInputs.sourceLabel) + ')</span></td><td class="num">' + fmt(res.directMaterial) + '</td><td class="num">' + fmt(res.perUnit.directMaterial) + '</td></tr>' +
      '<tr><td>Direct Labour Wages<span class="working-subline">' + res.labourHours + ' hrs &times; ' + fmt(res.labourRate) + '/hr (' + esc(state.jobMeta.timeTicketNo) + ')</span></td><td class="num">' + fmt(res.directLabour) + '</td><td class="num">' + fmt(res.perUnit.directLabour) + '</td></tr>' +
      '<tr><td>Direct Expenses (Tooling / CAD Setup)</td><td class="num">' + fmt(res.directExpenses) + '</td><td class="num">' + fmt(res.perUnit.directExpenses) + '</td></tr>' +
      '<tr class="subtotal-row"><td>PRIME COST</td><td class="num">' + fmt(res.primeCost) + '</td><td class="num">' + fmt(res.perUnit.primeCost) + '</td></tr>' +
      '<tr><td>Add: Factory / Works Overheads<span class="working-subline">' + esc(res.factoryWorking) + '</span></td><td class="num">' + fmt(res.factoryOverheads) + '</td><td class="num">' + fmt(res.perUnit.factoryOverheads) + '</td></tr>' +
      scrapHtml +
      '<tr class="subtotal-row"><td>WORKS COST (FACTORY COST)</td><td class="num">' + fmt(res.worksCost) + '</td><td class="num">' + fmt(res.perUnit.worksCost) + '</td></tr>' +
      '<tr><td>Add: Office &amp; Administration Overheads<span class="working-subline">' + esc(res.adminWorking) + '</span></td><td class="num">' + fmt(res.adminOverheads) + '</td><td class="num">' + fmt(res.perUnit.adminOverheads) + '</td></tr>' +
      '<tr class="subtotal-row"><td>COST OF PRODUCTION</td><td class="num">' + fmt(res.costOfProduction) + '</td><td class="num">' + fmt(res.perUnit.costOfProduction) + '</td></tr>' +
      '<tr><td>Add: Selling &amp; Distribution Overheads<span class="working-subline">' + esc(res.sellingWorking) + '</span></td><td class="num">' + fmt(res.sellingOverheads) + '</td><td class="num">' + fmt(res.perUnit.sellingOverheads) + '</td></tr>' +
      '<tr class="subtotal-row"><td>COST OF SALES (TOTAL COST)</td><td class="num">' + fmt(res.costOfSales) + '</td><td class="num">' + fmt(res.perUnit.costOfSales) + '</td></tr>' +
      '<tr><td>Add: Target Profit<span class="working-subline">' + esc(res.profitWorking) + '</span></td><td class="num">' + fmt(res.profitAmount) + '</td><td class="num">' + fmt(res.perUnit.profitAmount) + '</td></tr>' +
      '<tr class="total-row"><td>FINAL QUOTATION / SELLING PRICE</td><td class="num">' + fmt(res.quotationPrice) + '</td><td class="num">' + fmt(res.perUnit.quotationPrice) + '</td></tr>';

    document.getElementById('profit-audit-note').innerHTML = '' +
      '<strong>Pricing Audit:</strong> Target Profit of <strong>' + fmt(res.profitAmount) + '</strong> equals ' +
      '<strong>' + res.effectiveMarkupOnCost.toFixed(2) + '% Markup on Cost</strong> and ' +
      '<strong>' + res.effectiveMarginOnSales.toFixed(2) + '% Gross Margin on Sales</strong>.';

    root.JobShopNav.renderJobStatusBar();
  }

  function bindEvents() {
    document.getElementById('btn-profit-markup').addEventListener('click', function () {
      state.costInputs.profitMode = 'markup_cost';
      updateModeFieldsVisibility();
      readAndRenderCostSheet();
    });

    document.getElementById('btn-profit-margin').addEventListener('click', function () {
      state.costInputs.profitMode = 'margin_sales';
      updateModeFieldsVisibility();
      readAndRenderCostSheet();
    });

    ['cs-foh-mode', 'cs-aoh-mode', 'cs-soh-mode'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        updateModeFieldsVisibility();
        readAndRenderCostSheet();
      });
    });

    document.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', readAndRenderCostSheet);
    });

    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state = root.JobShopState.applyPreset(state, btn.getAttribute('data-preset'));
        syncInputsFromState();
        readAndRenderCostSheet();
      });
    });

    document.getElementById('btn-print-costing').addEventListener('click', function () {
      root.print();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    root.JobShopNav.renderHeader('costing');
    syncInputsFromState();
    readAndRenderCostSheet();
    bindEvents();
  });
}(window));
