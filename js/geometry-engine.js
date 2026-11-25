/**
 * geometry-engine.js
 * Deterministic STL mesh geometry analyzer and additive/subtractive process estimator.
 * Uses Three.js STLLoader in browser contexts and supports pure ArrayBuffer parsing in headless tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JobShopGeometry = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MATERIALS = {
    printing: {
      pla:   { id: 'pla',   name: 'PLA Filament',        density: 1.24, ratePerKg: 1800, scrapRatePerKg: 0 },
      petg:  { id: 'petg',  name: 'PETG Engineering',    density: 1.27, ratePerKg: 2200, scrapRatePerKg: 0 },
      abs:   { id: 'abs',   name: 'ABS Industrial',      density: 1.04, ratePerKg: 2000, scrapRatePerKg: 0 },
      resin: { id: 'resin', name: 'Tough SLA Resin',     density: 1.15, ratePerKg: 4500, scrapRatePerKg: 0 },
      nylon: { id: 'nylon', name: 'Nylon PA12 Sintered', density: 1.01, ratePerKg: 5500, scrapRatePerKg: 0 }
    },
    cnc: {
      alu6061:   { id: 'alu6061',   name: 'Aluminum 6061-T6', density: 2.70, ratePerKg: 480, scrapRatePerKg: 160 },
      steel_en8: { id: 'steel_en8', name: 'Mild Steel EN8',   density: 7.85, ratePerKg: 190, scrapRatePerKg: 45 },
      brass360:  { id: 'brass360',  name: 'Brass C360',       density: 8.50, ratePerKg: 880, scrapRatePerKg: 420 },
      delrin:    { id: 'delrin',    name: 'Delrin / Acetal',  density: 1.41, ratePerKg: 620, scrapRatePerKg: 0 }
    }
  };

  function roundN(val, decimals) {
    var factor = Math.pow(10, decimals || 2);
    return Math.round((Number(val) + Number.EPSILON) * factor) / factor;
  }

  /**
   * Extracts raw triangle vertex coordinates (Float32Array of length facetCount * 9)
   * using Three.js STLLoader when available, falling back to direct binary/ASCII parser.
   */
  function extractVerticesFromBuffer(arrayBuffer, threeStlLoaderClass) {
    if (threeStlLoaderClass) {
      var loader = new threeStlLoaderClass();
      var geometry = loader.parse(arrayBuffer);
      if (geometry.index) {
        geometry = geometry.toNonIndexed();
      }
      var pos = geometry.attributes && geometry.attributes.position;
      if (!pos || !pos.array || pos.array.length < 9) {
        throw new Error('Parsed STL geometry contains no valid triangular facets.');
      }
      return {
        vertices: pos.array,
        geometry: geometry
      };
    }

    // Pure JS STL parser (used in headless verification or fallback)
    if (!arrayBuffer || arrayBuffer.byteLength < 84) {
      throw new Error('File is too small to be a valid STL mesh.');
    }

    var view = new DataView(arrayBuffer);
    var triCount = view.getUint32(80, true);
    var expectedBinaryLen = 84 + triCount * 50;

    if (triCount > 0 && Math.abs(arrayBuffer.byteLength - expectedBinaryLen) <= 2) {
      var verts = new Float32Array(triCount * 9);
      for (var i = 0; i < triCount; i++) {
        var offset = 84 + i * 50 + 12; // skip 12-byte normal vector
        for (var j = 0; j < 9; j++) {
          verts[i * 9 + j] = view.getFloat32(offset + j * 4, true);
        }
      }
      return { vertices: verts, geometry: null };
    }

    // ASCII STL fallback
    var text = new TextDecoder('utf-8').decode(arrayBuffer);
    var regex = /vertex\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
    var coords = [];
    var m;
    while ((m = regex.exec(text)) !== null) {
      coords.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    if (coords.length < 9 || coords.length % 9 !== 0) {
      throw new Error('Unable to parse STL file as valid Binary or ASCII mesh.');
    }
    return { vertices: new Float32Array(coords), geometry: null };
  }

  /**
   * Computes exact signed tetrahedra volume, surface area, and bounding box from triangle vertices.
   * Shifts vertices by bounding-box minimum corner prior to divergence summation to avoid precision loss.
   */
  function computeMetricsFromVertices(vertices, geometry) {
    var facetCount = Math.floor(vertices.length / 9);
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (var i = 0; i < vertices.length; i += 3) {
      var x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    var signedVolMm3 = 0;
    var surfaceAreaMm2 = 0;

    for (var f = 0; f < facetCount; f++) {
      var base = f * 9;
      var x1 = vertices[base] - minX,     y1 = vertices[base + 1] - minY, z1 = vertices[base + 2] - minZ;
      var x2 = vertices[base + 3] - minX, y2 = vertices[base + 4] - minY, z2 = vertices[base + 5] - minZ;
      var x3 = vertices[base + 6] - minX, y3 = vertices[base + 7] - minY, z3 = vertices[base + 8] - minZ;

      // Divergence theorem: v1 . (v2 x v3) / 6
      var cx = y2 * z3 - z2 * y3;
      var cy = z2 * x3 - x2 * z3;
      var cz = x2 * y3 - y2 * x3;
      signedVolMm3 += (x1 * cx + y1 * cy + z1 * cz) / 6.0;

      // Triangle area: 0.5 * |(v2 - v1) x (v3 - v1)|
      var ux = x2 - x1, uy = y2 - y1, uz = z2 - z1;
      var vx = x3 - x1, vy = y3 - y1, vz = z3 - z1;
      var ax = uy * vz - uz * vy;
      var ay = uz * vx - ux * vz;
      var az = ux * vy - uy * vx;
      surfaceAreaMm2 += 0.5 * Math.sqrt(ax * ax + ay * ay + az * az);
    }

    var dimX = maxX - minX;
    var dimY = maxY - minY;
    var dimZ = maxZ - minZ;
    var volumeCm3 = Math.abs(signedVolMm3) / 1000.0;
    var surfaceAreaCm2 = surfaceAreaMm2 / 100.0;
    var bboxVolumeCm3 = (dimX * dimY * dimZ) / 1000.0;

    return {
      facetCount: facetCount,
      bboxMm: {
        x: roundN(dimX, 2),
        y: roundN(dimY, 2),
        z: roundN(dimZ, 2)
      },
      volumeCm3: roundN(volumeCm3, 3),
      surfaceAreaCm2: roundN(surfaceAreaCm2, 2),
      bboxVolumeCm3: roundN(bboxVolumeCm3, 3),
      geometry: geometry || null
    };
  }

  function parseStlBufferToMetrics(arrayBuffer, threeStlLoaderClass) {
    var extracted = extractVerticesFromBuffer(arrayBuffer, threeStlLoaderClass);
    return computeMetricsFromVertices(extracted.vertices, extracted.geometry);
  }

  /**
   * Derives physical material usage, waste/scrap credit, and machine time from CAD metrics.
   */
  function estimateProcessParameters(metrics, opts) {
    var options = opts || {};
    var mode = options.mode === 'cnc' ? 'cnc' : 'printing';
    var qty = Math.max(1, Number(options.quantity) || 1);
    var partVolCm3 = Math.max(0, Number(metrics && metrics.volumeCm3) || 0);
    var density = Math.max(0.01, Number(options.density) || 1.24);
    var ratePerKg = Math.max(0, Number(options.ratePerKg) || 0);
    var setupHours = Math.max(0, Number(options.setupHours) || 0);

    if (mode === 'printing') {
      var infillPct = Math.min(100, Math.max(5, Number(options.infillPct != null ? options.infillPct : 100)));
      var supportPct = Math.max(0, Number(options.supportWastePct != null ? options.supportWastePct : 10));
      var depRate = Math.max(0.5, Number(options.depositionRateCm3Hr) || 14);

      // Shell wall retention: at 100% infill factor = 1.00; below 100%, 35% outer wall + 65% scaled infill
      var effFillRatio = infillPct >= 100 ? 1.0 : (0.35 + 0.65 * (infillPct / 100));
      var effectiveVolPerUnit = partVolCm3 * effFillRatio;
      var netMassGPerUnit = effectiveVolPerUnit * density;
      var wasteMassGPerUnit = netMassGPerUnit * (supportPct / 100);
      var grossMassGPerUnit = netMassGPerUnit + wasteMassGPerUnit;

      var matCostPerUnit = (grossMassGPerUnit / 1000) * ratePerKg;
      var runHrsPerUnit = effectiveVolPerUnit / depRate;

      var totalMatCost = roundN(matCostPerUnit * qty, 2);
      var totalRunHrs = roundN(runHrsPerUnit * qty, 2);
      var totalMachineHrs = roundN(setupHours + totalRunHrs, 2);

      return {
        mode: 'printing',
        quantity: qty,
        partVolCm3: roundN(partVolCm3, 3),
        effectiveFillPct: roundN(effFillRatio * 100, 1),
        effectiveVolPerUnit: roundN(effectiveVolPerUnit, 3),
        stockVolPerUnit: roundN(effectiveVolPerUnit, 3),
        chipVolPerUnit: 0,
        netMassGPerUnit: roundN(netMassGPerUnit, 2),
        wasteMassGPerUnit: roundN(wasteMassGPerUnit, 2),
        grossMassGPerUnit: roundN(grossMassGPerUnit, 2),
        grossMassKgTotal: roundN((grossMassGPerUnit * qty) / 1000, 4),
        scrapCreditTotal: 0,
        materialCostPerUnit: roundN(matCostPerUnit, 2),
        totalMaterialCost: totalMatCost,
        setupHours: roundN(setupHours, 2),
        runHoursPerUnit: roundN(runHrsPerUnit, 2),
        totalRunHours: totalRunHrs,
        totalMachineHours: totalMachineHrs,
        workingBreakdown: [
          'Effective Fill Factor = ' + (infillPct >= 100 ? '100% (Solid)' : '35% Shell + 65% × ' + infillPct + '% Infill = ' + roundN(effFillRatio * 100, 1) + '%'),
          'Net Mass / unit = ' + roundN(partVolCm3, 2) + ' cm³ × ' + roundN(effFillRatio * 100, 1) + '% × ' + density + ' g/cm³ = ' + roundN(netMassGPerUnit, 2) + ' g',
          'Gross Filament (+' + supportPct + '% support) = ' + roundN(grossMassGPerUnit, 2) + ' g/unit (' + roundN((grossMassGPerUnit * qty) / 1000, 3) + ' kg total)',
          'Material Cost = ' + roundN((grossMassGPerUnit * qty) / 1000, 3) + ' kg × ₹' + ratePerKg + '/kg = ₹' + totalMatCost.toFixed(2),
          'Machine Time = ' + setupHours + ' hr setup + (' + qty + ' × ' + roundN(effectiveVolPerUnit, 2) + ' cm³ ÷ ' + depRate + ' cm³/hr) = ' + totalMachineHrs + ' hrs'
        ]
      };
    }

    // CNC Subtractive Machining Mode
    var bbox = (metrics && metrics.bboxMm) || { x: 20, y: 20, z: 20 };
    var allowanceMm = Math.max(0, Number(options.stockAllowanceMm != null ? options.stockAllowanceMm : 5));
    var mrr = Math.max(0.5, Number(options.mrrCm3Hr) || 40);
    var scrapRatePerKg = Math.max(0, Number(options.scrapRatePerKg) || 0);

    var stockX = (Number(bbox.x) || 0) + allowanceMm;
    var stockY = (Number(bbox.y) || 0) + allowanceMm;
    var stockZ = (Number(bbox.z) || 0) + allowanceMm;
    var stockVolPerUnit = (stockX * stockY * stockZ) / 1000.0;
    var chipVolPerUnit = Math.max(0, stockVolPerUnit - partVolCm3);

    var stockMassGPerUnit = stockVolPerUnit * density;
    var netMassGPerUnit = partVolCm3 * density;
    var chipMassGPerUnit = chipVolPerUnit * density;

    var matCostPerUnit = (stockMassGPerUnit / 1000) * ratePerKg;
    var scrapCreditPerUnit = (chipMassGPerUnit / 1000) * scrapRatePerKg;
    var runHrsPerUnit = chipVolPerUnit / mrr;

    var totalMatCost = roundN(matCostPerUnit * qty, 2);
    var totalScrapCredit = roundN(scrapCreditPerUnit * qty, 2);
    var totalRunHrs = roundN(runHrsPerUnit * qty, 2);
    var totalMachineHrs = roundN(setupHours + totalRunHrs, 2);

    return {
      mode: 'cnc',
      quantity: qty,
      partVolCm3: roundN(partVolCm3, 3),
      effectiveFillPct: 100,
      effectiveVolPerUnit: roundN(partVolCm3, 3),
      stockDimensionsMm: { x: roundN(stockX, 1), y: roundN(stockY, 1), z: roundN(stockZ, 1) },
      stockVolPerUnit: roundN(stockVolPerUnit, 3),
      chipVolPerUnit: roundN(chipVolPerUnit, 3),
      netMassGPerUnit: roundN(netMassGPerUnit, 2),
      wasteMassGPerUnit: roundN(chipMassGPerUnit, 2),
      grossMassGPerUnit: roundN(stockMassGPerUnit, 2),
      grossMassKgTotal: roundN((stockMassGPerUnit * qty) / 1000, 4),
      scrapCreditTotal: totalScrapCredit,
      materialCostPerUnit: roundN(matCostPerUnit, 2),
      totalMaterialCost: totalMatCost,
      setupHours: roundN(setupHours, 2),
      runHoursPerUnit: roundN(runHrsPerUnit, 2),
      totalRunHours: totalRunHrs,
      totalMachineHours: totalMachineHrs,
      workingBreakdown: [
        'Billet Stock (+' + allowanceMm + 'mm allowance) = ' + roundN(stockX, 1) + ' × ' + roundN(stockY, 1) + ' × ' + roundN(stockZ, 1) + ' mm = ' + roundN(stockVolPerUnit, 2) + ' cm³/unit',
        'Removed Chip Volume = ' + roundN(stockVolPerUnit, 2) + ' − ' + roundN(partVolCm3, 2) + ' = ' + roundN(chipVolPerUnit, 2) + ' cm³/unit',
        'Raw Billet Mass = ' + roundN(stockMassGPerUnit, 2) + ' g/unit (' + roundN((stockMassGPerUnit * qty) / 1000, 3) + ' kg total) → Gross Material = ₹' + totalMatCost.toFixed(2),
        'Recoverable Chip Scrap = ' + roundN((chipMassGPerUnit * qty) / 1000, 3) + ' kg × ₹' + scrapRatePerKg + '/kg = ₹' + totalScrapCredit.toFixed(2) + ' credit',
        'Machining Time = ' + setupHours + ' hr CAM/fixture + (' + qty + ' × ' + roundN(chipVolPerUnit, 2) + ' cm³ ÷ ' + mrr + ' cm³/hr MRR) = ' + totalMachineHrs + ' hrs'
      ]
    };
  }

  return {
    MATERIALS: MATERIALS,
    parseStlBufferToMetrics: parseStlBufferToMetrics,
    computeMetricsFromVertices: computeMetricsFromVertices,
    estimateProcessParameters: estimateProcessParameters
  };
}));
