# JobShop Quote Engine

> **Deterministic Cost Engineering, Batch Optimization & Double-Entry Accounting Web Application for Custom Manufacturing.**

---

## Overview

The **JobShop Quote Engine** is a multi-page web application engineered for custom additive (3D printing) and subtractive (CNC machining) fabrication workshops. It unifies CAD geometry estimation, institutional cost sheet preparation, Economic Batch Quantity (EBQ) analysis, Make-or-Buy evaluation, and double-entry financial accounting into a structured four-stage workflow.

Designed as a zero-dependency client-side application using **HTML5, CSS3, and modular JavaScript** (powered by Three.js `STLLoader`), the platform runs directly in any modern browser, locally or via static hosting (GitHub Pages).

---

## Key Capabilities

### 1. CAD Geometry Parsing & Process Estimator (`index.html`)
* **Binary & ASCII `.STL` Ingestion:** Drag-and-drop file upload and bundled calibration/machining sample models parsed via `THREE.STLLoader`.
* **Volumetric Surface Integration:** Computes exact solid volume ($\text{cm}^3$), surface area ($\text{cm}^2$), bounding dimensions ($X \times Y \times Z\text{ mm}$), and triangle facet count via signed tetrahedra summation (Divergence Theorem).
* **Dual Process Modes:**
  * **Additive (3D Printing):** Computes net filament/resin mass, infill-adjusted print volume, support waste allowance, and deposition runtime across materials (PLA, PETG, ABS, Resin, Nylon PA12).
  * **Subtractive (CNC Machining):** Computes raw billet stock volume with machining allowances, chip removal volume, scrap recovery credit, and spindle milling runtime across metals and engineering plastics (Aluminum 6061, Mild Steel EN8, Brass C360, Delrin).
* **Manual Textbook Override:** Direct entry of cost parameters and one-click loading of standard classroom/textbook reference cases.

### 2. Job Card & Hierarchical Job Cost Sheet (`costing.html`)
* **Formal Job Card:** Assigns Job Order ID, Customer Name, Material Requisition Note (`MRN`), Labour Time Ticket (`TT`), and machine allocation records.
* **Multi-Stage Cost Hierarchy:** Calculates step-by-step totals and cost per unit with inline formula workings:
  * **Prime Cost** = Direct Materials + Direct Labour + Direct Expenses
  * **Works / Factory Cost** = Prime Cost + Factory Overheads (via Machine Hour Rate, % of Direct Labour, or Fixed ₹) $-$ Scrap Realized
  * **Cost of Production** = Works Cost + Administration Overheads
  * **Cost of Sales** = Cost of Production + Selling & Distribution Overheads
* **Dual-Mode Profit Engine:** Supports both **Markup on Cost (%)** and **Margin on Selling Price (%)** with full derivation formulas.
* **Print / PDF Export:** Print-formatted Job Card and Cost Sheet output.

### 3. Batch Costing (EBQ) & Make-or-Buy Decision Engine (`batch.html`)
* **Economic Batch Quantity (EBQ) Optimizer:**
  $$\text{EBQ} = \sqrt{\frac{2 \times D \times S}{H}}$$
  Computes optimal batch size, annual setup frequency, cycle interval (days), and proves cost minimization where $\text{Annual Setup Cost} = \text{Annual Holding Cost}$.
* **Sensitivity Table & Vector Cost Curves:** Clean SVG chart comparing descending setup costs, ascending holding costs, and total inventory cost across batch multiples.
* **Make-or-Buy Decision Comparator:** Evaluates internal relevant variable production cost + avoidable setup + opportunity cost against external vendor quotes, identifying break-even indifference quantity while excluding sunk fixed overheads.

### 4. Commercial Quotation & Double-Entry Ledger (`ledger.html`)
* **Formal Commercial Quotation:** Generates an itemized, print-ready customer quote with Job reference, validity period, optional GST split, and billing totals.
* **Event-Driven Bookkeeping:**
  * **Order Acceptance (`Accept Quotation`):** Posts `Sundry Debtors A/c Dr. / To Sales Revenue A/c Cr.` (plus Output GST if enabled).
  * **Cash/Bank Settlement (`Record Payment`):** Posts `Bank / Cash A/c Dr. / To Sundry Debtors A/c Cr.`.
* **Synchronized Financial Statements:**
  * Chronological **Journal Register**
  * Dual-column **T-Ledger Accounts** (`Sundry Debtors`, `Sales Revenue`, `Bank / Cash`, `Output GST`) with balanced closing `c/d` figures
  * Live **Trial Balance** confirming $\sum \text{Debits} = \sum \text{Credits}$.

---

## System Architecture

```
FCA IA-2 Jobshop/
├── README.md                       # Project documentation and verification reference
├── PRD.md                          # Product Requirements Document
├── BLUEPRINT.md                    # Technical architecture and module specifications
├── index.html                      # Page 1: CAD Upload, 3D Viewer & Process Inputs
├── costing.html                    # Page 2: Job Card & Hierarchical Job Cost Sheet
├── batch.html                      # Page 3: EBQ Optimizer & Make-or-Buy Analysis
├── ledger.html                     # Page 4: Quotation & Double-Entry Financial Ledger
├── assets/
│   ├── css/
│   │   └── styles.css              # Shared paper-and-ink design system & @media print rules
│   └── vendor/
│       ├── three.min.js            # Three.js r128 runtime
│       ├── STLLoader.js            # Three.js STL mesh parser
│       └── OrbitControls.js        # Interactive 3D orbit/zoom camera controls
├── js/
│   ├── state.js                    # Persistent localStorage store & textbook presets
│   ├── sample-models-data.js       # Offline STL fixtures for direct file:// usage
│   ├── geometry-engine.js          # Signed volume, area, 3D Print & CNC estimation
│   ├── cost-engine.js              # Hierarchical cost sheet & profit calculations
│   ├── batch-engine.js             # EBQ optimizer, sensitivity matrix, SVG plot & Make-or-Buy
│   ├── ledger-engine.js            # Journal dispatcher, T-account balancer & Trial Balance
│   ├── nav.js                      # Persistent header & multi-page workflow navigation
│   └── pages/
│       ├── page-input.js           # Page 1 UI controller & Three.js viewport
│       ├── page-costing.js         # Page 2 UI controller
│       ├── page-batch.js           # Page 3 UI controller
│       └── page-ledger.js          # Page 4 UI controller
├── sample_models/
│   ├── calibration_cube.stl        # 20x20x20 mm benchmark cube (8.00 cm³)
│   ├── mechanical_bracket.stl      # Stepped L-bracket with gusset (48.12 cm³)
│   └── cnc_flange_housing.stl      # Stepped flanged bore housing (28.57 cm³)
├── docs/
│   └── FCA_IA2_Proposal.docx       # Reference project specification
└── tests/
    └── run_tests.mjs               # Automated Node test suite for all calculation engines
```

---

## Setup & Usage

### Quick Launch (Static Server — Recommended)
```bash
git clone <repository_url>
cd "FCA IA-2 Jobshop"
python3 -m http.server 8080
```
Open `http://localhost:8080` in any modern web browser.

*(The application bundles all Three.js dependencies and sample STL fallbacks locally, so opening `index.html` directly from the filesystem or hosting on GitHub Pages also works offline without any build step.)*

### Run Automated Verification Tests
Requires Node.js 18+:
```bash
node tests/run_tests.mjs
```

---

## Verified Reference Benchmarks

### Benchmark 1: Custom Job Order (Apex Printers Reference)
* **Direct Inputs:** Materials ₹5,000 | Labour 200 hrs @ ₹15/hr (₹3,000) | Direct Expenses ₹1,000.
* **Overheads:** Factory Overhead 50% of Direct Labour (₹1,500) | Admin & Selling 10% of Works Cost (₹1,050).
* **Profit:** 20% Markup on Cost (₹2,310).
* **Result:** Prime Cost = **₹9,000.00** | Works Cost = **₹10,500.00** | Cost of Sales = **₹11,550.00** | Quotation Price = **₹13,860.00**.

### Benchmark 2: Economic Batch Quantity (EBQ Model)
* **Inputs:** Annual Demand ($D$) = 10,000 units | Setup Cost ($S$) = ₹400/batch | Holding Cost ($H$) = ₹2.00/unit/year.
* **Result:** $\text{EBQ} = \mathbf{2,000\text{ units}}$ | Batches/Year = 5 | Annual Setup Cost = **₹2,000.00** | Annual Holding Cost = **₹2,000.00** | Minimum Total Inventory Cost = **₹4,000.00**.

### Benchmark 3: Make-or-Buy Decision Analysis
* **Scenario:** Batch of 500 brackets; internal relevant variable cost ₹180/unit + avoidable batch setup ₹10,000 + ₹0 opportunity cost (spare capacity available) vs. external vendor quote ₹220/unit.
* **Result:** Make Total Relevant Cost = **₹1,00,000** vs. Buy Total Cost = **₹1,10,000** $\implies$ Recommendation: **Make In-House** (Net Savings = **₹10,000**; Indifference point = **250 units**).
