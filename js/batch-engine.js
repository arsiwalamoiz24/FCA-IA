/**
 * batch-engine.js
 * Economic Batch Quantity (EBQ) optimizer, SVG sensitivity curve builder,
 * and Make-or-Buy relevant cost comparator.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JobShopBatch = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function calculateEBQ(annualDemand, setupCost, holdingCost) {
    var D = Number(annualDemand) || 0;
    var S = Number(setupCost) || 0;
    var H = Number(holdingCost) || 0;

    if (D <= 0 || S <= 0 || H <= 0) {
      return {
        valid: false,
        error: 'Annual demand (D), setup cost (S), and holding cost (H) must all be strictly greater than zero.'
      };
    }

    var rawEbq = Math.sqrt((2 * D * S) / H);
    var ebq = round2(rawEbq);
    var runsPerYear = round2(D / rawEbq);
    var cycleDays = round2(365 / runsPerYear);
    var annualSetupCost = round2((D / rawEbq) * S);
    var annualHoldingCost = round2((rawEbq / 2) * H);
    var totalInventoryCost = round2(annualSetupCost + annualHoldingCost);

    var multipliers = [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 2.00];
    var sensitivityRows = multipliers.map(function (m) {
      var q = Math.max(1, Math.round(rawEbq * m));
      var batches = D / q;
      var setup = batches * S;
      var holding = (q / 2) * H;
      var total = setup + holding;
      return {
        label: Math.round(m * 100) + '%' + (m === 1 ? ' (EBQ)' : ''),
        isOptimal: m === 1,
        batchSize: q,
        batchesPerYear: round2(batches),
        annualSetupCost: round2(setup),
        annualHoldingCost: round2(holding),
        totalAnnualCost: round2(total)
      };
    });

    return {
      valid: true,
      annualDemand: D,
      setupCost: S,
      holdingCost: H,
      ebq: ebq,
      ebqRoundedUnits: Math.max(1, Math.round(rawEbq)),
      runsPerYear: runsPerYear,
      cycleDays: cycleDays,
      annualSetupCost: annualSetupCost,
      annualHoldingCost: annualHoldingCost,
      totalInventoryCost: totalInventoryCost,
      sensitivityRows: sensitivityRows,
      workingFormula: 'EBQ = √((2 × ' + D.toLocaleString('en-IN') + ' × ₹' + S + ') / ₹' + H + ') = √(' + ((2 * D * S) / H).toLocaleString('en-IN') + ') = ' + ebq + ' units'
    };
  }

  /**
   * Builds a clean paper-and-ink vector SVG plotting Setup, Holding, and Total Cost curves.
   */
  function buildEBQChartSVG(res) {
    if (!res || !res.valid) {
      return '<div class="muted-note">Enter valid positive values to render the EBQ cost tradeoff curve.</div>';
    }

    var W = 680, H_svg = 270;
    var pad = { top: 24, right: 24, bottom: 42, left: 66 };
    var plotW = W - pad.left - pad.right;
    var plotH = H_svg - pad.top - pad.bottom;

    var minQ = Math.max(1, res.ebq * 0.25);
    var maxQ = Math.max(minQ + 1, res.ebq * 2.15);

    var samples = 48;
    var ptsSetup = [];
    var ptsHold = [];
    var ptsTotal = [];
    var maxCost = 0;

    for (var i = 0; i <= samples; i++) {
      var q = minQ + (maxQ - minQ) * (i / samples);
      var sc = (res.annualDemand / q) * res.setupCost;
      var hc = (q / 2) * res.holdingCost;
      var tc = sc + hc;
      if (tc > maxCost) maxCost = tc;
      ptsSetup.push({ q: q, y: sc });
      ptsHold.push({ q: q, y: hc });
      ptsTotal.push({ q: q, y: tc });
    }

    var yCeiling = maxCost * 1.08;
    function xPos(q) { return pad.left + ((q - minQ) / (maxQ - minQ)) * plotW; }
    function yPos(cost) { return pad.top + plotH - (cost / yCeiling) * plotH; }

    function toPolyline(arr) {
      return arr.map(function (pt) {
        return xPos(pt.q).toFixed(1) + ',' + yPos(pt.y).toFixed(1);
      }).join(' ');
    }

    var optX = xPos(res.ebq).toFixed(1);
    var optCrossY = yPos(res.annualSetupCost).toFixed(1);
    var optTotalY = yPos(res.totalInventoryCost).toFixed(1);

    // Build Y grid ticks (4 steps)
    var gridHtml = '';
    for (var g = 0; g <= 4; g++) {
      var val = (yCeiling * g) / 4;
      var gy = yPos(val).toFixed(1);
      gridHtml += '<line x1="' + pad.left + '" y1="' + gy + '" x2="' + (W - pad.right) + '" y2="' + gy + '" stroke="#E4E0D8" stroke-width="1" />';
      gridHtml += '<text x="' + (pad.left - 8) + '" y="' + (parseFloat(gy) + 3) + '" text-anchor="end" font-size="10" fill="#5C615E" font-family="ui-monospace, Menlo, monospace">₹' + Math.round(val).toLocaleString('en-IN') + '</text>';
    }

    // Build X axis ticks
    var xTicks = [0.5, 1.0, 1.5, 2.0];
    xTicks.forEach(function (m) {
      var qTick = res.ebq * m;
      var tx = xPos(qTick).toFixed(1);
      gridHtml += '<text x="' + tx + '" y="' + (H_svg - pad.bottom + 16) + '" text-anchor="middle" font-size="10" fill="' + (m === 1 ? '#1E3A5F' : '#5C615E') + '" font-weight="' + (m === 1 ? '700' : '400') + '" font-family="ui-monospace, Menlo, monospace">' + Math.round(qTick).toLocaleString('en-IN') + '</text>';
    });

    return '' +
      '<svg viewBox="0 0 ' + W + ' ' + H_svg + '" class="ebq-svg" role="img" aria-label="EBQ Cost Minimization Curve">' +
        '<rect x="' + pad.left + '" y="' + pad.top + '" width="' + plotW + '" height="' + plotH + '" fill="#FFFFFF" stroke="#D8D4CB" stroke-width="1" />' +
        gridHtml +
        '<line x1="' + optX + '" y1="' + pad.top + '" x2="' + optX + '" y2="' + (H_svg - pad.bottom) + '" stroke="#8B3A3A" stroke-width="1.2" stroke-dasharray="4,3" />' +
        '<polyline fill="none" stroke="#1E3A5F" stroke-width="2" points="' + toPolyline(ptsSetup) + '" />' +
        '<polyline fill="none" stroke="#23533A" stroke-width="2" points="' + toPolyline(ptsHold) + '" />' +
        '<polyline fill="none" stroke="#1F2421" stroke-width="2.4" points="' + toPolyline(ptsTotal) + '" />' +
        '<circle cx="' + optX + '" cy="' + optCrossY + '" r="4.5" fill="#8B3A3A" stroke="#FFFFFF" stroke-width="1.5" />' +
        '<circle cx="' + optX + '" cy="' + optTotalY + '" r="4.5" fill="#1F2421" stroke="#FFFFFF" stroke-width="1.5" />' +
        '<text x="' + (parseFloat(optX) + 8) + '" y="' + (parseFloat(optTotalY) - 7) + '" font-size="10" font-weight="700" fill="#1F2421">Min Total: ₹' + res.totalInventoryCost.toLocaleString('en-IN') + '</text>' +
        '<text x="' + (parseFloat(optX) + 8) + '" y="' + (parseFloat(optCrossY) + 15) + '" font-size="10" font-weight="700" fill="#8B3A3A">EBQ Cross: ₹' + res.annualSetupCost.toLocaleString('en-IN') + '</text>' +
        '<text x="' + (pad.left + plotW / 2) + '" y="' + (H_svg - 6) + '" text-anchor="middle" font-size="10.5" font-weight="600" fill="#1F2421">Batch Production Size (Units)</text>' +
      '</svg>';
  }

  /**
   * Make-or-Buy Differential Cost Comparator (Module 3/4 Relevant Costing)
   * Evaluates Variable Manufacturing Cost + Avoidable Setup + Opportunity Cost vs Vendor Price.
   */
  function evaluateMakeOrBuy(params) {
    var p = params || {};
    var batchQty = Math.max(1, Number(p.batchQty) || 1);
    var makeVarPerUnit = Math.max(0, Number(p.makeVariablePerUnit) || 0);
    var makeAvoidableSetup = Math.max(0, Number(p.makeAvoidableSetup) || 0);
    var opportunityCost = Math.max(0, Number(p.opportunityCost) || 0);
    var sunkFixedExcluded = Math.max(0, Number(p.sunkFixedExcluded) || 0);
    var vendorUnitPrice = Math.max(0, Number(p.vendorUnitPrice) || 0);
    var vendorLogistics = Math.max(0, Number(p.vendorLogistics) || 0);

    var makeVariableTotal = round2(batchQty * makeVarPerUnit);
    var totalMakeCost = round2(makeVariableTotal + makeAvoidableSetup + opportunityCost);
    var makePerUnitEffective = round2(totalMakeCost / batchQty);

    var buyPurchaseTotal = round2(batchQty * vendorUnitPrice);
    var totalBuyCost = round2(buyPurchaseTotal + vendorLogistics);
    var buyPerUnitEffective = round2(totalBuyCost / batchQty);

    var diff = round2(totalBuyCost - totalMakeCost);
    var decision = 'INDIFFERENT';
    if (diff > 0.01) decision = 'MAKE';
    else if (diff < -0.01) decision = 'BUY';

    var savingsInr = round2(Math.abs(diff));

    // Break-even indifference quantity where totalMakeCost === totalBuyCost
    var unitSpread = vendorUnitPrice - makeVarPerUnit;
    var fixedDiff = (makeAvoidableSetup + opportunityCost) - vendorLogistics;
    var indifferenceQty = null;
    if (Math.abs(unitSpread) > 0.001) {
      var candidate = fixedDiff / unitSpread;
      if (candidate > 0) indifferenceQty = Math.round(candidate);
    }

    return {
      batchQty: batchQty,
      makeVariablePerUnit: round2(makeVarPerUnit),
      makeVariableTotal: makeVariableTotal,
      makeAvoidableSetup: round2(makeAvoidableSetup),
      opportunityCost: round2(opportunityCost),
      sunkFixedExcluded: round2(sunkFixedExcluded),
      totalMakeCost: totalMakeCost,
      makePerUnitEffective: makePerUnitEffective,
      vendorUnitPrice: round2(vendorUnitPrice),
      buyPurchaseTotal: buyPurchaseTotal,
      vendorLogistics: round2(vendorLogistics),
      totalBuyCost: totalBuyCost,
      buyPerUnitEffective: buyPerUnitEffective,
      decision: decision,
      savingsInr: savingsInr,
      indifferenceQty: indifferenceQty
    };
  }

  return {
    calculateEBQ: calculateEBQ,
    buildEBQChartSVG: buildEBQChartSVG,
    evaluateMakeOrBuy: evaluateMakeOrBuy
  };
}));
