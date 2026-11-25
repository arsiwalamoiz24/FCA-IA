/**
 * cost-engine.js
 * Institutional Job Cost Sheet compiler & Markup/Margin pricing engine.
 * Follows Module 3 & Module 4 hierarchy: Prime Cost -> Works Cost -> Cost of Production -> Cost of Sales -> Quotation Price.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JobShopCosting = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function calculateJobCostSheet(params) {
    var p = params || {};
    var quantity = Math.max(1, Number(p.quantity) || 1);

    var directMaterial = Math.max(0, Number(p.directMaterial) || 0);
    var labourHours = Math.max(0, Number(p.labourHours) || 0);
    var labourRate = Math.max(0, Number(p.labourRate) || 0);
    var directLabour = round2(labourHours * labourRate);
    var directExpenses = Math.max(0, Number(p.directExpenses) || 0);

    var primeCost = round2(directMaterial + directLabour + directExpenses);

    // Factory / Works Overheads
    var factoryMode = p.factoryOhMode || 'mhr'; // 'mhr' | 'pct_dl' | 'fixed'
    var machineHours = Math.max(0, Number(p.machineHours) || 0);
    var machineHourRate = Math.max(0, Number(p.machineHourRate) || 0);
    var factoryOhPct = Math.max(0, Number(p.factoryOhPct) || 0);
    var factoryOhFixed = Math.max(0, Number(p.factoryOhFixed) || 0);

    var factoryOverheads = 0;
    var factoryWorking = '';
    if (factoryMode === 'mhr') {
      factoryOverheads = round2(machineHours * machineHourRate);
      factoryWorking = machineHours + ' machine hrs × ₹' + machineHourRate.toFixed(2) + '/hr';
    } else if (factoryMode === 'pct_dl') {
      factoryOverheads = round2(directLabour * (factoryOhPct / 100));
      factoryWorking = factoryOhPct + '% of Direct Labour (₹' + directLabour.toFixed(2) + ')';
    } else {
      factoryOverheads = round2(factoryOhFixed);
      factoryWorking = 'Fixed factory overhead allocation';
    }

    var scrapCredit = Math.max(0, Number(p.scrapCredit) || 0);
    var worksCost = round2(Math.max(0, primeCost + factoryOverheads - scrapCredit));

    // Office & Administration Overheads
    var adminMode = p.adminOhMode || 'pct_works'; // 'pct_works' | 'fixed'
    var adminOhPct = Math.max(0, Number(p.adminOhPct) || 0);
    var adminOhFixed = Math.max(0, Number(p.adminOhFixed) || 0);

    var adminOverheads = 0;
    var adminWorking = '';
    if (adminMode === 'pct_works') {
      adminOverheads = round2(worksCost * (adminOhPct / 100));
      adminWorking = adminOhPct + '% of Works Cost (₹' + worksCost.toFixed(2) + ')';
    } else {
      adminOverheads = round2(adminOhFixed);
      adminWorking = 'Fixed administration overhead allocation';
    }

    var costOfProduction = round2(worksCost + adminOverheads);

    // Selling & Distribution Overheads
    var sellingMode = p.sellingOhMode || 'pct_cop'; // 'pct_cop' | 'pct_works' | 'fixed'
    var sellingOhPct = Math.max(0, Number(p.sellingOhPct) || 0);
    var sellingOhFixed = Math.max(0, Number(p.sellingOhFixed) || 0);

    var sellingOverheads = 0;
    var sellingWorking = '';
    if (sellingMode === 'pct_cop') {
      sellingOverheads = round2(costOfProduction * (sellingOhPct / 100));
      sellingWorking = sellingOhPct + '% of Cost of Production (₹' + costOfProduction.toFixed(2) + ')';
    } else if (sellingMode === 'pct_works') {
      sellingOverheads = round2(worksCost * (sellingOhPct / 100));
      sellingWorking = sellingOhPct + '% of Works Cost (₹' + worksCost.toFixed(2) + ')';
    } else {
      sellingOverheads = round2(sellingOhFixed);
      sellingWorking = 'Fixed selling & distribution charge';
    }

    var costOfSales = round2(costOfProduction + sellingOverheads);

    // Profit Calculation: Markup on Cost vs Margin on Selling Price
    var profitMode = p.profitMode === 'margin_sales' ? 'margin_sales' : 'markup_cost';
    var profitPct = Math.max(0, Number(p.profitPct) || 0);
    var profitAmount = 0;
    var profitWorking = '';

    if (profitMode === 'margin_sales') {
      var cappedPct = Math.min(99.9, profitPct);
      profitAmount = round2(costOfSales * (cappedPct / (100 - cappedPct)));
      profitWorking = cappedPct + '% Margin on Sales ⇒ Cost × (' + cappedPct + ' / ' + round2(100 - cappedPct) + ')';
    } else {
      profitAmount = round2(costOfSales * (profitPct / 100));
      profitWorking = profitPct + '% Markup on Total Cost (₹' + costOfSales.toFixed(2) + ')';
    }

    var quotationPrice = round2(costOfSales + profitAmount);
    var effectiveMarginOnSales = quotationPrice > 0 ? round2((profitAmount / quotationPrice) * 100) : 0;
    var effectiveMarkupOnCost = costOfSales > 0 ? round2((profitAmount / costOfSales) * 100) : 0;

    // Variable cost per unit (for downstream Make-or-Buy relevant cost transfer)
    var variableFactoryComponent = factoryMode === 'mhr' ? factoryOverheads : 0;
    var totalVariableProductionCost = round2(Math.max(0, primeCost + variableFactoryComponent - scrapCredit));
    var variableCostPerUnit = round2(totalVariableProductionCost / quantity);

    var pu = function (v) { return round2(v / quantity); };

    return {
      quantity: quantity,
      directMaterial: round2(directMaterial),
      labourHours: round2(labourHours),
      labourRate: round2(labourRate),
      directLabour: directLabour,
      directExpenses: round2(directExpenses),
      primeCost: primeCost,
      factoryOverheads: factoryOverheads,
      factoryWorking: factoryWorking,
      scrapCredit: round2(scrapCredit),
      worksCost: worksCost,
      adminOverheads: adminOverheads,
      adminWorking: adminWorking,
      costOfProduction: costOfProduction,
      sellingOverheads: sellingOverheads,
      sellingWorking: sellingWorking,
      costOfSales: costOfSales,
      profitMode: profitMode,
      profitPct: profitPct,
      profitAmount: profitAmount,
      profitWorking: profitWorking,
      quotationPrice: quotationPrice,
      effectiveMarginOnSales: effectiveMarginOnSales,
      effectiveMarkupOnCost: effectiveMarkupOnCost,
      variableCostPerUnit: variableCostPerUnit,
      perUnit: {
        directMaterial: pu(directMaterial),
        directLabour: pu(directLabour),
        directExpenses: pu(directExpenses),
        primeCost: pu(primeCost),
        factoryOverheads: pu(factoryOverheads),
        scrapCredit: pu(scrapCredit),
        worksCost: pu(worksCost),
        adminOverheads: pu(adminOverheads),
        costOfProduction: pu(costOfProduction),
        sellingOverheads: pu(sellingOverheads),
        costOfSales: pu(costOfSales),
        profitAmount: pu(profitAmount),
        quotationPrice: pu(quotationPrice)
      }
    };
  }

  return {
    calculateJobCostSheet: calculateJobCostSheet
  };
}));
