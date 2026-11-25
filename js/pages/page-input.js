/**
 * page-input.js
 * Controls Page 1 (index.html): STL upload/sample loader, Three.js neutral 3D CAD viewer,
 * 3D Print & CNC Machining estimators, and Manual Textbook Override mode.
 */
(function (root) {
  'use strict';

  var state = root.JobShopState.load();
  var fmt = root.JobShopState.formatINR;
  var esc = root.JobShopState.escapeHTML;

  // Three.js Viewport State
  var scene, camera, renderer, controls, meshGroup;
  var currentMetrics = state.cadInput.metrics || {
    facetCount: 24,
    bboxMm: { x: 60, y: 45, z: 45 },
    volumeCm3: 48.12,
    surfaceAreaCm2: 120.54,
    bboxVolumeCm3: 121.5
  };

  function decodeBase64ToArrayBuffer(b64) {
    var binStr = root.atob(b64);
    var len = binStr.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function initThreeViewport() {
    var container = document.getElementById('stl-viewport');
    if (!container || typeof root.THREE === 'undefined') return;

    var w = container.clientWidth || 500;
    var h = container.clientHeight || 310;

    try {
      renderer = new root.THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      renderer = null;
      return;
    }

    scene = new root.THREE.Scene();
    scene.background = new root.THREE.Color(0xF4F2EC);

    camera = new root.THREE.PerspectiveCamera(40, w / h, 0.1, 2000);
    camera.position.set(95, 75, 95);

    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    container.insertBefore(renderer.domElement, container.firstChild);

    if (root.THREE.OrbitControls) {
      controls = new root.THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }

    var ambient = new root.THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    var keyLight = new root.THREE.DirectionalLight(0xffffff, 0.72);
    keyLight.position.set(120, 180, 140);
    scene.add(keyLight);

    var fillLight = new root.THREE.DirectionalLight(0xdce6f2, 0.35);
    fillLight.position.set(-100, -60, -80);
    scene.add(fillLight);

    var grid = new root.THREE.GridHelper(140, 14, 0xc8c3b8, 0xe2dfd7);
    scene.add(grid);

    meshGroup = new root.THREE.Group();
    scene.add(meshGroup);

    root.addEventListener('resize', function () {
      if (!container || !renderer || !camera) return;
      var nw = container.clientWidth;
      var nh = container.clientHeight;
      if (nw > 0 && nh > 0) {
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      }
    });

    (function animate() {
      root.requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }());
  }

  function renderWireframeSvgFallback(geometry) {
    var container = document.getElementById('stl-viewport');
    if (!container || !geometry || !geometry.attributes || !geometry.attributes.position) return;

    var prev = container.querySelector('.stl-svg-fallback');
    if (prev) prev.remove();

    var pos = geometry.attributes.position.array;
    var W = 500, H = 310;
    // Simple isometric projection onto SVG for WebGL-less environments
    var pts = [];
    var minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    var cosA = 0.866, sinA = 0.5;

    for (var i = 0; i < pos.length; i += 3) {
      var x = pos[i], y = pos[i + 1], z = pos[i + 2];
      var u = (x - y) * cosA;
      var v = -z + (x + y) * sinA * 0.65;
      pts.push(u, v);
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }

    var span = Math.max(maxU - minU, maxV - minV, 1);
    var scale = (Math.min(W, H) * 0.72) / span;
    var cx = (minU + maxU) / 2, cy = (minV + maxV) / 2;

    var polys = [];
    var step = pos.length > 6000 ? 3 : 1; // keep dense meshes crisp & fast
    for (var t = 0; t < pos.length / 9; t += step) {
      var b = t * 6;
      var p1 = ((pts[b] - cx) * scale + W / 2).toFixed(1) + ',' + ((pts[b + 1] - cy) * scale + H / 2).toFixed(1);
      var p2 = ((pts[b + 2] - cx) * scale + W / 2).toFixed(1) + ',' + ((pts[b + 3] - cy) * scale + H / 2).toFixed(1);
      var p3 = ((pts[b + 4] - cx) * scale + W / 2).toFixed(1) + ',' + ((pts[b + 5] - cy) * scale + H / 2).toFixed(1);
      polys.push('<polygon points="' + p1 + ' ' + p2 + ' ' + p3 + '" fill="rgba(74,99,125,0.14)" stroke="#1E3A5F" stroke-width="0.7" />');
    }

    var svgEl = document.createElement('div');
    svgEl.className = 'stl-svg-fallback';
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    svgEl.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:100%;display:block;">' + polys.join('') + '</svg>';
    container.insertBefore(svgEl, container.firstChild);
  }

  function renderGeometryInViewport(geometry) {
    if (!geometry) return;
    if (!renderer || !scene || !meshGroup) {
      renderWireframeSvgFallback(geometry);
      return;
    }
    while (meshGroup.children.length > 0) {
      var child = meshGroup.children[0];
      meshGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    geometry.computeBoundingBox();
    var box = geometry.boundingBox;
    var center = new root.THREE.Vector3();
    box.getCenter(center);

    var size = new root.THREE.Vector3();
    box.getSize(size);

    // Center X/Z on grid and rest bottom Z/Y cleanly on build plate (Note: CAD Z-up -> Three Y-up)
    var mat = new root.THREE.MeshStandardMaterial({
      color: 0x4A637D,
      roughness: 0.55,
      metalness: 0.15
    });

    var mesh = new root.THREE.Mesh(geometry, mat);
    // Rotate -90 deg around X so CAD +Z faces upward (+Y in Three.js)
    mesh.rotation.x = -Math.PI / 2;
    mesh.updateMatrixWorld(true);

    var rotBox = new root.THREE.Box3().setFromObject(mesh);
    var rotCenter = new root.THREE.Vector3();
    rotBox.getCenter(rotCenter);
    mesh.position.x -= rotCenter.x;
    mesh.position.z -= rotCenter.z;
    mesh.position.y -= rotBox.min.y;

    meshGroup.add(mesh);

    // Add clean edge lines so mechanical facets are crisp
    var edges = new root.THREE.EdgesGeometry(geometry, 25);
    var lineMat = new root.THREE.LineBasicMaterial({ color: 0x1E3A5F, opacity: 0.35, transparent: true });
    var lineSegs = new root.THREE.LineSegments(edges, lineMat);
    lineSegs.rotation.copy(mesh.rotation);
    lineSegs.position.copy(mesh.position);
    meshGroup.add(lineSegs);

    // Frame camera neatly around object
    var maxDim = Math.max(size.x, size.y, size.z, 15);
    var dist = maxDim * 2.15;
    camera.position.set(dist * 0.85, dist * 0.65, dist * 0.95);
    if (controls) {
      controls.target.set(0, size.z * 0.45, 0);
      controls.update();
    }
  }

  function loadStlFromBuffer(arrayBuffer, filename) {
    var errEl = document.getElementById('stl-error');
    if (errEl) errEl.style.display = 'none';

    try {
      var loaderClass = root.THREE && root.THREE.STLLoader ? root.THREE.STLLoader : null;
      var metrics = root.JobShopGeometry.parseStlBufferToMetrics(arrayBuffer, loaderClass);
      currentMetrics = metrics;

      state.cadInput.metrics = {
        facetCount: metrics.facetCount,
        bboxMm: metrics.bboxMm,
        volumeCm3: metrics.volumeCm3,
        surfaceAreaCm2: metrics.surfaceAreaCm2,
        bboxVolumeCm3: metrics.bboxVolumeCm3
      };
      state.jobMeta.partName = filename;
      state.cadInput.selectedSample = filename;
      root.JobShopState.save(state);

      if (metrics.geometry) {
        renderGeometryInViewport(metrics.geometry);
      }
      renderMetricsTable();
      recalculateAndRender();
      root.JobShopNav.renderJobStatusBar();
    } catch (err) {
      if (errEl) {
        errEl.textContent = 'STL Error: ' + (err.message || 'Invalid STL file');
        errEl.style.display = 'block';
      }
    }
  }

  function loadSampleStl(sampleName) {
    // Try fetching sample_models/<name> when served over HTTP; fall back seamlessly to embedded base64 for file://
    fetch('sample_models/' + sampleName)
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP status ' + resp.status);
        return resp.arrayBuffer();
      })
      .then(function (buf) {
        loadStlFromBuffer(buf, sampleName);
      })
      .catch(function () {
        if (root.JOBSHOP_SAMPLE_STLS && root.JOBSHOP_SAMPLE_STLS[sampleName]) {
          var ab = decodeBase64ToArrayBuffer(root.JOBSHOP_SAMPLE_STLS[sampleName]);
          loadStlFromBuffer(ab, sampleName);
        }
      });
  }

  function renderMetricsTable() {
    var el = document.getElementById('mesh-metrics-body');
    if (!el || !currentMetrics) return;
    var b = currentMetrics.bboxMm || { x: 0, y: 0, z: 0 };
    el.innerHTML = '' +
      '<tr><td>Bounding Dimensions (X &times; Y &times; Z)</td><td class="num">' + b.x + ' &times; ' + b.y + ' &times; ' + b.z + ' mm</td></tr>' +
      '<tr><td>Net Solid Volume (Divergence Theorem)</td><td class="num"><strong>' + currentMetrics.volumeCm3.toFixed(3) + ' cm&sup3;</strong></td></tr>' +
      '<tr><td>Total Surface Area</td><td class="num">' + currentMetrics.surfaceAreaCm2.toFixed(2) + ' cm&sup2;</td></tr>' +
      '<tr><td>Bounding Envelope Volume</td><td class="num">' + currentMetrics.bboxVolumeCm3.toFixed(3) + ' cm&sup3;</td></tr>' +
      '<tr><td>Triangle Facet Count</td><td class="num">' + currentMetrics.facetCount.toLocaleString('en-IN') + ' tris</td></tr>';
  }

  function populateMaterialOptions() {
    var printSel = document.getElementById('sel-print-material');
    var cncSel = document.getElementById('sel-cnc-material');
    var mats = root.JobShopGeometry.MATERIALS;

    if (printSel && printSel.options.length === 0) {
      Object.keys(mats.printing).forEach(function (k) {
        var m = mats.printing[k];
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = m.name + ' (' + m.density + ' g/cm³, ₹' + m.ratePerKg + '/kg)';
        printSel.appendChild(opt);
      });
      printSel.value = state.cadInput.printMaterial || 'pla';
    }

    if (cncSel && cncSel.options.length === 0) {
      Object.keys(mats.cnc).forEach(function (k) {
        var m = mats.cnc[k];
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = m.name + ' (' + m.density + ' g/cm³, ₹' + m.ratePerKg + '/kg)';
        cncSel.appendChild(opt);
      });
      cncSel.value = state.cadInput.cncMaterial || 'alu6061';
    }
  }

  function syncFormValuesFromState() {
    document.getElementById('inp-job-id').value = state.jobMeta.jobId;
    document.getElementById('inp-customer').value = state.jobMeta.customerName;
    document.getElementById('inp-qty').value = state.cadInput.quantity;
    document.getElementById('inp-machine-center').value = state.jobMeta.machineCenter;

    // 3D Print inputs
    document.getElementById('sel-print-material').value = state.cadInput.printMaterial;
    document.getElementById('inp-print-density').value = state.cadInput.density;
    document.getElementById('inp-print-rate').value = state.cadInput.ratePerKg;
    document.getElementById('inp-infill').value = state.cadInput.infillPct;
    document.getElementById('inp-support').value = state.cadInput.supportWastePct;
    document.getElementById('inp-dep-rate').value = state.cadInput.depositionRateCm3Hr;
    document.getElementById('inp-print-setup').value = state.cadInput.setupHours;

    // CNC inputs
    document.getElementById('sel-cnc-material').value = state.cadInput.cncMaterial;
    document.getElementById('inp-cnc-density').value = state.cadInput.cncDensity;
    document.getElementById('inp-cnc-rate').value = state.cadInput.cncRatePerKg;
    document.getElementById('inp-cnc-scrap').value = state.cadInput.cncScrapRatePerKg;
    document.getElementById('inp-cnc-allowance').value = state.cadInput.stockAllowanceMm;
    document.getElementById('inp-cnc-mrr').value = state.cadInput.mrrCm3Hr;
    document.getElementById('inp-cnc-setup').value = state.cadInput.cncSetupHours;

    // Labour / Overhead transfer parameters
    document.getElementById('inp-labour-hrs').value = state.costInputs.labourHours;
    document.getElementById('inp-labour-rate').value = state.costInputs.labourRate;
    document.getElementById('inp-direct-exp').value = state.costInputs.directExpenses;
    document.getElementById('inp-mhr').value = state.costInputs.machineHourRate;

    // Manual override fields
    document.getElementById('man-qty').value = state.costInputs.quantity;
    document.getElementById('man-dm').value = state.costInputs.directMaterial;
    document.getElementById('man-scrap').value = state.costInputs.scrapCredit;
    document.getElementById('man-dl-hrs').value = state.costInputs.labourHours;
    document.getElementById('man-dl-rate').value = state.costInputs.labourRate;
    document.getElementById('man-de').value = state.costInputs.directExpenses;
    document.getElementById('man-mach-hrs').value = state.costInputs.machineHours;
    document.getElementById('man-mhr').value = state.costInputs.machineHourRate;
  }

  function updateVisibility() {
    var isManual = state.cadInput.inputMode === 'manual';
    var isCnc = state.cadInput.processMode === 'cnc';

    document.getElementById('btn-mode-stl').classList.toggle('active', !isManual);
    document.getElementById('btn-mode-manual').classList.toggle('active', isManual);

    document.getElementById('panel-stl-left').style.display = isManual ? 'none' : 'block';
    document.getElementById('panel-manual-left').style.display = isManual ? 'block' : 'none';
    document.getElementById('panel-cad-process').style.display = isManual ? 'none' : 'block';
    document.getElementById('panel-manual-process').style.display = isManual ? 'block' : 'none';

    document.getElementById('btn-proc-print').classList.toggle('active', !isCnc);
    document.getElementById('btn-proc-cnc').classList.toggle('active', isCnc);
    document.getElementById('fields-printing').style.display = isCnc ? 'none' : 'block';
    document.getElementById('fields-cnc').style.display = isCnc ? 'block' : 'none';
  }

  function readInputsIntoState() {
    state.jobMeta.jobId = document.getElementById('inp-job-id').value.trim() || 'JOB-2026-01';
    state.jobMeta.customerName = document.getElementById('inp-customer').value.trim() || 'Client';
    state.jobMeta.machineCenter = document.getElementById('inp-machine-center').value.trim() || 'Workshop Cell';

    if (state.cadInput.inputMode === 'stl') {
      state.cadInput.quantity = Math.max(1, Number(document.getElementById('inp-qty').value) || 1);

      state.cadInput.printMaterial = document.getElementById('sel-print-material').value;
      state.cadInput.density = Number(document.getElementById('inp-print-density').value) || 1.24;
      state.cadInput.ratePerKg = Number(document.getElementById('inp-print-rate').value) || 0;
      state.cadInput.infillPct = Number(document.getElementById('inp-infill').value) || 20;
      state.cadInput.supportWastePct = Number(document.getElementById('inp-support').value) || 0;
      state.cadInput.depositionRateCm3Hr = Number(document.getElementById('inp-dep-rate').value) || 10;
      state.cadInput.setupHours = Number(document.getElementById('inp-print-setup').value) || 0;

      state.cadInput.cncMaterial = document.getElementById('sel-cnc-material').value;
      state.cadInput.cncDensity = Number(document.getElementById('inp-cnc-density').value) || 2.70;
      state.cadInput.cncRatePerKg = Number(document.getElementById('inp-cnc-rate').value) || 0;
      state.cadInput.cncScrapRatePerKg = Number(document.getElementById('inp-cnc-scrap').value) || 0;
      state.cadInput.stockAllowanceMm = Number(document.getElementById('inp-cnc-allowance').value) || 0;
      state.cadInput.mrrCm3Hr = Number(document.getElementById('inp-cnc-mrr').value) || 20;
      state.cadInput.cncSetupHours = Number(document.getElementById('inp-cnc-setup').value) || 0;

      state.costInputs.labourHours = Number(document.getElementById('inp-labour-hrs').value) || 0;
      state.costInputs.labourRate = Number(document.getElementById('inp-labour-rate').value) || 0;
      state.costInputs.directExpenses = Number(document.getElementById('inp-direct-exp').value) || 0;
      state.costInputs.machineHourRate = Number(document.getElementById('inp-mhr').value) || 0;
    } else {
      state.costInputs.quantity = Math.max(1, Number(document.getElementById('man-qty').value) || 1);
      state.costInputs.directMaterial = Number(document.getElementById('man-dm').value) || 0;
      state.costInputs.scrapCredit = Number(document.getElementById('man-scrap').value) || 0;
      state.costInputs.labourHours = Number(document.getElementById('man-dl-hrs').value) || 0;
      state.costInputs.labourRate = Number(document.getElementById('man-dl-rate').value) || 0;
      state.costInputs.directExpenses = Number(document.getElementById('man-de').value) || 0;
      state.costInputs.machineHours = Number(document.getElementById('man-mach-hrs').value) || 0;
      state.costInputs.machineHourRate = Number(document.getElementById('man-mhr').value) || 0;
      state.costInputs.sourceLabel = 'Manual Textbook Input Mode';
    }
  }

  function recalculateAndRender() {
    readInputsIntoState();

    if (state.cadInput.inputMode === 'stl') {
      var opts = state.cadInput.processMode === 'cnc'
        ? {
            mode: 'cnc',
            quantity: state.cadInput.quantity,
            density: state.cadInput.cncDensity,
            ratePerKg: state.cadInput.cncRatePerKg,
            scrapRatePerKg: state.cadInput.cncScrapRatePerKg,
            stockAllowanceMm: state.cadInput.stockAllowanceMm,
            mrrCm3Hr: state.cadInput.mrrCm3Hr,
            setupHours: state.cadInput.cncSetupHours
          }
        : {
            mode: 'printing',
            quantity: state.cadInput.quantity,
            density: state.cadInput.density,
            ratePerKg: state.cadInput.ratePerKg,
            infillPct: state.cadInput.infillPct,
            supportWastePct: state.cadInput.supportWastePct,
            depositionRateCm3Hr: state.cadInput.depositionRateCm3Hr,
            setupHours: state.cadInput.setupHours
          };

      var est = root.JobShopGeometry.estimateProcessParameters(currentMetrics, opts);

      // Update live derived outputs
      document.getElementById('out-mass-kg').textContent = est.grossMassKgTotal.toFixed(3) + ' kg';
      document.getElementById('out-mat-cost').textContent = fmt(est.totalMaterialCost);
      document.getElementById('out-mach-hrs').textContent = est.totalMachineHours.toFixed(2) + ' hrs';
      document.getElementById('out-scrap-credit').textContent = fmt(est.scrapCreditTotal);

      var workingEl = document.getElementById('cad-working-box');
      if (workingEl) {
        workingEl.innerHTML = est.workingBreakdown.map(function (line) {
          return '<div>' + esc(line) + '</div>';
        }).join('');
      }

      // Sync CAD calculation directly into shared costInputs
      state.costInputs.quantity = est.quantity;
      state.costInputs.directMaterial = est.totalMaterialCost;
      state.costInputs.scrapCredit = est.scrapCreditTotal;
      state.costInputs.machineHours = est.totalMachineHours;
      state.costInputs.factoryOhMode = state.costInputs.factoryOhMode === 'pct_dl' ? 'mhr' : (state.costInputs.factoryOhMode || 'mhr');
      state.costInputs.sourceLabel = (est.mode === 'cnc' ? 'CNC Billet' : '3D Print') + ' CAD (' + state.jobMeta.partName + ')';
    } else {
      var manCost = root.JobShopCosting.calculateJobCostSheet(state.costInputs);
      document.getElementById('man-preview-prime').textContent = fmt(manCost.primeCost);
      document.getElementById('man-preview-works').textContent = fmt(manCost.worksCost);
      document.getElementById('man-preview-quote').textContent = fmt(manCost.quotationPrice);
    }

    root.JobShopState.save(state);
    root.JobShopNav.renderJobStatusBar();
  }

  function bindEvents() {
    document.getElementById('btn-mode-stl').addEventListener('click', function () {
      state.cadInput.inputMode = 'stl';
      updateVisibility();
      recalculateAndRender();
    });

    document.getElementById('btn-mode-manual').addEventListener('click', function () {
      state.cadInput.inputMode = 'manual';
      syncFormValuesFromState();
      updateVisibility();
      recalculateAndRender();
    });

    document.getElementById('btn-proc-print').addEventListener('click', function () {
      state.cadInput.processMode = 'printing';
      state.jobMeta.machineCenter = 'FDM / SLA Cell';
      document.getElementById('inp-machine-center').value = state.jobMeta.machineCenter;
      updateVisibility();
      recalculateAndRender();
    });

    document.getElementById('btn-proc-cnc').addEventListener('click', function () {
      state.cadInput.processMode = 'cnc';
      state.jobMeta.machineCenter = 'CNC VMC-03';
      document.getElementById('inp-machine-center').value = state.jobMeta.machineCenter;
      updateVisibility();
      recalculateAndRender();
    });

    // Material preset changes auto-fill physical density and material rate
    document.getElementById('sel-print-material').addEventListener('change', function (e) {
      var mat = root.JobShopGeometry.MATERIALS.printing[e.target.value];
      if (mat) {
        document.getElementById('inp-print-density').value = mat.density;
        document.getElementById('inp-print-rate').value = mat.ratePerKg;
      }
      recalculateAndRender();
    });

    document.getElementById('sel-cnc-material').addEventListener('change', function (e) {
      var mat = root.JobShopGeometry.MATERIALS.cnc[e.target.value];
      if (mat) {
        document.getElementById('inp-cnc-density').value = mat.density;
        document.getElementById('inp-cnc-rate').value = mat.ratePerKg;
        document.getElementById('inp-cnc-scrap').value = mat.scrapRatePerKg;
      }
      recalculateAndRender();
    });

    // File upload & Drag-and-drop
    var dropzone = document.getElementById('stl-dropzone');
    var fileInput = document.getElementById('stl-file-input');

    dropzone.addEventListener('click', function () {
      fileInput.click();
    });

    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) readUploadedStl(file);
    });

    fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) readUploadedStl(file);
    });

    function readUploadedStl(file) {
      var reader = new FileReader();
      reader.onload = function (evt) {
        loadStlFromBuffer(evt.target.result, file.name);
      };
      reader.readAsArrayBuffer(file);
    }

    // Sample STL preset buttons
    document.querySelectorAll('[data-sample-stl]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.cadInput.inputMode = 'stl';
        updateVisibility();
        loadSampleStl(btn.getAttribute('data-sample-stl'));
      });
    });

    // Textbook Benchmark Preset button
    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state = root.JobShopState.applyPreset(state, btn.getAttribute('data-preset'));
        syncFormValuesFromState();
        updateVisibility();
        recalculateAndRender();
      });
    });

    // Bind live input changes
    document.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', recalculateAndRender);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    root.JobShopNav.renderHeader('input');
    populateMaterialOptions();
    syncFormValuesFromState();
    updateVisibility();
    initThreeViewport();
    renderMetricsTable();
    bindEvents();

    if (state.cadInput.inputMode === 'stl') {
      loadSampleStl(state.cadInput.selectedSample || 'mechanical_bracket.stl');
    } else {
      recalculateAndRender();
    }
  });
}(window));
