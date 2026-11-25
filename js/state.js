/**
 * state.js
 * Persistent cross-page application state backed by localStorage,
 * verified textbook benchmark presets, and clean Indian currency formatters.
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'jobshop_quote_engine_state_v2';

  function defaultState() {
    return {
      workshop: {
        name: 'Precision Fab Workshop',
        tagline: 'Additive Prototyping & CNC Machining Services',
        gstin: '27AABCP4920K1Z5'
      },
      jobMeta: {
        jobId: 'JOB-2026-0104',
        quoteId: 'QTN-2026-0104',
        customerName: 'Aegis Robotics Pvt. Ltd.',
        partName: 'mechanical_bracket.stl',
        mrnNo: 'MRN-042',
        timeTicketNo: 'TT-118',
        machineCenter: 'VMC-03 / FDM-01',
        issueDate: '2026-11-26',
        validityDays: 15,
        gstRatePct: 0,
        acceptedQuoteIds: []
      },
      cadInput: {
        inputMode: 'stl', // 'stl' | 'manual'
        selectedSample: 'mechanical_bracket.stl',
        processMode: 'printing', // 'printing' | 'cnc'
        quantity: 50,
        // 3D print parameters
        printMaterial: 'pla',
        density: 1.24,
        ratePerKg: 1800,
        infillPct: 35,
        supportWastePct: 10,
        depositionRateCm3Hr: 14,
        setupHours: 0.5,
        // CNC parameters
        cncMaterial: 'alu6061',
        cncDensity: 2.70,
        cncRatePerKg: 480,
        cncScrapRatePerKg: 160,
        stockAllowanceMm: 5,
        mrrCm3Hr: 40,
        cncSetupHours: 1.0,
        // Last parsed metrics
        metrics: {
          facetCount: 24,
          bboxMm: { x: 60, y: 45, z: 45 },
          volumeCm3: 48.12,
          surfaceAreaCm2: 120.54,
          bboxVolumeCm3: 121.5
        }
      },
      costInputs: {
        quantity: 50,
        directMaterial: 3440.00,
        scrapCredit: 0,
        labourHours: 6.0,
        labourRate: 250.00,
        directExpenses: 450.00,
        factoryOhMode: 'mhr', // 'mhr' | 'pct_dl' | 'fixed'
        machineHours: 98.6,
        machineHourRate: 120.00,
        factoryOhPct: 50,
        factoryOhFixed: 0,
        adminOhMode: 'pct_works',
        adminOhPct: 10,
        adminOhFixed: 0,
        sellingOhMode: 'pct_cop',
        sellingOhPct: 5,
        sellingOhFixed: 0,
        profitMode: 'markup_cost', // 'markup_cost' | 'margin_sales'
        profitPct: 20,
        sourceLabel: 'CAD Derived (mechanical_bracket.stl)'
      },
      ebqInputs: {
        annualDemand: 10000,
        setupCost: 400,
        holdingCost: 2
      },
      makeOrBuyInputs: {
        batchQty: 500,
        makeVariablePerUnit: 180,
        makeAvoidableSetup: 10000,
        opportunityCost: 0,
        sunkFixedExcluded: 25000,
        vendorUnitPrice: 220,
        vendorLogistics: 0
      },
      ledger: {
        nextEntrySeq: 1,
        entries: []
      }
    };
  }

  function loadState() {
    var base = defaultState();
    try {
      var raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      var parsed = JSON.parse(raw);
      return {
        workshop: Object.assign({}, base.workshop, parsed.workshop || {}),
        jobMeta: Object.assign({}, base.jobMeta, parsed.jobMeta || {}),
        cadInput: Object.assign({}, base.cadInput, parsed.cadInput || {}),
        costInputs: Object.assign({}, base.costInputs, parsed.costInputs || {}),
        ebqInputs: Object.assign({}, base.ebqInputs, parsed.ebqInputs || {}),
        makeOrBuyInputs: Object.assign({}, base.makeOrBuyInputs, parsed.makeOrBuyInputs || {}),
        ledger: parsed.ledger && Array.isArray(parsed.ledger.entries) ? parsed.ledger : base.ledger
      };
    } catch (e) {
      return base;
    }
  }

  function saveState(state) {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage quota errors cleanly
    }
    return state;
  }

  function resetAllState() {
    var fresh = defaultState();
    saveState(fresh);
    return fresh;
  }

  /**
   * Standard verified textbook presets for quick academic verification.
   */
  function applyPreset(state, presetKey) {
    if (presetKey === 'apex_printers') {
      state.jobMeta.jobId = 'JOB-APX-1000';
      state.jobMeta.quoteId = 'QTN-APX-1000';
      state.jobMeta.customerName = 'Corporate Event Client';
      state.jobMeta.partName = '1,000 Custom Event Brochures (Apex Printers Benchmark)';
      state.jobMeta.mrnNo = 'MRN-APX-01';
      state.jobMeta.timeTicketNo = 'TT-APX-01';
      state.jobMeta.machineCenter = 'Offset Press A-1';
      state.cadInput.inputMode = 'manual';
      state.costInputs = {
        quantity: 1000,
        directMaterial: 5000,
        scrapCredit: 0,
        labourHours: 200,
        labourRate: 15,
        directExpenses: 1000,
        factoryOhMode: 'pct_dl',
        machineHours: 0,
        machineHourRate: 0,
        factoryOhPct: 50,
        factoryOhFixed: 0,
        adminOhMode: 'pct_works',
        adminOhPct: 10,
        adminOhFixed: 0,
        sellingOhMode: 'fixed',
        sellingOhPct: 0,
        sellingOhFixed: 0,
        profitMode: 'markup_cost',
        profitPct: 20,
        sourceLabel: 'Textbook Benchmark: Apex Printers (Module 4)'
      };
    } else if (presetKey === 'vibrant_threads') {
      state.jobMeta.jobId = 'JOB-VTL-10K';
      state.jobMeta.quoteId = 'QTN-VTL-10K';
      state.jobMeta.customerName = 'National Apparel Retailers';
      state.jobMeta.partName = '10,000 Cotton T-Shirts (20% Sales Margin Benchmark)';
      state.jobMeta.mrnNo = 'MRN-VTL-09';
      state.jobMeta.timeTicketNo = 'TT-VTL-24';
      state.jobMeta.machineCenter = 'Apparel Line-B';
      state.cadInput.inputMode = 'manual';
      state.costInputs = {
        quantity: 10000,
        directMaterial: 8000000,
        scrapCredit: 0,
        labourHours: 10000,
        labourRate: 300,
        directExpenses: 1000000,
        factoryOhMode: 'fixed',
        machineHours: 0,
        machineHourRate: 0,
        factoryOhPct: 0,
        factoryOhFixed: 2000000, // 15L factory rent/power + 5L machine depreciation
        adminOhMode: 'fixed',
        adminOhPct: 0,
        adminOhFixed: 1000000,
        sellingOhMode: 'fixed',
        sellingOhPct: 0,
        sellingOhFixed: 1000000,
        profitMode: 'margin_sales',
        profitPct: 20,
        sourceLabel: 'Textbook Benchmark: Vibrant Threads (20% Sales Margin)'
      };
    } else if (presetKey === 'ebq_benchmark') {
      state.ebqInputs = {
        annualDemand: 10000,
        setupCost: 400,
        holdingCost: 2
      };
    } else if (presetKey === 'make_buy_benchmark') {
      state.makeOrBuyInputs = {
        batchQty: 500,
        makeVariablePerUnit: 180,
        makeAvoidableSetup: 10000,
        opportunityCost: 0,
        sunkFixedExcluded: 25000,
        vendorUnitPrice: 220,
        vendorLogistics: 0
      };
    }
    saveState(state);
    return state;
  }

  function formatINR(num) {
    var val = Number(num) || 0;
    return '₹' + val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  root.JobShopState = {
    load: loadState,
    save: saveState,
    reset: resetAllState,
    applyPreset: applyPreset,
    formatINR: formatINR,
    escapeHTML: escapeHTML
  };
}(typeof window !== 'undefined' ? window : globalThis));
