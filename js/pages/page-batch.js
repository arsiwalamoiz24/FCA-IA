/**
 * page-batch.js
 * Controls Page 3 (batch.html): Economic Batch Quantity (EBQ) optimizer,
 * SVG cost curve visualization, sensitivity table, and Make-or-Buy decision comparator.
 */
(function (root) {
  'use strict';

  var state = root.JobShopState.load();
  var fmt = root.JobShopState.formatINR;
  var esc = root.JobShopState.escapeHTML;

  function syncInputs() {
    document.getElementById('ebq-demand').value = state.ebqInputs.annualDemand;
    document.getElementById('ebq-setup').value = state.ebqInputs.setupCost;
    document.getElementById('ebq-holding').value = state.ebqInputs.holdingCost;

    document.getElementById('mob-qty').value = state.makeOrBuyInputs.batchQty;
    document.getElementById('mob-var-cost').value = state.makeOrBuyInputs.makeVariablePerUnit;
    document.getElementById('mob-setup').value = state.makeOrBuyInputs.makeAvoidableSetup;
    document.getElementById('mob-opp').value = state.makeOrBuyInputs.opportunityCost;
    document.getElementById('mob-sunk').value = state.makeOrBuyInputs.sunkFixedExcluded;
    document.getElementById('mob-vendor-price').value = state.makeOrBuyInputs.vendorUnitPrice;
    document.getElementById('mob-vendor-freight').value = state.makeOrBuyInputs.vendorLogistics;
  }

  function renderAll() {
    state.ebqInputs.annualDemand = Number(document.getElementById('ebq-demand').value) || 0;
    state.ebqInputs.setupCost = Number(document.getElementById('ebq-setup').value) || 0;
    state.ebqInputs.holdingCost = Number(document.getElementById('ebq-holding').value) || 0;

    state.makeOrBuyInputs.batchQty = Math.max(1, Number(document.getElementById('mob-qty').value) || 1);
    state.makeOrBuyInputs.makeVariablePerUnit = Number(document.getElementById('mob-var-cost').value) || 0;
    state.makeOrBuyInputs.makeAvoidableSetup = Number(document.getElementById('mob-setup').value) || 0;
    state.makeOrBuyInputs.opportunityCost = Number(document.getElementById('mob-opp').value) || 0;
    state.makeOrBuyInputs.sunkFixedExcluded = Number(document.getElementById('mob-sunk').value) || 0;
    state.makeOrBuyInputs.vendorUnitPrice = Number(document.getElementById('mob-vendor-price').value) || 0;
    state.makeOrBuyInputs.vendorLogistics = Number(document.getElementById('mob-vendor-freight').value) || 0;

    root.JobShopState.save(state);

    // 1. EBQ Calculation & Rendering
    var ebq = root.JobShopBatch.calculateEBQ(
      state.ebqInputs.annualDemand,
      state.ebqInputs.setupCost,
      state.ebqInputs.holdingCost
    );

    if (ebq.valid) {
      document.getElementById('kpi-ebq').textContent = ebq.ebq.toLocaleString('en-IN') + ' units';
      document.getElementById('kpi-batches').textContent = ebq.runsPerYear.toFixed(2) + ' runs/yr';
      document.getElementById('kpi-cycle').textContent = ebq.cycleDays.toFixed(1) + ' days';
      document.getElementById('kpi-ebq-cost').textContent = fmt(ebq.totalInventoryCost);

      document.getElementById('ebq-working').innerHTML = '' +
        '<div><strong>Formula:</strong> EBQ = &radic;((2 &times; D &times; S) / H)</div>' +
        '<div>' + esc(ebq.workingFormula) + '</div>' +
        '<div>At EBQ: Annual Setup (' + fmt(ebq.annualSetupCost) + ') &equiv; Annual Holding (' + fmt(ebq.annualHoldingCost) + ')</div>';

      document.getElementById('ebq-chart-container').innerHTML = root.JobShopBatch.buildEBQChartSVG(ebq);

      var rowsHtml = ebq.sensitivityRows.map(function (r) {
        var cls = r.isOptimal ? ' class="highlight-row"' : '';
        return '<tr' + cls + '>' +
          '<td>' + esc(r.label) + '</td>' +
          '<td class="num">' + r.batchSize.toLocaleString('en-IN') + '</td>' +
          '<td class="num">' + r.batchesPerYear.toFixed(2) + '</td>' +
          '<td class="num">' + fmt(r.annualSetupCost) + '</td>' +
          '<td class="num">' + fmt(r.annualHoldingCost) + '</td>' +
          '<td class="num">' + fmt(r.totalAnnualCost) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('ebq-sensitivity-tbody').innerHTML = rowsHtml;
    } else {
      document.getElementById('kpi-ebq').textContent = '—';
      document.getElementById('kpi-batches').textContent = '—';
      document.getElementById('kpi-cycle').textContent = '—';
      document.getElementById('kpi-ebq-cost').textContent = '—';
      document.getElementById('ebq-working').textContent = ebq.error;
      document.getElementById('ebq-chart-container').innerHTML = '';
      document.getElementById('ebq-sensitivity-tbody').innerHTML = '';
    }

    // 2. Make-or-Buy Evaluation
    var mob = root.JobShopBatch.evaluateMakeOrBuy(state.makeOrBuyInputs);
    var mobBody = document.getElementById('mob-table-body');
    mobBody.innerHTML = '' +
      '<tr><td>Variable Manufacturing Cost (' + mob.batchQty + ' &times; ' + fmt(mob.makeVariablePerUnit) + ')</td><td class="num">' + fmt(mob.makeVariableTotal) + '</td><td class="num">&mdash;</td></tr>' +
      '<tr><td>Avoidable Setup &amp; Tooling Cost</td><td class="num">' + fmt(mob.makeAvoidableSetup) + '</td><td class="num">&mdash;</td></tr>' +
      '<tr><td>Opportunity Cost (Forgone Contribution)</td><td class="num">' + fmt(mob.opportunityCost) + '</td><td class="num">&mdash;</td></tr>' +
      '<tr><td>Vendor Purchase Price (' + mob.batchQty + ' &times; ' + fmt(mob.vendorUnitPrice) + ')</td><td class="num">&mdash;</td><td class="num">' + fmt(mob.buyPurchaseTotal) + '</td></tr>' +
      '<tr><td>Inbound Freight &amp; Inspection Charges</td><td class="num">&mdash;</td><td class="num">' + fmt(mob.vendorLogistics) + '</td></tr>' +
      '<tr class="total-row"><td>TOTAL RELEVANT COST</td><td class="num">' + fmt(mob.totalMakeCost) + '</td><td class="num">' + fmt(mob.totalBuyCost) + '</td></tr>' +
      '<tr><td>Effective Relevant Cost per Unit</td><td class="num">' + fmt(mob.makePerUnitEffective) + '</td><td class="num">' + fmt(mob.buyPerUnitEffective) + '</td></tr>';

    var banner = document.getElementById('mob-verdict-banner');
    if (mob.decision === 'MAKE') {
      banner.className = 'callout callout-forest';
      banner.innerHTML = '<strong>Recommendation: MAKE IN-HOUSE</strong> &mdash; Manufacturing internally saves <strong>' + fmt(mob.savingsInr) + '</strong> compared to outsourcing.' +
        (mob.indifferenceQty ? ' (Break-even indifference batch size: <strong>' + mob.indifferenceQty.toLocaleString('en-IN') + ' units</strong>.)' : '');
    } else if (mob.decision === 'BUY') {
      banner.className = 'callout callout-rust';
      banner.innerHTML = '<strong>Recommendation: OUTSOURCE (BUY FROM VENDOR)</strong> &mdash; Buying externally saves <strong>' + fmt(mob.savingsInr) + '</strong> compared to in-house production.' +
        (mob.indifferenceQty ? ' (In-house only breaks even above <strong>' + mob.indifferenceQty.toLocaleString('en-IN') + ' units</strong>.)' : '');
    } else {
      banner.className = 'callout';
      banner.innerHTML = '<strong>Recommendation: COST INDIFFERENT</strong> &mdash; Both alternatives carry equal relevant cost (' + fmt(mob.totalMakeCost) + '). Evaluate quality &amp; lead-time constraints.';
    }

    document.getElementById('mob-sunk-note').textContent =
      'Sunk Cost Rule: Fixed factory rent/allocated salaries of ' + fmt(mob.sunkFixedExcluded) + ' remain unchanged under both options and are excluded from differential decision analysis.';
  }

  function bindEvents() {
    document.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', renderAll);
    });

    document.getElementById('btn-load-ebq-bench').addEventListener('click', function () {
      state = root.JobShopState.applyPreset(state, 'ebq_benchmark');
      syncInputs();
      renderAll();
    });

    document.getElementById('btn-sync-from-costsheet').addEventListener('click', function () {
      var costSummary = root.JobShopCosting.calculateJobCostSheet(state.costInputs);
      document.getElementById('mob-qty').value = costSummary.quantity;
      document.getElementById('mob-var-cost').value = costSummary.variableCostPerUnit;
      renderAll();
    });

    document.getElementById('btn-suggest-holding').addEventListener('click', function () {
      var costSummary = root.JobShopCosting.calculateJobCostSheet(state.costInputs);
      var estHolding = Math.max(0.5, Math.round(costSummary.perUnit.costOfProduction * 0.15 * 100) / 100);
      document.getElementById('ebq-holding').value = estHolding;
      renderAll();
    });

    document.getElementById('btn-print-batch').addEventListener('click', function () {
      root.print();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    root.JobShopNav.renderHeader('batch');
    root.JobShopNav.renderJobStatusBar();
    syncInputs();
    renderAll();
    bindEvents();
  });
}(window));
