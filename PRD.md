# Product Requirements Document (PRD)

## Project Title: JobShop Quote Engine (Additive & Subtractive Manufacturing)
**Document Version:** 1.0.0  
**Target Architecture:** Python / Streamlit / Modern Web Application  
**Domain:** Computational Cost Accounting & Enterprise Manufacturing Execution  
**Integration Scope:** Specific Order Costing (Job & Batch Costing), Cost Hierarchy & Absorption, Financial Accounting Integration  

---

## 1. Executive Summary
The **JobShop Quote Engine** is an integrated manufacturing cost-estimation, pricing, and accounting platform designed for on-demand custom fabrication facilities (3D printing, CNC machining, and rapid prototyping). 

Traditional manufacturing workshops struggle with disjointed workflows between engineering estimation and financial accounting: geometry parsing occurs in CAD/CAM slicers, quoting occurs in disparate spreadsheets, and accounting records are updated manually days or weeks after order confirmation. 

The JobShop Quote Engine bridges this chasm by delivering an automated, deterministic pipeline:
1. **Geometry Ingestion & Parameter Derivation:** Ingests Stereolithography (`.STL`) 3D CAD meshes to compute exact bounding volumes, surface areas, material weight, and machine processing runtimes (with a parallel Manual Parameter Input mode for textbook auditing and standard quote calculation).
2. **Deterministic Cost Sheet & Batch Sizing Engine:** Hierarchically accumulates Prime Cost, Factory / Works Cost, Cost of Production, and Cost of Sales, applies custom profit margins/markups, and calculates the Economic Batch Quantity ($\text{EBQ}$) for repeat orders.
3. **Event-Driven Financial Ledger Integration:** Automatically generates formal commercial quotations and, upon client acceptance, dispatches real-time double-entry journal entries (`Debtor A/c Dr.` to `Sales Revenue A/c Cr.`), immediately posting to general ledgers and updating trial balance figures.

---

## 2. Problem Statement & Domain Context
In custom job-order manufacturing, each customer request exhibits unique geometric specifications, material requirements, and machine utilization rates. Key operational failure modes include:
* **Cost Undershooting:** Failing to absorb indirect production overheads (machine depreciation, power consumption, slicing software licensing) into individual job cards.
* **Pricing Inconsistencies:** Conflating **Profit Markup on Cost** with **Profit Margin on Sales**, resulting in margin erosion.
* **Batch Inefficiencies:** Producing custom parts in ad-hoc batch sizes without optimizing against the mathematical tradeoff between fixed setup costs and inventory carrying charges.
* **Accounting Decoupling:** Quoting without synchronized ledger integration, causing revenue recognition delays and inventory distortion.

---

## 3. Regulatory & Accounting Framework (FCA Syllabus Alignment)
The engine strictly complies with standardized Cost and Management Accounting (CMA) principles and Indian Accounting Standards (Ind AS / Double-Entry Bookkeeping):

| Operational Domain | Relevant Accounting Module | Governed Principles & Formulations |
| :--- | :--- | :--- |
| **Job Costing** | Specific Order Costing | Job Card generation, direct allocation of materials and specialized tooling, absorption of factory overheads via Machine Hour Rate ($\text{MHR}$). |
| **Cost Classification** | Fundamentals of Cost Accounting | Segregation of expenses into Prime Cost, Works Cost, Cost of Production, and Cost of Sales. |
| **Batch Optimization** | Batch Costing Techniques | Minimization of total batch setup vs. holding expenditures via the Economic Batch Quantity ($\text{EBQ}$) model. |
| **Financial Recognition** | Double-Entry Bookkeeping | Application of the Golden Rules of Accounting upon commercial contract execution (Real / Personal / Nominal account state updates). |

---

## 4. User Personas & Workflows

### 4.1 Target Personas
1. **Manufacturing Estimator / Engineer:** Requires instant geometric parsing of uploaded CAD models, material usage quantification, and runtime estimations.
2. **Cost Controller / Financial Officer:** Demands strict verification of overhead absorption rates, multi-tier cost sheet breakdowns, and batch-size economies.
3. **Auditor / Academic Reviewer:** Requires transparent step-by-step mathematical audits and manual input overrides to benchmark against established reference problems (e.g., standard industrial textbooks).

### 4.2 System Flow Diagram
```mermaid
flowchart TD
    A[CAD Input: STL Mesh File] --> B[Mesh Parsing Engine: TriMesh / NumPy-STL]
    A_alt[Manual Input Override: Standard Parameters] --> B_alt[Parameter Normalization]
    
    B --> C[Operational Cost Drivers]
    B_alt --> C
    
    C -->|Volume, Weight, Machine Hours| D[Cost Sheet Hierarchy Engine]
    
    subgraph Cost_Sheet_Compilation [Cost Sheet Hierarchy Engine]
        D1[Direct Material + Direct Labour + Direct Tooling] --> D2[PRIME COST]
        D2 -->|Add Factory Overheads via Machine Hour Rate| D3[FACTORY / WORKS COST]
        D3 -->|Add Office & Administrative Overheads| D4[COST OF PRODUCTION]
        D4 -->|Add Selling & Distribution Overheads| D5[COST OF SALES]
        D5 -->|Apply Target Markup / Margin| D6[INVOICE QUOTATION PRICE]
    end
    
    D5 --> E[Batch Optimization: EBQ Calculator]
    E --> F[Interactive Sensitivity Matrix & Optimal Batch Size]
    
    D6 --> G[Commercial Quotation Generation]
    G --> H{Customer Acceptance Trigger}
    
    H -->|Accepted| I[Automated Accounting Dispatcher]
    I --> J[Double-Entry Journal Entry Generation]
    J --> K[General Ledger Updates: Debtors A/c Dr. | Sales A/c Cr.]
    J --> L[Trial Balance & Financial Position Update]
```

---

## 5. Functional Requirements & Specifications

### 5.1 Module 1: Geometry Parsing & Operational Cost Driver Ingestion
* **FR-1.1: CAD Model Ingestion:**
  * Support binary and ASCII `.STL` files.
  * Validate mesh manifoldness (watertight verification), facet count, and bounding box dimensions ($X, Y, Z$ in millimeters).
* **FR-1.2: Volumetric & Mass Computation:**
  * Compute exact volume ($V$ in $\text{cm}^3$) using discrete surface divergence integration (signed tetrahedra summation):
    $$V = \frac{1}{6} \left| \sum_{i=1}^{N} \vec{v}_{1,i} \cdot (\vec{v}_{2,i} \times \vec{v}_{3,i}) \right|$$
  * Derive material mass ($m$ in grams):
    $$m = V \times \rho \times (1 + \text{Infill Adjustment})$$
    where $\rho$ represents polymer/alloy density (e.g., PLA: $1.24\text{ g/cm}^3$, ABS: $1.04\text{ g/cm}^3$, Aluminum 6061: $2.70\text{ g/cm}^3$).
* **FR-1.3: Machine Runtime Estimation:**
  * Compute machine operation hours based on volumetric deposition/subtractive removal rates and layer travel speeds.
* **FR-1.4: Deterministic Manual Override Mode:**
  * Provide an explicit toggle switch allowing users to bypass STL parsing and directly input Direct Materials, Labour Hours, Hourly Wage Rates, and Direct Expenses.
  * Guarantee 100% precision matching against textbook benchmark test cases.

---

### 5.2 Module 2: Hierarchical Cost Sheet & EBQ Optimizer
* **FR-2.1: Multi-Tier Cost Sheet Generation:**
  The system shall structure all costs according to the standard institutional Cost Sheet format:
  1. $\text{Direct Material Cost} = \text{Mass} \times \text{Unit Cost per kg} + \text{Support Material Waste}$
  2. $\text{Direct Labour Cost} = \text{Operator Setup Hours} \times \text{Hourly Wage Rate}$
  3. $\text{Direct Expenses} = \text{Specialized CAD Licensing} + \text{Job-specific Tooling}$
  4. $\mathbf{Prime\ Cost} = \text{Direct Materials} + \text{Direct Labour} + \text{Direct Expenses}$
  5. $\text{Factory Overheads} = \text{Machine Runtime Hours} \times \text{Machine Hour Rate (MHR)}$ (or predetermined percentage of Direct Labour)
  6. $\mathbf{Works\ Cost\ (Factory\ Cost)} = \text{Prime Cost} + \text{Factory Overheads}$
  7. $\text{Administration Overheads} = \text{Predetermined \% of Works Cost}$
  8. $\mathbf{Cost\ of\ Production} = \text{Works Cost} + \text{Administration Overheads}$
  9. $\text{Selling \& Distribution Overheads} = \text{Predetermined \% or Fixed Logistics Charge}$
  10. $\mathbf{Cost\ of\ Sales\ (Total\ Cost)} = \text{Cost of Production} + \text{Selling \& Distribution Overheads}$
* **FR-2.2: Dual-Mode Profit Calculator:**
  * **Mode A (Markup on Cost):** $\text{Profit} = \text{Cost of Sales} \times \frac{\text{Markup \%}}{100}$
  * **Mode B (Margin on Selling Price):** $\text{Profit} = \text{Cost of Sales} \times \left( \frac{\text{Margin \%}}{100 - \text{Margin \%}} \right)$
  * $\mathbf{Quotation\ Price} = \text{Cost of Sales} + \text{Profit}$
* **FR-2.3: Economic Batch Quantity ($\text{EBQ}$) Optimizer:**
  * Compute optimal batch size for repeat contract orders:
    $$\text{EBQ} = \sqrt{\frac{2 \times D \times S}{H}}$$
    where:
    * $D$ = Annual Demand (units)
    * $S$ = Setup Cost per production batch (calibration, machine prep, cleaning)
    * $H$ = Annual Carrying / Holding Cost per unit (storage, capital lockup, obsolescence)
  * Render an interactive Sensitivity Matrix demonstrating that at $\text{EBQ}$, $\text{Annual Setup Cost} \equiv \text{Annual Holding Cost}$.

---

### 5.3 Module 3: Quotation Dispatch & Financial Accounting Ledger
* **FR-3.1: Commercial Quotation Formatter:**
  * Render an itemized, client-facing formal quote detailing Job ID, Date, Part Geometry summary, Line-item breakdown, Taxes, Total Billing, and Delivery Lead Time.
* **FR-3.2: Event-Driven Accounting Dispatch:**
  * Provide an interactive commercial action: `[Accept & Confirm Job Order]`.
  * Trigger immediate automated double-entry ledger transactions:
    * **Journal Entry (Credit Sale):**
      $$\begin{aligned}
      \text{Sundry Debtors / Customer A/c} & \quad \text{Dr.} \quad [\text{Quotation Price}] \\
      \text{To Sales Revenue A/c} & \quad \text{Cr.} \quad [\text{Quotation Price}] \\
      \textit{(Being credit sales recognized on job acceptance)} &
      \end{aligned}$$
    * **Secondary Transaction (Payment Settlement Option):**
      $$\begin{aligned}
      \text{Bank / Cash A/c} & \quad \text{Dr.} \quad [\text{Settled Amount}] \\
      \text{To Sundry Debtors A/c} & \quad \text{Cr.} \quad [\text{Settled Amount}]
      \end{aligned}$$
* **FR-3.3: Dynamic T-Ledger Display:**
  * Display real-time synchronized T-Accounts:
    1. **Customer / Debtor Ledger Account**
    2. **Sales Revenue Ledger Account**
    3. **Cash / Bank Ledger Account**
  * Display closing balances verifying debit-credit equilibrium.

---

## 6. Verification Test Cases & Textbook Benchmarks

### Test Case A: Custom Fabrication Job (Apex Printers / Standard Job Cost Benchmark)
* **Input Parameters:**
  * Direct Materials Consumed: ₹5,000.00
  * Direct Labour: 200 hours @ ₹15.00/hour = ₹3,000.00
  * Direct Expenses: ₹1,000.00
  * Factory Overhead Rate: 50% of Direct Labour Cost
  * Admin & Selling Overhead Rate: 10% of Works Cost
  * Target Profit: 20% Markup on Cost
* **Expected Output Verification:**
  * Prime Cost: ₹9,000.00
  * Factory Overheads: ₹1,500.00
  * Works Cost: ₹10,500.00
  * Admin & Selling Overheads: ₹1,050.00
  * Cost of Sales: ₹11,550.00
  * Profit (20% on Cost): ₹2,310.00
  * Final Quotation Price: **₹13,860.00**
  * Automated Journal Entry: `Dr. Customer A/c ₹13,860 | Cr. Sales A/c ₹13,860`.

### Test Case B: Batch Costing & EBQ Optimization Benchmark
* **Input Parameters:**
  * Annual Demand ($D$): 10,000 units
  * Setup Cost per Batch ($S$): ₹400.00
  * Holding Cost per Unit/Year ($H$): ₹2.00
* **Expected Output Verification:**
  * $\text{EBQ} = \sqrt{\frac{2 \times 10,000 \times 400}{2}} = \sqrt{4,000,000} = \mathbf{2,000\text{ units}}$.
  * Number of Batches: 5
  * Annual Setup Cost: $5 \times 400 = \text{₹}2,000.00$
  * Annual Holding Cost: $\frac{2,000}{2} \times 2 = \text{₹}2,000.00$
  * Total Annual Inventory Cost: **₹4,000.00 (Verified Minimum)**.

---

## 7. Non-Functional Requirements
1. **Determinism & Accuracy:** Financial figures rounded strictly to 2 decimal places with zero floating-point accumulation drift.
2. **Execution Latency:** Geometric mesh parsing and full financial reconciliation must execute in $< 500\text{ ms}$ for models up to $500,000$ facets.
3. **Reproducibility:** Codebase fully containerized and installable via standard package management (`pip install -r requirements.txt`).
4. **Resilience:** Gracefully handle corrupted STL files, non-manifold geometry warnings, and edge-case zero inputs with informative user alerts.
