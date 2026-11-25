# Product Requirements Document (PRD)

## Project Title: JobShop Quote Engine (3D Printing & CNC Machining)
**Document Version:** 2.0.0  
**Target Architecture:** Multi-Page Client-Side Web Application (HTML5, CSS3, Modular JavaScript, Three.js)  
**Domain:** Engineering Cost Estimation, Specific Order Costing & Double-Entry Financial Accounting  
**Accounting Modules Covered:** Module 1 (Accounting Process & Credit Sales), Module 3 (Cost Sheet & Overheads), Module 4 (Job Costing, Batch Costing / EBQ & Make-or-Buy)

---

## 1. Executive Summary
The **JobShop Quote Engine** is a multi-page web application tailored for custom fabrication workshops operating additive (3D printing) and subtractive (CNC machining) equipment. It eliminates manual handoffs between CAD geometry slicing, job cost estimation, batch scheduling, and financial bookkeeping.

The platform connects four clean, focused views via persistent browser state (`localStorage`):
1. **Page 1 — CAD Upload & Job Parameters (`index.html`):** Parses binary and ASCII `.STL` files using Three.js `STLLoader`, displays an interactive neutral 3D viewport, derives volume, mass, and machine time (for both 3D Printing and CNC Machining), and also provides a Manual Textbook Input Mode.
2. **Page 2 — Job Card & Job Cost Sheet (`costing.html`):** Generates formal Job Cards (`MRN` and Time Ticket tracking) and hierarchical multi-tier Cost Sheets (Prime Cost $\to$ Works Cost $\to$ Cost of Production $\to$ Cost of Sales $\to$ Profit Markup/Margin $\to$ Quotation Price) with expandable calculation steps.
3. **Page 3 — Batch Costing (EBQ) & Make-or-Buy (`batch.html`):** Computes Economic Batch Quantity ($\text{EBQ}$) for repeat customer orders alongside sensitivity matrices, cost curve visualizations, and a Make-or-Buy decision comparator incorporating relevant costs and opportunity costs.
4. **Page 4 — Quotation & Financial Accounting Ledger (`ledger.html`):** Produces a printable commercial quotation, dispatches formal double-entry journal entries upon customer acceptance (`Sundry Debtors Dr. / Sales Cr.`) and payment settlement (`Bank Dr. / Sundry Debtors Cr.`), updates T-Ledger accounts, and balances the Trial Balance.

---

## 2. Functional Requirements

### 2.1 Page 1: Geometry Ingestion & Process Derivation (`index.html`)
* **FR-1.1 STL File Parsing:** Accept binary and ASCII `.STL` uploads via drag-and-drop, file browser, or one-click bundled sample parts (`calibration_cube.stl`, `mechanical_bracket.stl`, `cnc_flange_housing.stl`) using `THREE.STLLoader`.
* **FR-1.2 Geometric Metrics:** Compute and display:
  * Exact solid volume ($\text{cm}^3$) via signed tetrahedra divergence summation:
    $$V = \frac{1}{6} \left| \sum_{i=1}^{N} \vec{v}_{1,i} \cdot (\vec{v}_{2,i} \times \vec{v}_{3,i}) \right|$$
  * Bounding box dimensions ($X, Y, Z\text{ in mm}$), surface area ($\text{cm}^2$), and triangle count.
* **FR-1.3 Dual Process Estimation:**
  * **3D Printing Mode:** Material library (PLA, PETG, ABS, Tough Resin, Nylon PA12), infill percentage, support/skirt waste percentage, print layer preset / deposition rate ($\text{cm}^3/\text{hr}$), and setup time.
  * **CNC Machining Mode:** Material library (Aluminum 6061, Mild Steel EN8, Brass C360, Delrin), raw stock billet allowance ($\text{mm}$ per axis), removed chip volume ($\text{cm}^3$), material removal rate ($\text{cm}^3/\text{hr}$), and recoverable chip scrap credit.
* **FR-1.4 Manual Override & Textbook Presets:** Toggle cleanly to direct numeric input mode or load verified textbook presets (Apex Printers, Industrial Valve / Vibrant Threads, CNC Bracket MHR) without requiring an STL file.

### 2.2 Page 2: Job Card & Job Cost Sheet (`costing.html`)
* **FR-2.1 Job Card Record:** Generate a structured Job Order card tracking Job ID, Customer Name, Order Quantity, Material Requisition Note (`MRN`), Time Ticket (`TT`), Machine Center ID, and Batch/Quote target dates.
* **FR-2.2 Standard Cost Sheet Hierarchy:**
  * $\text{Direct Material Cost}$ (adjusted cleanly for any direct scrap realization credit)
  * $+ \text{Direct Labour Cost}$ (`Hours × Rate/hr`)
  * $+ \text{Direct Expenses}$ (dedicated CAD prep, fixtures, special tooling)
  * $= \mathbf{Prime\ Cost}$
  * $+ \text{Factory Overheads}$ (selectable basis: Machine Hour Rate $\text{Hours} \times \text{MHR}$, `% of Direct Labour`, or Fixed Amount ₹)
  * $= \mathbf{Works / Factory\ Cost}$
  * $+ \text{Administration Overheads}$ (`% of Works Cost` or Fixed ₹)
  * $= \mathbf{Cost\ of\ Production}$
  * $+ \text{Selling \& Distribution Overheads}$ (`% of Cost of Production`, `% of Works Cost`, or Fixed ₹)
  * $= \mathbf{Cost\ of\ Sales\ (Total\ Cost)}$
* **FR-2.3 Dual Profit Computation:**
  * **Markup on Cost:** $\text{Profit} = \text{Cost of Sales} \times \frac{r}{100}$
  * **Margin on Selling Price:** $\text{Profit} = \text{Cost of Sales} \times \frac{r}{100 - r}$
  * Show exact intermediate formula substitutions alongside both total batch values and per-unit costs.
* **FR-2.4 Print Export:** Dedicated print button formatting the Job Card and Cost Sheet cleanly for A4 PDF export.

### 2.3 Page 3: Batch Costing (EBQ) & Make-or-Buy (`batch.html`)
* **FR-3.1 Economic Batch Quantity Calculator:**
  $$\text{EBQ} = \sqrt{\frac{2 \times D \times S}{H}}$$
  Compute optimal batch size, number of production runs per year ($D / \text{EBQ}$), interval between setups ($365 / \text{Runs}$), annual setup cost, annual carrying cost, and minimum combined cost.
* **FR-3.2 Equilibrium Sensitivity Proof:** Generate a tabular sensitivity schedule across batch multiples (`25%` to `200%` of EBQ) plus an inline vector SVG curve plot proving total annual cost reaches its minimum where $\text{Annual Setup Cost} = \text{Annual Holding Cost}$.
* **FR-3.3 Make-or-Buy Decision Comparator:**
  * Compare **In-House Relevant Cost** (`Variable Material + Direct Labour + Variable Machine OH + Avoidable Setup + Opportunity Cost`) vs. **Outsourced Vendor Cost** (`Vendor Unit Quote × Qty + Logistics/Inspection Fees`).
  * Explicitly exclude irrelevant sunk/allocated fixed costs, highlight net savings (₹), break-even indifference quantity, and decision rationale.

### 2.4 Page 4: Quotation & Accounting Ledger (`ledger.html`)
* **FR-4.1 Formal Quotation Generator:** Itemized commercial quotation displaying workshop identity, customer details, job summary, cost/tax totals (with optional GST toggle), and validity period.
* **FR-4.2 Event-Driven Journal Dispatch:**
  * Clicking **`Accept Quotation & Post Sale`** appends a balanced Journal Entry:
    * `Sundry Debtors ([Customer]) A/c Dr.` $\to$ Gross Invoice Amount
    * `To Sales Revenue A/c Cr.` $\to$ Net Revenue *(and `To Output GST A/c Cr.` if tax enabled)*
  * Clicking **`Record Payment Receipt`** posts partial or full collection:
    * `Bank / Cash A/c Dr.`
    * `To Sundry Debtors ([Customer]) A/c Cr.`
* **FR-4.3 T-Accounts & Trial Balance:** Render standard two-sided accounting T-Ledgers with closing balances (`To/By Balance c/d`) and a live Trial Balance asserting $\sum \text{Dr.} = \sum \text{Cr.}$.

---

## 3. Non-Functional & Aesthetic Requirements
1. **Human Paper-and-Ink Aesthetic:** Warm archival off-white surfaces (`#FAF9F6` / `#FFFFFF`), crisp `1px` borders, ink charcoal typography, muted navy (`#1E3A5F`) and forest green (`#23533A`) accents, tabular monospaced figures, and traditional double underlines on accounting totals.
2. **Zero External Runtime Dependencies:** All scripts and vendor assets (`three.min.js`, `STLLoader.js`, `OrbitControls.js`) bundled cleanly inside `assets/vendor/` with zero build step required.
3. **Numerical Determinism:** Currency rounded cleanly to 2 decimal places (`₹`) and balanced to the nearest paisa across journal postings and trial balances.
4. **Transparent Auditability:** Every page displays intermediate steps and algebraic formulas alongside results so every calculation can be audited manually.
