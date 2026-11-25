/**
 * nav.js
 * Renders the shared header, 4-page navigation tabs, and active job status strip.
 */
(function (root) {
  'use strict';

  function renderHeader(activePage) {
    var header = document.getElementById('app-header');
    if (!header) return;

    var st = root.JobShopState.load();
    var pages = [
      { id: 'input',   href: 'index.html',   num: '01', label: 'CAD & Job Inputs' },
      { id: 'costing', href: 'costing.html', num: '02', label: 'Job Card & Cost Sheet' },
      { id: 'batch',   href: 'batch.html',   num: '03', label: 'EBQ & Make-or-Buy' },
      { id: 'ledger',  href: 'ledger.html',  num: '04', label: 'Quotation & Accounting Ledger' }
    ];

    var navHtml = pages.map(function (p) {
      var cls = p.id === activePage ? 'nav-tab active' : 'nav-tab';
      return '<a class="' + cls + '" href="' + p.href + '">' +
        '<span class="nav-step-num">' + p.num + '</span>' +
        '<span>' + root.JobShopState.escapeHTML(p.label) + '</span>' +
      '</a>';
    }).join('');

    header.innerHTML = '' +
      '<div class="header-inner">' +
        '<div class="brand-row">' +
          '<div>' +
            '<h1 class="brand-title">' + root.JobShopState.escapeHTML(st.workshop.name) + ' &mdash; JobShop Quote Engine</h1>' +
            '<p class="brand-subtitle">CAD Cost Estimation &bull; Job &amp; Batch Costing &bull; Double-Entry Sales Ledger</p>' +
          '</div>' +
          '<div class="header-meta">' +
            '<span class="badge">Job: ' + root.JobShopState.escapeHTML(st.jobMeta.jobId) + '</span>' +
            '<button type="button" class="btn btn-sm" id="btn-global-reset" title="Reset workshop state to defaults">Reset Workspace</button>' +
          '</div>' +
        '</div>' +
        '<nav class="nav-tabs" aria-label="Workflow steps">' + navHtml + '</nav>' +
      '</div>';

    var resetBtn = document.getElementById('btn-global-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        root.JobShopState.reset();
        root.location.reload();
      });
    }
  }

  function renderJobStatusBar(containerId) {
    var el = document.getElementById(containerId || 'job-status-bar');
    if (!el) return;
    var st = root.JobShopState.load();
    var cost = root.JobShopCosting.calculateJobCostSheet(st.costInputs);
    var esc = root.JobShopState.escapeHTML;
    var fmt = root.JobShopState.formatINR;

    el.innerHTML = '' +
      '<div class="status-group">' +
        '<span class="status-item">Active Part: <strong>' + esc(st.jobMeta.partName) + '</strong></span>' +
        '<span class="status-item">Order Qty: <strong>' + cost.quantity + ' units</strong></span>' +
        '<span class="status-item">Cost of Sales: <strong>' + fmt(cost.costOfSales) + '</strong></span>' +
        '<span class="status-item">Quote Total: <strong>' + fmt(cost.quotationPrice) + '</strong></span>' +
      '</div>' +
      '<div class="status-group">' +
        '<span class="muted-note">Source: ' + esc(st.costInputs.sourceLabel || 'Manual') + '</span>' +
      '</div>';
  }

  root.JobShopNav = {
    renderHeader: renderHeader,
    renderJobStatusBar: renderJobStatusBar
  };
}(window));
