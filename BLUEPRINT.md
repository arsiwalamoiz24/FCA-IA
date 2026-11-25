# Technical Architecture & Implementation Blueprint

## Project: JobShop Quote Engine
**Document Version:** 2.0.0  
**Architecture:** Multi-Page Static Web Application (HTML5 / CSS3 / Modular JavaScript)  
**CAD Processing Library:** Three.js `r128` (`STLLoader`, `OrbitControls`)  
**State Persistence:** Browser `localStorage` Synchronized Pipeline (`js/state.js`)

---

## 1. Architectural Overview

The application is structured as four focused HTML pages backed by four independent, pure-JavaScript computational modules that run identically in browser contexts and Node.js automated test suites:

1. **`js/geometry-engine.js`** — Parses `.STL` binary/ASCII buffers via `THREE.STLLoader` (and pure buffer inspection in headless tests), computes exact signed tetrahedra volume, surface area, bounding dimensions, 3D print material/runtime estimates, and CNC billet/chip-removal runtime estimates.
2. **`js/cost-engine.js`** — Compiles structured Job Cards and hierarchical Cost Sheets (`Prime Cost` $\to$ `Works Cost` $\to$ `Cost of Production` $\to$ `Cost of Sales` $\to$ `Quotation Price`) with support for Machine Hour Rate absorption, scrap deductions, and Cost Markup vs. Sales Margin conversions.
3. **`js/batch-engine.js`** — Implements the Economic Batch Quantity ($\text{EBQ}$) optimizer, sensitivity schedule generator, SVG cost-curve builder, and Make-or-Buy relevant cost comparator.
4. **`js/ledger-engine.js`** — Maintains double-entry accounting state, enforces $\sum \text{Debits} \equiv \sum \text{Credits}$ on every journal entry, closes two-sided T-Ledger accounts (`c/d`), and generates a live Trial Balance.
5. **`js/state.js` & `js/nav.js`** — Persists workflow inputs and posted accounting entries across `index.html`, `costing.html`, `batch.html`, and `ledger.html` using `localStorage`, providing seamless multi-page transitions.

---

## 2. Directory Structure

```text
FCA IA-2 Jobshop/
├── README.md
├── PRD.md
├── BLUEPRINT.md
├── .gitignore
├── index.html                      # Stage 1: CAD Upload / 3D Viewer & Process Estimator
├── costing.html                    # Stage 2: Job Card & Hierarchical Job Cost Sheet
├── batch.html                      # Stage 3: Batch Costing (EBQ) & Make-or-Buy Analysis
├── ledger.html                     # Stage 4: Commercial Quotation & Double-Entry Ledger
├── assets/
│   ├── css/
│   │   └── styles.css              # Warm Paper & Ink Accounting Desk stylesheet + @media print
│   └── vendor/
│       ├── three.min.js            # Vendored Three.js r128
│       ├── STLLoader.js            # Three.js STLLoader
│       └── OrbitControls.js        # Three.js OrbitControls
├── js/
│   ├── state.js                    # Shared state model, defaults & textbook presets
│   ├── sample-models-data.js       # Offline base64 fallback for bundled sample STLs
│   ├── geometry-engine.js          # STL mesh divergence & additive/CNC physics
│   ├── cost-engine.js              # Job Card & Job Cost Sheet engine
│   ├── batch-engine.js             # EBQ optimizer, SVG curve generator & Make-or-Buy
│   ├── ledger-engine.js            # Journal, T-Accounts & Trial Balance engine
│   ├── nav.js                      # Top navigation bar & active job summary banner
│   └── pages/
│       ├── page-input.js           # Page 1 interactions & Three.js scene
│       ├── page-costing.js         # Page 2 interactions
│       ├── page-batch.js           # Page 3 interactions
│       └── page-ledger.js          # Page 4 interactions
├── sample_models/
│   ├── calibration_cube.stl        # 20x20x20 mm cube (8.00 cm³)
│   ├── mechanical_bracket.stl      # L-bracket with gusset (48.12 cm³)
│   └── cnc_flange_housing.stl      # Stepped cylindrical flange (28.57 cm³)
├── docs/
│   └── FCA_IA2_Proposal.docx
└── tests/
    └── run_tests.mjs               # Deterministic verification suite
```

---

## 3. Core Module Contracts

### 3.1 `geometry-engine.js`
* `parseStlBufferToMetrics(arrayBuffer, threeLoaderInstance?)` $\to$ `{ volumeCm3, surfaceAreaCm2, bboxMm: {x, y, z}, bboxVolumeCm3, facetCount, vertices }`
  * When `THREE.STLLoader` is provided (browser runtime), parses triangles directly from the generated `THREE.BufferGeometry`.
  * Includes pure `DataView` / ASCII fallback for Node testing consistency.
* `estimateProcessParameters(metrics, options)` $\to$ `{ mode, netVolumeCm3, effectiveVolumeCm3, stockVolumeCm3, netMassG, wasteMassG, grossMassG, scrapCreditInr, materialCostInr, setupHours, runHours, totalMachineHours, workingBreakdown }`

### 3.2 `cost-engine.js`
* `calculateJobCostSheet(params)` $\to$ `{ quantity, unitPrice, directMaterialGross, scrapCredit, directMaterialNet, directLabour, directExpenses, primeCost, factoryOverheads, worksCost, adminOverheads, costOfProduction, sellingOverheads, costOfSales, profitAmount, quotationPrice, perUnit: {...}, workingLines: [...] }`
* Ensures explicit distinction between:
  * **Markup on Cost:** `profit = costOfSales * (rate / 100)`
  * **Margin on Sales:** `profit = costOfSales * (rate / (100 - rate))`

### 3.3 `batch-engine.js`
* `calculateEBQ(demand, setupCost, holdingCost)` $\to$ `{ ebq, runsPerYear, cycleDays, annualSetupCost, annualHoldingCost, totalInventoryCost, sensitivityRows: [...] }`
* `buildEBQChartSVG(ebqResult)` $\to$ responsive vector `<svg>` markup plotting Setup Cost, Holding Cost, and Total Cost curves with clear intersection pin at `EBQ`.
* `evaluateMakeOrBuy(params)` $\to$ `{ batchQty, makeVariablePerUnit, makeAvoidableSetup, opportunityCost, sunkFixedExcluded, totalMakeCost, makePerUnitEffective, vendorUnitPrice, vendorLogistics, totalBuyCost, buyPerUnitEffective, decision: 'MAKE' | 'BUY' | 'INDIFFERENT', savingsInr, indifferenceQty }`

### 3.4 `ledger-engine.js`
* `createEmptyLedger()` $\to$ initialized ledger state (`entries`, `accounts`).
* `postCreditSale(ledger, { date, quoteId, jobId, customerName, revenueAmount, gstAmount })`
* `postPaymentReceipt(ledger, { date, customerName, amount, reference })`
* `computeTAccounts(ledger)` $\to$ debit rows, credit rows, gross sums, `c/d` balancing line, and net balance direction (`Dr.` / `Cr.`) for `Sundry Debtors`, `Sales Revenue`, `Bank / Cash`, and `Output GST`.
* `computeTrialBalance(tAccounts)` $\to$ `{ rows, totalDebit, totalCredit, isBalanced }`

---

## 4. Verification Benchmarks (`tests/run_tests.mjs`)

| Test Case | Benchmark Source | Expected Verified Assertion |
| :--- | :--- | :--- |
| **Calibration Cube Volume** | Analytical $20\text{ mm}$ cube | `volumeCm3 === 8.00`, `surfaceAreaCm2 === 24.00`, `facetCount === 12` |
| **Mechanical Bracket Volume** | Extruded L-profile geometry | `volumeCm3 === 48.12`, `facetCount === 24` |
| **Apex Printers Job Sheet** | Module 4 Exercise | Prime `9000`, Works `10500`, Cost of Sales `11550`, Quote `13860.00` |
| **20% Sales Margin Mode** | Cost Sheet Margin Formula | `costOfSales = 10000` $\implies$ `profit = 2500`, `quote = 12500` |
| **EBQ Optimization** | Module 4 Model ($D=10\text{k}, S=400, H=2$) | `ebq === 2000`, `setupCost === 2000`, `holdingCost === 2000`, `total === 4000` |
| **Make-or-Buy Decision** | Differential Cost Model | Accurately ignores sunk fixed OH, counts opportunity cost, computes indifference qty |
| **Ledger Equilibrium** | Module 1 Double-Entry Rules | `totalDebit === totalCredit` after sale & partial payment; Debtors balance updates cleanly |
