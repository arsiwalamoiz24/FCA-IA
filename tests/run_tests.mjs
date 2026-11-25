/**
 * tests/run_tests.mjs
 * Automated deterministic verification suite against R. L. Gupta / M. N. Arora / Module benchmarks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const Geometry = require(path.join(baseDir, 'js/geometry-engine.js'));
const Costing = require(path.join(baseDir, 'js/cost-engine.js'));
const Batch = require(path.join(baseDir, 'js/batch-engine.js'));
const Ledger = require(path.join(baseDir, 'js/ledger-engine.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

console.log('Running JobShop Quote Engine Verification Tests...');

test('1. Geometry Engine parses calibration_cube.stl (20x20x20mm -> 8.00 cm³)', () => {
  const buf = fs.readFileSync(path.join(baseDir, 'sample_models/calibration_cube.stl'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const metrics = Geometry.parseStlBufferToMetrics(ab, null);
  assert.equal(metrics.facetCount, 12);
  assert.equal(metrics.volumeCm3, 8);
  assert.equal(metrics.surfaceAreaCm2, 24);
  assert.equal(metrics.bboxMm.x, 20);
  assert.equal(metrics.bboxMm.y, 20);
  assert.equal(metrics.bboxMm.z, 20);
});

test('2. Geometry Engine parses mechanical_bracket.stl (extruded L-bracket -> 48.12 cm³)', () => {
  const buf = fs.readFileSync(path.join(baseDir, 'sample_models/mechanical_bracket.stl'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const metrics = Geometry.parseStlBufferToMetrics(ab, null);
  assert.equal(metrics.facetCount, 24);
  assert.equal(metrics.volumeCm3, 48.12);
});

test('3. Geometry Engine parses cnc_flange_housing.stl & computes CNC billet + chip scrap credit', () => {
  const buf = fs.readFileSync(path.join(baseDir, 'sample_models/cnc_flange_housing.stl'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const metrics = Geometry.parseStlBufferToMetrics(ab, null);
  assert.equal(metrics.facetCount, 576);
  assert.ok(metrics.volumeCm3 > 28.5 && metrics.volumeCm3 < 28.7, `Unexpected flange vol: ${metrics.volumeCm3}`);

  const cncEst = Geometry.estimateProcessParameters(metrics, {
    mode: 'cnc',
    quantity: 10,
    density: 2.70,
    ratePerKg: 480,
    scrapRatePerKg: 160,
    stockAllowanceMm: 5,
    mrrCm3Hr: 40,
    setupHours: 1
  });
  assert.ok(cncEst.stockVolPerUnit > cncEst.partVolCm3);
  assert.ok(cncEst.scrapCreditTotal > 0);
  assert.ok(cncEst.totalMachineHours > 1);
});

test('4. Cost Engine matches Apex Printers Job Cost Sheet benchmark (Quote ₹13,860.00)', () => {
  const res = Costing.calculateJobCostSheet({
    quantity: 1000,
    directMaterial: 5000,
    labourHours: 200,
    labourRate: 15,
    directExpenses: 1000,
    factoryOhMode: 'pct_dl',
    factoryOhPct: 50,
    adminOhMode: 'pct_works',
    adminOhPct: 10,
    sellingOhMode: 'fixed',
    sellingOhFixed: 0,
    profitMode: 'markup_cost',
    profitPct: 20
  });
  assert.equal(res.primeCost, 9000);
  assert.equal(res.factoryOverheads, 1500);
  assert.equal(res.worksCost, 10500);
  assert.equal(res.adminOverheads, 1050);
  assert.equal(res.costOfProduction, 11550);
  assert.equal(res.costOfSales, 11550);
  assert.equal(res.profitAmount, 2310);
  assert.equal(res.quotationPrice, 13860);
  assert.equal(res.perUnit.quotationPrice, 13.86);
});

test('5. Cost Engine handles 20% Margin on Selling Price accurately (Vibrant Threads benchmark)', () => {
  const res = Costing.calculateJobCostSheet({
    quantity: 10000,
    directMaterial: 8000000,
    labourHours: 10000,
    labourRate: 300,
    directExpenses: 1000000,
    factoryOhMode: 'fixed',
    factoryOhFixed: 2000000,
    adminOhMode: 'fixed',
    adminOhFixed: 1000000,
    sellingOhMode: 'fixed',
    sellingOhFixed: 1000000,
    profitMode: 'margin_sales',
    profitPct: 20
  });
  assert.equal(res.primeCost, 12000000);
  assert.equal(res.worksCost, 14000000);
  assert.equal(res.costOfProduction, 15000000);
  assert.equal(res.costOfSales, 16000000);
  assert.equal(res.profitAmount, 4000000);
  assert.equal(res.quotationPrice, 20000000);
  assert.equal(res.effectiveMarginOnSales, 20);
  assert.equal(res.effectiveMarkupOnCost, 25);
});

test('6. Batch Engine computes EBQ = 2,000 units where Setup Cost === Holding Cost = ₹2,000', () => {
  const ebq = Batch.calculateEBQ(10000, 400, 2);
  assert.equal(ebq.valid, true);
  assert.equal(ebq.ebq, 2000);
  assert.equal(ebq.runsPerYear, 5);
  assert.equal(ebq.annualSetupCost, 2000);
  assert.equal(ebq.annualHoldingCost, 2000);
  assert.equal(ebq.totalInventoryCost, 4000);
  assert.equal(ebq.sensitivityRows.length, 7);
});

test('7. Make-or-Buy Engine evaluates relevant cost + opportunity cost & ignores sunk cost', () => {
  const res = Batch.evaluateMakeOrBuy({
    batchQty: 500,
    makeVariablePerUnit: 180,
    makeAvoidableSetup: 10000,
    opportunityCost: 0,
    sunkFixedExcluded: 25000,
    vendorUnitPrice: 220,
    vendorLogistics: 0
  });
  assert.equal(res.totalMakeCost, 100000);
  assert.equal(res.totalBuyCost, 110000);
  assert.equal(res.decision, 'MAKE');
  assert.equal(res.savingsInr, 10000);
  assert.equal(res.indifferenceQty, 250);

  // If scarce machine capacity creates ₹15,000 opportunity cost, Make becomes ₹1,15,000 -> BUY saves ₹5,000
  const constrained = Batch.evaluateMakeOrBuy({
    batchQty: 500,
    makeVariablePerUnit: 180,
    makeAvoidableSetup: 10000,
    opportunityCost: 15000,
    sunkFixedExcluded: 25000,
    vendorUnitPrice: 220,
    vendorLogistics: 0
  });
  assert.equal(constrained.totalMakeCost, 115000);
  assert.equal(constrained.decision, 'BUY');
  assert.equal(constrained.savingsInr, 5000);
});

test('8. Ledger Engine posts balanced credit sale & payment receipt preserving Trial Balance equilibrium', () => {
  let ledger = Ledger.createEmptyLedger();
  ledger = Ledger.postCreditSale(ledger, {
    date: '2026-11-26',
    quoteId: 'QTN-APX-1000',
    jobId: 'JOB-APX-1000',
    customerName: 'Corporate Event Client',
    taxableAmount: 13860,
    gstRatePct: 0
  });
  ledger = Ledger.postPaymentReceipt(ledger, {
    date: '2026-11-26',
    customerName: 'Corporate Event Client',
    amount: 5000,
    paymentMode: 'NEFT',
    reference: 'NEFT-901'
  });

  const tAccounts = Ledger.computeTAccounts(ledger);
  const tb = Ledger.computeTrialBalance(tAccounts);

  assert.equal(tAccounts['Sundry Debtors'].closingBalance, 8860);
  assert.equal(tAccounts['Sundry Debtors'].closingSide, 'Dr');
  assert.equal(tAccounts['Bank / Cash'].closingBalance, 5000);
  assert.equal(tAccounts['Bank / Cash'].closingSide, 'Dr');
  assert.equal(tAccounts['Sales Revenue'].closingBalance, 13860);
  assert.equal(tAccounts['Sales Revenue'].closingSide, 'Cr');
  assert.equal(tb.totalDebit, 13860);
  assert.equal(tb.totalCredit, 13860);
  assert.equal(tb.isBalanced, true);
});

console.log(`\nAll ${passed} automated verification tests passed.`);
