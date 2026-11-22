# Technical Architecture & Implementation Blueprint

## Project: JobShop Quote Engine
**Document Version:** 1.0.0  
**Target Environment:** Python 3.9+ / Streamlit Engine  
**Module Integration:** Additive Geometry Analysis, Cost Hierarchy Engine, EBQ Optimizer, Automated Double-Entry Bookkeeping  

---

## 1. Architectural Philosophy
The **JobShop Quote Engine** is built upon a modular, decoupled architecture where each computational layer maintains strict single-responsibility boundaries:
1. **Geometric Core (`src/geometry_engine.py`):** Pure mathematical functions parsing facet meshes into volumetric, mass, and time physical primitives.
2. **Cost Calculation Engine (`src/cost_engine.py`):** Deterministic accounting pipeline executing hierarchical cost aggregation and margin/markup conversions.
3. **Batch Optimization Engine (`src/batch_engine.py`):** Analytical optimization module computing Economic Batch Quantities and generating cost-tradeoff matrices.
4. **Financial Ledger Engine (`src/ledger_engine.py`):** State-machine driven double-entry bookkeeping engine validating debit-credit equilibrium upon commercial transaction triggers.
5. **Presentation Layer (`app.py`):** Interactive, reactive Streamlit dashboard orchestrating the user experience with dual-mode ingestion (CAD File Upload vs. Manual Textbook Benchmark Mode).

---

## 2. Directory & Component Layout

```
JobShop_Quote_Engine/
├── PRD.md                      # Formal Product Requirements Document
├── BLUEPRINT.md                # Technical Blueprint & Engineering Specifications
├── README.md                   # Repository Documentation & User Guide
├── requirements.txt            # Pinned Python package dependencies
├── app.py                      # Main Streamlit user interface entrypoint
├── generate_sample_stl.py      # Standalone script to create binary test STL files
├── sample_models/              # Bundled CAD test fixtures
│   ├── mechanical_bracket.stl  # Sample structural engineering component
│   └── calibration_cube.stl    # Standard 20x20x20mm test cube
├── src/
│   ├── __init__.py
│   ├── geometry_engine.py      # STL mesh parsing, volume, and runtime calculation
│   ├── cost_engine.py          # Multi-tier cost sheet compiler and pricing rules
│   ├── batch_engine.py         # EBQ derivation and sensitivity table generator
│   └── ledger_engine.py        # Double-entry journal dispatch and T-ledger state
└── tests/
    ├── __init__.py
    ├── test_geometry.py        # Tests for volume and mass derivation
    ├── test_costing.py         # Validation against textbook cost sheet benchmarks
    ├── test_ebq.py             # Validation of EBQ cost minimization
    └── test_ledger.py          # Verification of debit=credit accounting integrity
```

---

## 3. Detailed Component Specifications & Interfaces

### 3.1 Geometric Processing Engine (`src/geometry_engine.py`)
Responsible for reading raw STL byte streams and outputting physical parameters.

* **Class / Function Signatures:**
  ```python
  class MeshMetrics:
      volume_cm3: float
      surface_area_cm2: float
      dimensions_xyz: tuple[float, float, float]
      facet_count: int
      is_watertight: bool

  def parse_stl_mesh(file_bytes_or_path: Union[bytes, str]) -> MeshMetrics:
      """
      Computes volume using the discrete divergence theorem:
      Sum of signed tetrahedra formed by mesh triangles with origin.
      """
      ...

  def estimate_manufacturing_parameters(
      metrics: MeshMetrics,
      material_density_g_cm3: float = 1.24,  # Default: PLA
      infill_percentage: float = 20.0,
      support_waste_percentage: float = 10.0,
      layer_height_mm: float = 0.20,
      print_speed_mm_s: float = 50.0
  ) -> dict:
      """
      Returns calculated net mass (grams), raw material consumed (grams),
      and estimated machine operational runtime (hours).
      """
      ...
  ```

---

### 3.2 Hierarchical Cost Engine (`src/cost_engine.py`)
Encapsulates institutional Cost and Management Accounting rules.

* **Data Models:**
  ```python
  from dataclasses import dataclass

  @dataclass
  class DirectCostInputs:
      material_cost: float
      labour_hours: float
      labour_rate_per_hour: float
      direct_expenses: float  # e.g., specialized CAD/tooling fees

  @dataclass
  class OverheadRates:
      machine_hours: float
      machine_hour_rate: float        # Factory Overhead absorption
      admin_overhead_rate_pct: float  # % of Works Cost
      selling_overhead_rate_pct: float # % of Cost of Production or fixed

  @dataclass
  class CostSheetSummary:
      direct_material: float
      direct_labour: float
      direct_expenses: float
      prime_cost: float
      factory_overheads: float
      works_cost: float
      admin_overheads: float
      cost_of_production: float
      selling_overheads: float
      cost_of_sales: float
      profit_amount: float
      quotation_price: float
      pricing_mode: str  # "Markup on Cost" | "Margin on Sales"
      profit_percentage: float
  ```

* **Core Functions:**
  ```python
  def compile_job_cost_sheet(
      direct_inputs: DirectCostInputs,
      overhead_rates: OverheadRates,
      target_profit_pct: float = 20.0,
      is_margin_on_sales: bool = False
  ) -> CostSheetSummary:
      """
      Calculates Prime Cost -> Works Cost -> Cost of Production -> Cost of Sales.
      Applies dual-mode profit computation:
      If is_margin_on_sales is True: Profit = Cost * (Rate / (100 - Rate))
      Else: Profit = Cost * (Rate / 100)
      """
      ...
  ```

---

### 3.3 Batch Costing & EBQ Optimizer (`src/batch_engine.py`)
Computes the Economic Batch Quantity and constructs the proof table.

* **Interface:**
  ```python
  @dataclass
  class EBQResult:
      optimal_batch_size: float
      annual_demand: float
      setup_cost_per_batch: float
      annual_holding_cost_per_unit: float
      number_of_batches: float
      annual_setup_cost: float
      annual_holding_cost: float
      total_annual_cost: float
      sensitivity_dataframe: pd.DataFrame

  def calculate_ebq(
      annual_demand: float,
      setup_cost: float,
      holding_cost_per_unit_year: float
  ) -> EBQResult:
      """
      Computes EBQ = sqrt((2 * D * S) / H).
      Generates sensitivity matrix across 50%, 75%, 100%, 125%, 150%, 200% of EBQ
      demonstrating that Setup Cost == Holding Cost at EBQ.
      """
      ...
  ```

---

### 3.4 Financial Accounting & Ledger Engine (`src/ledger_engine.py`)
Maintains an in-memory double-entry accounting ledger that registers commercial milestones.

* **Interface:**
  ```python
  @dataclass
  class JournalEntry:
      entry_id: str
      timestamp: str
      debit_account: str
      credit_account: str
      amount: float
      narration: str

  class LedgerAccount:
      name: str
      account_type: str  # 'Asset' | 'Liability' | 'Revenue' | 'Expense'
      debit_entries: list[tuple[str, float]]   # (narration, amount)
      credit_entries: list[tuple[str, float]]  # (narration, amount)
      
      @property
      def balance(self) -> float: ...

  class AccountingEngine:
      def __init__(self):
          self.journal: list[JournalEntry] = []
          self.accounts: dict[str, LedgerAccount] = {
              "Sundry Debtors": LedgerAccount("Sundry Debtors", "Asset"),
              "Sales Revenue": LedgerAccount("Sales Revenue", "Revenue"),
              "Bank / Cash": LedgerAccount("Bank / Cash", "Asset")
          }

      def record_order_acceptance(self, job_id: str, customer_name: str, quote_amount: float):
          """
          Dr. Sundry Debtors (Customer)
          Cr. Sales Revenue
          """
          ...

      def record_payment_receipt(self, customer_name: str, amount: float):
          """
          Dr. Bank / Cash
          Cr. Sundry Debtors
          """
          ...
  ```

---

## 4. UI/UX Workflow & Layout (Streamlit Specification)

The Streamlit interface (`app.py`) is organized into three unified functional stages:

### Tab 1: Geometric Input & Cost Configuration
* **Input Mode Toggle:** `[📂 Upload 3D CAD File (.STL)]` vs. `[📝 Manual Benchmark Override]`.
* **CAD Mode View:**
  * File uploader widget supporting `.stl`.
  * Display of 3D Part Bounding Box, Volume ($\text{cm}^3$), Net Mass ($\text{g}$), and Estimated Runtime.
  * Filament/Alloy selection dropdown with editable cost per kilogram.
* **Manual Mode View (Pre-populated Benchmark):**
  * One-click selector: *"Apex Printers Custom Order Benchmark"* or *"Custom Industrial Job"*.
  * Input fields for Direct Materials, Labour Hours, Hourly Wage, Direct Expenses.
* **Overhead & Markup Controls:**
  * Machine Hour Rate slider or percentage of direct labour.
  * Administration & Selling overhead percentages.
  * Profit Type toggle: `Markup on Cost (%)` vs. `Margin on Selling Price (%)`.

### Tab 2: Job Cost Sheet & EBQ Optimizer
* **Dynamic Cost Sheet Presentation:**
  * Formatted tabular statement displaying step-by-step additions.
  * Visual KPI tiles: **Prime Cost**, **Works Cost**, **Cost of Sales**, **Quotation Price**.
* **Batch Sizing & EBQ Analyzer:**
  * Inputs for Annual Repeat Demand ($D$), Batch Setup Cost ($S$), and Unit Holding Cost ($H$).
  * Metric badge showing calculated $\text{EBQ}$.
  * Plotly chart & interactive data table illustrating the parabolic cost curves (Setup Cost descending, Holding Cost ascending, Total Cost minimum at $\text{EBQ}$).

### Tab 3: Commercial Quotation & Live Accounting Ledger
* **Printable / Formal Quote Card:**
  * Formatted commercial proposal with Job Number, Customer Name, Cost Breakdown, Tax, and Validity Period.
* **Commercial Action:** `[Confirm & Accept Quotation]`.
* **Live Double-Entry Financial State:**
  * Real-time generation of the formal Journal Entry with Dr/Cr verification.
  * Side-by-side rendered T-Ledger accounts (`Sundry Debtors A/c` and `Sales Revenue A/c`).
  * Balance confirmation proving total debits equal total credits.

---

## 5. Verification & Testing Matrix

| Test Suite | File | Benchmark Standard | Expected Output |
| :--- | :--- | :--- | :--- |
| **Mesh Divergence** | `tests/test_geometry.py` | 20x20x20 mm Cube | Exact volume = $8.00\text{ cm}^3 \pm 0.01$ |
| **Apex Printers Job Sheet** | `tests/test_costing.py` | Module 4 Classroom Exercise | Works Cost = ₹10,500, Final Quote = ₹13,860.00 |
| **EBQ Mathematical Equivalence** | `tests/test_ebq.py` | Module 4 EBQ Model ($D=10k, S=400, H=2$) | $\text{EBQ} = 2,000$, $\text{Setup Cost} \equiv \text{Holding Cost} = \text{₹}2,000$ |
| **Double-Entry Equilibrium** | `tests/test_ledger.py` | Credit Sale Transaction | $\sum \text{Debits} \equiv \sum \text{Credits}$ across all ledger accounts |
