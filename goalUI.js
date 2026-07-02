'use strict';

// goalUI.js — rendering y eventos DOM para la vista Goal-Based Investing

// ── Estado interno ────────────────────────────────────────────────────────────

var _gbiWorker      = null;
var _gbiLastResult  = null;
var _gbiHistoricalChart = null;
var _gbiSliderMin   = 3;   // % anual (se actualiza con MVP vol)
var _gbiSliderMax   = 30;  // % anual (se actualiza con max asset vol)

var _ASSET_COLORS = {
  'Acciones USA':         '#1f3a8a',
  'Acciones Europa':      '#2e52c2',
  'Acciones EM':          '#4a7fd4',
  'Renta Fija Global IG': '#16a34a',
  'Renta Fija Global HY': '#22c55e',
  'Renta Fija EM':        '#86efac',
  'Money Market':         '#9ca3af',
  'Real Estate':          '#a78bfa',
  'Infrastructure':       '#34d399',
  'Oro':                  '#f59e0b',
  'Commodities':          '#f97316'
};

// ── Inicialización de la vista ────────────────────────────────────────────────

function gbiInicializar() {
  // Actualizar display W0
  var w0 = parseFloat(document.getElementById('initialValue').value);
  document.getElementById('gbi-w0-display').textContent =
    isNaN(w0) ? '—' : '$' + w0.toLocaleString();

  // Actualizar badge de tipo de retorno
  var rt = document.getElementById('returnType').value;
  document.getElementById('gbi-return-badge').textContent =
    rt === 'real' ? 'Retornos reales (ajustados por inflación)' : 'Retornos nominales';

  // Pedir MVP vol al worker si los datos están disponibles
  var md = (rt === 'real') ? marketDataReal : marketDataNominal;
  if (md && md.length > 0) _gbiFetchInfo(md);
}

function _gbiFetchInfo(marketData) {
  if (_gbiWorker) _gbiWorker.terminate();
  _gbiWorker = new Worker('goalWorker.js');
  _gbiWorker.onmessage = function(e) {
    if (e.data.type === 'info') {
      var volMvp = e.data.vol_mvp;
      var volMax = e.data.vol_max;
      _gbiSliderMin = Math.max(1, Math.ceil(volMvp * 100));
      _gbiSliderMax = Math.min(50, Math.ceil(volMax * 100));

      var slider = document.getElementById('gbi-sigma-slider');
      slider.min  = _gbiSliderMin;
      slider.max  = _gbiSliderMax;
      var cur = parseFloat(slider.value);
      if (cur < _gbiSliderMin) { slider.value = _gbiSliderMin; document.getElementById('gbi-sigma-display').textContent = _gbiSliderMin + '%'; }
      if (cur > _gbiSliderMax) { slider.value = _gbiSliderMax; document.getElementById('gbi-sigma-display').textContent = _gbiSliderMax + '%'; }

      document.getElementById('gbi-sigma-hint').textContent =
        'Mín: ' + _gbiSliderMin + '% (MVP)  ·  Máx: ' + _gbiSliderMax + '%';
    }
  };
  _gbiWorker.onerror = function() { /* ignore info errors */ };
  _gbiWorker.postMessage({ type: 'getInfo', marketData: marketData });
}

// ── Manejo de la tabla de objetivos ──────────────────────────────────────────

function gbiAgregarObjetivo() {
  var container = document.getElementById('gbi-goals-container');
  if (container.querySelectorAll('.gbi-goal-row').length >= 20) {
    alert('Máximo 20 objetivos.'); return;
  }
  var id    = 'gbi-row-' + Date.now();
  var opts  = Array.from({length: 10}, function(_, i) {
    return '<option value="' + (i+1) + '"' + (i+9 ? '' : ' selected') + '>' + (i+1) + '</option>';
  }).join('');
  var div = document.createElement('div');
  div.id        = id;
  div.className = 'gbi-goal-row';
  div.style.cssText = 'display:grid;grid-template-columns:1fr 140px 110px 140px 36px;' +
                      'gap:8px;margin-bottom:8px;align-items:center;';
  div.innerHTML =
    '<input class="gbi-nombre" type="text" placeholder="Ej: Retiro viaje" ' +
      'style="padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;' +
             'width:100%;box-sizing:border-box;font-family:Inter,sans-serif;">' +
    '<input class="gbi-monto" type="number" placeholder="Ej: 50000" min="1" ' +
      'style="padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;' +
             'width:100%;box-sizing:border-box;font-family:Inter,sans-serif;">' +
    '<select class="gbi-plazo" ' +
      'style="padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;' +
             'width:100%;box-sizing:border-box;font-family:Inter,sans-serif;">' + opts + '</select>' +
    '<div style="display:flex;align-items:center;gap:4px;">' +
      '<input class="gbi-ck" type="number" value="10" min="1" max="100" step="1" ' +
        'style="padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;' +
               'width:65px;box-sizing:border-box;font-family:Inter,sans-serif;">' +
      '<span style="font-size:12px;color:#6b7280;">% prob. fracaso</span>' +
    '</div>' +
    '<button onclick="document.getElementById(\'' + id + '\').remove();" ' +
      'style="padding:4px 8px;background:#fee2e2;border:1px solid #fca5a5;' +
             'border-radius:6px;cursor:pointer;font-size:14px;color:#991b1b;line-height:1;">×</button>';
  container.appendChild(div);
}

// ── Optimización ──────────────────────────────────────────────────────────────

function gbiRunOptimization() {
  var rt = document.getElementById('returnType').value;
  var md = rt === 'real' ? marketDataReal : marketDataNominal;
  if (!md || md.length === 0) { alert('Datos aún no cargados.'); return; }
  window._gbiMarketData = md;

  var W0 = parseFloat(document.getElementById('initialValue').value);
  if (isNaN(W0) || W0 <= 0) { alert('Ingresá un patrimonio inicial válido.'); return; }

  var rows = document.querySelectorAll('.gbi-goal-row');
  if (rows.length === 0) { alert('Agregá al menos un objetivo.'); return; }

  var goals = [];
  var plazosUsados = {};
  for (var ri = 0; ri < rows.length; ri++) {
    var row    = rows[ri];
    var nombre = row.querySelector('.gbi-nombre').value.trim() || 'Objetivo ' + (ri+1);
    var monto  = parseFloat(row.querySelector('.gbi-monto').value);
    var plazo  = parseInt(row.querySelector('.gbi-plazo').value);
    var ck     = parseFloat(row.querySelector('.gbi-ck').value) / 100;

    if (isNaN(monto) || monto <= 0) { alert('El monto de "' + nombre + '" debe ser positivo.'); return; }
    if (plazo < 1 || plazo > 10)    { alert('El plazo debe estar entre 1 y 10 años.'); return; }
    if (plazosUsados[plazo])        { alert('Hay dos objetivos con el mismo plazo (' + plazo + ' años).'); return; }
    if (isNaN(ck) || ck <= 0)       { alert('La tolerancia de "' + nombre + '" debe ser > 0.'); return; }
    plazosUsados[plazo] = true;
    goals.push({ nombre: nombre, Gk: monto, Tk: plazo, ck: ck });
  }
  goals.sort(function(a, b) { return a.Tk - b.Tk; });

  var sigmaTarget = parseFloat(document.getElementById('gbi-sigma-slider').value) / 100;

  // UI state
  document.getElementById('gbi-error').style.display   = 'none';
  document.getElementById('gbi-results').style.display = 'none';
  _gbiShowProgress(true);
  document.getElementById('gbi-optimize-btn').disabled = true;

  // Start worker
  if (_gbiWorker) _gbiWorker.terminate();
  _gbiWorker = new Worker('goalWorker.js');

  _gbiWorker.onmessage = function(e) {
    var d = e.data;
    if (d.type === 'progress') {
      document.getElementById('gbi-progress-label').textContent = d.stage;
      document.getElementById('gbi-progress-bar').style.width   = d.pct + '%';
    } else if (d.type === 'result') {
      _gbiShowProgress(false);
      document.getElementById('gbi-optimize-btn').disabled = false;
      _gbiOnResult(d, W0);
    } else if (d.type === 'error') {
      _gbiShowProgress(false);
      document.getElementById('gbi-optimize-btn').disabled = false;
      var el = document.getElementById('gbi-error');
      el.textContent  = d.message;
      el.style.display = 'block';
    }
  };
  _gbiWorker.onerror = function(e) {
    _gbiShowProgress(false);
    document.getElementById('gbi-optimize-btn').disabled = false;
    var el = document.getElementById('gbi-error');
    el.textContent  = 'Error en el worker: ' + e.message;
    el.style.display = 'block';
  };

  _gbiWorker.postMessage({
    marketData:  md,
    goals:       goals,
    W0:          W0,
    sigmaTarget: sigmaTarget
  });
}

function _gbiShowProgress(show) {
  document.getElementById('gbi-progress').style.display = show ? 'flex' : 'none';
  if (show) {
    document.getElementById('gbi-progress-bar').style.width  = '0%';
    document.getElementById('gbi-progress-label').textContent = 'Iniciando...';
  }
}

// ── Manejo del resultado ──────────────────────────────────────────────────────

function _gbiOnResult(data, W0) {
  _gbiLastResult = data;
  _gbiLastResult._W0 = W0;

  _gbiRenderCapitalSummary(data, W0);
  _gbiRenderGoalCards(data.goalResults, W0);
  _gbiRenderGrowthCard(data.growthResult, data.AG, W0);
  _gbiRenderConsolidated(data, W0);
  gbiRenderHistoricalChart();

  // Update sidebar sliders
  _gbiActualizarSliders(data.consolidatedWeights, data.assets);

  document.getElementById('gbi-results').style.display = 'block';
  document.getElementById('gbi-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Capital summary ───────────────────────────────────────────────────────────

function _gbiRenderCapitalSummary(data, W0) {
  var el  = document.getElementById('gbi-capital-summary');
  var pct = function(v) { return (v / W0 * 100).toFixed(1) + '%'; };
  var usd = function(v) { return '$' + Math.round(v).toLocaleString(); };

  var html = '';
  data.goalResults.forEach(function(g) {
    html +=
      '<div class="stat-box" style="min-width:110px;">' +
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">' + g.nombre + '</div>' +
        '<div style="font-size:18px;font-weight:600;color:#166534;">' + usd(g.Ak) + '</div>' +
        '<div style="font-size:11px;color:#888;margin-top:2px;">' + pct(g.Ak) + ' del patrimonio</div>' +
      '</div>';
  });

  if (data.AG > 0) {
    html +=
      '<div class="stat-box" style="min-width:110px;">' +
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">Growth Portfolio</div>' +
        '<div style="font-size:18px;font-weight:600;color:#456db8;">' + usd(data.AG) + '</div>' +
        '<div style="font-size:11px;color:#888;margin-top:2px;">' + pct(data.AG) + ' del patrimonio</div>' +
      '</div>';
  }

  el.innerHTML = html;

  // Sigma warning
  var sw = document.getElementById('gbi-sigma-warning');
  if (data.growthResult && data.growthResult.sigmaAdj) {
    sw.textContent  = '⚠ ' + data.growthResult.sigmaAdj;
    sw.style.display = 'block';
  } else {
    sw.style.display = 'none';
  }
}

// ── Asset allocation bars ─────────────────────────────────────────────────────

function _gbiAssetBars(weights) {
  var entries = Object.keys(weights)
    .filter(function(a) { return weights[a] > 0.005; })
    .sort(function(a, b) { return weights[b] - weights[a]; });
  if (entries.length === 0) return '<em style="font-size:12px;color:#9ca3af;">—</em>';

  var html = '<div style="display:flex;flex-direction:column;gap:5px;max-width:460px;">';
  entries.forEach(function(a) {
    var pct   = weights[a] * 100;
    var barW  = Math.round(pct * 3.5);
    var color = _ASSET_COLORS[a] || '#888';
    var label = a.replace('Global ', '').replace('Acciones ', 'Acc. ');
    html +=
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div style="width:150px;font-size:12px;color:#555;flex-shrink:0;text-align:right;">' + label + '</div>' +
        '<div style="width:' + barW + 'px;height:13px;background:' + color + ';border-radius:3px;min-width:2px;flex-shrink:0;"></div>' +
        '<span style="font-size:12px;color:#374151;font-weight:500;">' + pct.toFixed(1) + '%</span>' +
      '</div>';
  });
  return html + '</div>';
}

// ── Goal Portfolio cards ──────────────────────────────────────────────────────

function _gbiRenderGoalCards(goalResults, W0) {
  var container = document.getElementById('gbi-goal-cards');
  container.innerHTML = '';

  goalResults.forEach(function(g, k) {
    var pkPct  = (g.Pk * 100).toFixed(1);
    var pkColor = g.Pk >= 0.90 ? '#166534' : g.Pk >= 0.75 ? '#854d0e' : '#991b1b';
    var pkBg    = g.Pk >= 0.90 ? '#f0fdf4' : g.Pk >= 0.75 ? '#fefce8' : '#fef2f2';
    var pkIcon  = g.Pk >= 0.90 ? '✓' : g.Pk >= 0.75 ? '~' : '✗';

    var div = document.createElement('div');
    div.style.cssText =
      'padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:' + pkBg + ';';

    div.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:8px;">' +
        '<div>' +
          '<div style="font-size:15px;font-weight:600;color:#111;">' + g.nombre + '</div>' +
          '<div style="font-size:12px;color:#6b7280;margin-top:2px;">' +
            'Meta: $' + Math.round(g.Gk).toLocaleString() + ' · Plazo: ' + g.Tk + ' años · ' +
            'Prob. fracaso aceptada: ' + (g.ck * 100).toFixed(0) + '%' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:24px;font-weight:700;color:' + pkColor + ';">' + pkIcon + ' ' + pkPct + '%</div>' +
          '<div style="font-size:11px;color:#888;">prob. de alcanzar la meta</div>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:20px;margin-bottom:14px;flex-wrap:wrap;">' +
        _gbiStatChip('Capital asignado', '$' + Math.round(g.Ak).toLocaleString() + ' (' + (g.Ak/W0*100).toFixed(1) + '%)') +
        _gbiStatChip('CVaR 95% del shortfall', '$' + Math.round(g.cvar).toLocaleString() + ' (' + (g.cvar/g.Gk*100).toFixed(1) + '% meta)') +
        _gbiStatChip('Retorno esperado', (g.retAnual*100 >= 0 ? '+' : '') + (g.retAnual*100).toFixed(2) + '% anual') +
        _gbiStatChip('Volatilidad', (g.volAnual*100).toFixed(2) + '% anual') +
      '</div>' +

      '<div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600;">Composición</div>' +
      _gbiAssetBars(g.weights);

    container.appendChild(div);
  });
}

function _gbiStatChip(label, value) {
  return '<div>' +
    '<div style="font-size:11px;color:#6b7280;">' + label + '</div>' +
    '<div style="font-size:13px;font-weight:600;color:#111;">' + value + '</div>' +
  '</div>';
}

// ── Growth Portfolio card ─────────────────────────────────────────────────────

function _gbiRenderGrowthCard(growthResult, AG, W0) {
  var card = document.getElementById('gbi-growth-card');
  if (!growthResult || AG <= 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  var content = document.getElementById('gbi-growth-content');
  content.innerHTML =
    '<div style="display:flex;gap:20px;margin-bottom:14px;flex-wrap:wrap;">' +
      _gbiStatChip('Capital asignado', '$' + Math.round(AG).toLocaleString() + ' (' + (AG/W0*100).toFixed(1) + '%)') +
      _gbiStatChip('Retorno esperado', (growthResult.ret*100 >= 0 ? '+' : '') + (growthResult.ret*100).toFixed(2) + '% anual') +
      _gbiStatChip('Volatilidad', (growthResult.vol*100).toFixed(2) + '% anual') +
    '</div>' +
    '<div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600;">Composición</div>' +
    _gbiAssetBars(growthResult.weights);
}

// ── Consolidated ──────────────────────────────────────────────────────────────

function _gbiRenderConsolidated(data, W0) {
  var el = document.getElementById('gbi-consolidated-content');

  var jointPct = (data.jointProb * 100).toFixed(1);
  var jColor   = data.jointProb >= 0.80 ? '#166534' : data.jointProb >= 0.60 ? '#854d0e' : '#991b1b';

  el.innerHTML =
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
      '<div class="stat-box">' +
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">P(todos los objetivos)</div>' +
        '<div style="font-size:22px;font-weight:700;color:' + jColor + ';">' + jointPct + '%</div>' +
        '<div style="font-size:11px;color:#888;">prob. conjunta</div>' +
      '</div>' +
      '<div class="stat-box">' +
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">Retorno esperado</div>' +
        '<div style="font-size:18px;font-weight:600;color:#111;">' +
          (data.consoStats.retAnual*100 >= 0 ? '+' : '') + (data.consoStats.retAnual*100).toFixed(2) + '%' +
        '</div>' +
        '<div style="font-size:11px;color:#888;">anualizado</div>' +
      '</div>' +
      '<div class="stat-box">' +
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">Volatilidad</div>' +
        '<div style="font-size:18px;font-weight:600;color:#111;">' +
          (data.consoStats.volAnual*100).toFixed(2) + '%' +
        '</div>' +
        '<div style="font-size:11px;color:#888;">anualizada</div>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600;">Composición consolidada (ponderada por capital)</div>' +
    _gbiAssetBars(data.consolidatedWeights);
}

// ── Wealth chart ──────────────────────────────────────────────────────────────

// ── Historical simulations chart ──────────────────────────────────────────────

function _gbiFormatSeriesFecha(marketData) {
  // Returns array of {fecha, returns[n]} objects sorted chronologically
  // Returns: { dates: Date[], R: Float64Array[T], assets: string[], n }
  if (!marketData || marketData.length < 2) return null;
  var keys = Object.keys(marketData[0]).filter(function(k) { return k !== 'Fecha' && k !== 'Inflacion'; });
  var n = keys.length;
  var rows = [];
  for (var i = 1; i < marketData.length; i++) {
    var prev = marketData[i - 1], cur = marketData[i];
    var ret = new Float64Array(n);
    for (var j = 0; j < n; j++) {
      var p0 = limpiarNumero(prev[keys[j]]), p1 = limpiarNumero(cur[keys[j]]);
      ret[j] = p0 > 0 ? (p1 / p0 - 1) : 0;
    }
    rows.push({ fecha: cur['Fecha'], ret: ret });
  }
  return { rows: rows, assets: keys, n: n };
}

function _gbiSimulateSeries(rows, n, weights, windowMonths, rebalanceMonths) {
  // Simulate one rolling window, return final value (starting from 1)
  var V = 1.0;
  var w = weights.slice(); // copy
  for (var t = 0; t < windowMonths && t < rows.length; t++) {
    var rp = 0;
    for (var j = 0; j < n; j++) rp += w[j] * rows[t].ret[j];
    V *= (1 + rp);
    // Annual rebalancing: every 12 months, reset weights
    if (rebalanceMonths > 0 && (t + 1) % rebalanceMonths === 0) {
      w = weights.slice();
    }
  }
  return V;
}

function _gbiComputeHistoricalSims(marketData, goalResults, AG, growthResult, W0) {
  // Build rolling 10-year windows starting every 6 months
  var parsed = _gbiFormatSeriesFecha(marketData);
  if (!parsed) return null;
  var rows = parsed.rows, assets = parsed.assets, n = parsed.n;
  var windowMonths = 120; // 10 years
  var stepMonths   = 6;

  // Build weight arrays per sub-portfolio + growth
  var portfolios = goalResults.map(function(g) {
    var w = new Float64Array(n);
    assets.forEach(function(a, i) { w[i] = g.xk[i] || 0; });
    return { nombre: g.nombre, Ak: g.Ak, Gk: g.Gk, Tk: g.Tk, w: w };
  });

  var wG = new Float64Array(n);
  if (growthResult) {
    assets.forEach(function(a, i) { wG[i] = growthResult.xk ? growthResult.xk[i] : 0; });
  } else {
    wG.fill(1 / n);
  }

  var windows = [];
  for (var start = 0; start + windowMonths <= rows.length; start += stepMonths) {
    var slice = rows.slice(start, start + windowMonths);
    var startFecha = slice[0].fecha;
    var endFecha   = slice[slice.length - 1].fecha;

    // Simulate consolidated: capital-weighted across all sub-portfolios + growth
    var totalFinal = 0;
    portfolios.forEach(function(p) {
      var mult = _gbiSimulateSeries(slice, n, Array.from(p.w), windowMonths, 12);
      totalFinal += p.Ak * mult;
    });
    if (AG > 0) {
      var multG = _gbiSimulateSeries(slice, n, Array.from(wG), windowMonths, 12);
      totalFinal += AG * multG;
    }

    windows.push({
      startFecha: startFecha,
      endFecha:   endFecha,
      finalValue: totalFinal,
      mult:       totalFinal / W0
    });
  }
  return windows;
}

function _gbiComputeSeriesList(marketData, goalResults, AG, growthResult, W0, rebalanceo) {
  var parsed = _gbiFormatSeriesFecha(marketData);
  if (!parsed) return null;
  var rows = parsed.rows, n = parsed.n;
  var windowMonths = 120, stepMonths = 6;
  var K = goalResults.length;

  // Goals sorted by maturity ascending — cascade follows this order
  var goals = goalResults.slice().sort(function(a, b) { return a.Tk - b.Tk; });

  // Target weights per sub-portfolio
  var subW = goals.map(function(g) {
    var w = new Float64Array(n);
    for (var i = 0; i < n; i++) w[i] = g.xk[i] || 0;
    return w;
  });

  // Pool target weights
  var wPool = new Float64Array(n);
  if (AG > 0 && growthResult && growthResult.xk) {
    for (var i = 0; i < n; i++) wPool[i] = growthResult.xk[i] || 0;
  } else {
    // Capital-weighted average of all goal portfolios
    var sumAk = goals.reduce(function(s, g) { return s + g.Ak; }, 0) || W0;
    goals.forEach(function(g) {
      for (var i = 0; i < n; i++) wPool[i] += (g.xk[i] || 0) * (g.Ak / sumAk);
    });
  }

  var seriesList = [];

  for (var start = 0; start + windowMonths <= rows.length; start += stepMonths) {
    var slice = rows.slice(start, start + windowMonths);

    var subVal  = goals.map(function(g) { return g.Ak; });
    var active  = goals.map(function() { return true; });
    var poolVal = AG;
    var alive   = true;
    var deathMonth = 121; // sentinel: never died

    // Per-asset tracking for annual / sinRebalanceo
    var subAsset = null, poolAsset = null;
    if (rebalanceo !== 'mensual') {
      subAsset = goals.map(function(g) {
        var av = new Float64Array(n);
        for (var j = 0; j < n; j++) av[j] = g.Ak * (g.xk[j] || 0);
        return av;
      });
      poolAsset = new Float64Array(n);
      for (var j = 0; j < n; j++) poolAsset[j] = AG * wPool[j];
    }

    var patrimony      = new Float64Array(121);
    var monthlyReturns = [];
    patrimony[0] = W0;

    for (var t = 0; t < windowMonths; t++) {
      if (!alive) { patrimony[t + 1] = 0; continue; }

      var r = slice[t].ret;

      // ── Apply market returns ──────────────────────────────────────────────
      if (rebalanceo === 'mensual') {
        for (var k = 0; k < K; k++) {
          if (!active[k]) continue;
          var rp = 0;
          for (var j = 0; j < n; j++) rp += subW[k][j] * r[j];
          subVal[k] *= (1 + rp);
        }
        var rpPool = 0;
        for (var j = 0; j < n; j++) rpPool += wPool[j] * r[j];
        poolVal *= (1 + rpPool);
      } else {
        for (var k = 0; k < K; k++) {
          if (!active[k]) continue;
          var sv = 0;
          for (var j = 0; j < n; j++) { subAsset[k][j] *= (1 + r[j]); sv += subAsset[k][j]; }
          subVal[k] = sv;
        }
        var pv = 0;
        for (var j = 0; j < n; j++) { poolAsset[j] *= (1 + r[j]); pv += poolAsset[j]; }
        poolVal = pv;
      }

      // ── Annual rebalancing: reset each sub-portfolio to its target weights ─
      if (rebalanceo === 'anual' && (t + 1) % 12 === 0) {
        for (var k = 0; k < K; k++) {
          if (!active[k] || subVal[k] <= 0) continue;
          for (var j = 0; j < n; j++) subAsset[k][j] = subVal[k] * subW[k][j];
        }
        if (poolVal > 0) for (var j = 0; j < n; j++) poolAsset[j] = poolVal * wPool[j];
      }

      // ── Monthly return computed on pre-withdrawal wealth ──────────────────
      var Wpre = poolVal;
      for (var k = 0; k < K; k++) if (active[k]) Wpre += subVal[k];
      monthlyReturns.push(patrimony[t] > 1e-10 ? (Wpre / patrimony[t] - 1) : 0);

      // ── Goal events: retire sub-portfolio, surplus/deficit → pool ─────────
      for (var k = 0; k < K; k++) {
        if (!active[k] || t + 1 !== goals[k].Tk * 12) continue;

        var surplus = subVal[k] - goals[k].Gk;
        active[k] = false; subVal[k] = 0;
        if (subAsset) subAsset[k].fill(0);
        poolVal += surplus; // surplus > 0 → pool grows; surplus < 0 → pool shrinks

        // Cascade if pool went negative
        if (poolVal < 0) {
          for (var k2 = 0; k2 < K; k2++) {
            if (!active[k2]) continue;
            var oldSV = subVal[k2];
            subVal[k2] += poolVal; // poolVal negative → reduces sub-portfolio
            if (subVal[k2] >= 0) {
              // Deficit fully absorbed: scale down assets proportionally
              if (subAsset && oldSV > 0) {
                var f = subVal[k2] / oldSV;
                for (var j = 0; j < n; j++) subAsset[k2][j] *= f;
              }
              poolVal = 0; break;
            } else {
              // Sub-portfolio depleted: carry remaining deficit to next
              poolVal = subVal[k2]; subVal[k2] = 0;
              if (subAsset) subAsset[k2].fill(0);
            }
          }
          // If deficit persists after exhausting all sub-portfolios: series dies
          if (poolVal < 0) { alive = false; deathMonth = t + 1; poolVal = 0; }
        }
        // Re-sync pool asset allocation after the event
        if (subAsset) for (var j = 0; j < n; j++) poolAsset[j] = poolVal * wPool[j];
      }

      // ── Post-event wealth ─────────────────────────────────────────────────
      if (!alive) {
        patrimony[t + 1] = 0;
      } else {
        var Wpost = poolVal;
        for (var k = 0; k < K; k++) if (active[k]) Wpost += subVal[k];
        if (Wpost <= 0) { alive = false; deathMonth = t + 1; Wpost = 0; }
        patrimony[t + 1] = Wpost;
      }
    }

    // ── CAGR and annualized sample volatility ─────────────────────────────
    var T = monthlyReturns.length;
    var cagr = 0, vol = 0;
    if (T > 0) {
      var cum = 1;
      for (var i = 0; i < T; i++) cum *= (1 + monthlyReturns[i]);
      cagr = Math.pow(Math.max(cum, 0), 12 / T) - 1;
    }
    if (T > 1) {
      var meanR = monthlyReturns.reduce(function(s, v) { return s + v; }, 0) / T;
      var vari  = monthlyReturns.reduce(function(s, v) { return s + Math.pow(v - meanR, 2); }, 0) / (T - 1);
      vol = Math.sqrt(vari) * Math.sqrt(12);
    }

    seriesList.push({
      startLabel: slice[0].fecha,
      patrimony:  patrimony,
      finalValue: patrimony[120],
      mult:       patrimony[120] / W0,
      alive:      alive,
      deathMonth: deathMonth,
      cagr:       cagr,
      vol:        vol,
      // goalsMet[k] = true if series survived past goal k's maturity month
      goalsMet:   goals.map(function(g) { return deathMonth > g.Tk * 12; })
    });
  }
  return { seriesList: seriesList, goals: goals };
}

function gbiRenderHistoricalChart() {
  if (!_gbiLastResult) return;
  var data = _gbiLastResult;
  var W0   = data._W0;

  if (_gbiHistoricalChart) { _gbiHistoricalChart.destroy(); _gbiHistoricalChart = null; }
  var ctx = document.getElementById('gbi-historical-chart');
  if (!ctx) return;

  var _rt = document.getElementById('returnType');
  var marketData  = window._gbiMarketData || (_rt && _rt.value === 'real' ? marketDataReal : marketDataNominal);
  var rebalanceo  = (document.getElementById('rebalanceo') || {}).value || 'mensual';

  var result = _gbiComputeSeriesList(
    marketData, data.goalResults, data.AG, data.growthResult, W0, rebalanceo
  );
  if (!result || result.seriesList.length === 0) return;

  var seriesList  = result.seriesList;
  var goalsSorted = result.goals; // sorted by Tk, aligns with goalsMet[]

  // X-axis: months 0..120, label text only every 12 months
  var labels = [];
  for (var m = 0; m <= 120; m++) labels.push(m % 12 === 0 ? 'Año ' + (m / 12) : '');

  // Best and worst by CAGR
  var bestIdx = 0, worstIdx = 0;
  for (var s = 0; s < seriesList.length; s++) {
    if (seriesList[s].cagr > seriesList[bestIdx].cagr)  bestIdx  = s;
    if (seriesList[s].cagr < seriesList[worstIdx].cagr) worstIdx = s;
  }

  // Goal vertical lines (only goals with Tk <= 10)
  var goalsInWindow = goalsSorted.filter(function(g) { return g.Tk <= 10; });

  // Build one dataset per simulation
  var datasets = [];
  for (var s2 = 0; s2 < seriesList.length; s2++) {
    var isBest  = (s2 === bestIdx);
    var isWorst = (s2 === worstIdx);

    var pts = new Array(121);
    for (var m2 = 0; m2 <= 120; m2++) {
      pts[m2] = (!seriesList[s2].alive && m2 > seriesList[s2].deathMonth)
        ? null
        : seriesList[s2].patrimony[m2];
    }

    var color, lineWidth, zOrder, label;
    if (isBest) {
      color = '#14532d'; lineWidth = 2.5; zOrder = 10;
      label = '▲ Mejor (' + seriesList[s2].startLabel + ')';
    } else if (isWorst) {
      color = '#7f1d1d'; lineWidth = 2.5; zOrder = 9;
      label = '▼ Peor (' + seriesList[s2].startLabel + ')';
    } else {
      color = 'rgba(156,163,175,0.4)'; lineWidth = 1; zOrder = 1;
      label = seriesList[s2].startLabel;
    }

    datasets.push({
      label: label, data: pts,
      borderColor: color, borderWidth: lineWidth,
      fill: false, pointRadius: 0, tension: 0.2, spanGaps: false, order: zOrder
    });
  }

  // Vertical dashed lines at each goal's maturity
  var goalLinesPlugin = {
    id: 'gbiHistGoalLines',
    afterDraw: function(chart) {
      var c = chart.ctx, ca = chart.chartArea, sc = chart.scales;
      if (!ca) return;
      c.save();
      goalsInWindow.forEach(function(g) {
        var x = sc.x.getPixelForValue(g.Tk * 12);
        c.setLineDash([5, 4]);
        c.strokeStyle = 'rgba(220,38,38,0.55)';
        c.lineWidth   = 1.5;
        c.beginPath(); c.moveTo(x, ca.top); c.lineTo(x, ca.bottom); c.stroke();
        c.setLineDash([]);
        c.fillStyle = 'rgba(220,38,38,0.8)';
        c.font      = '11px Inter,sans-serif';
        c.textAlign = 'center';
        c.fillText(g.nombre, x, ca.top + 13);
      });
      c.restore();
    }
  };

  _gbiHistoricalChart = new Chart(ctx, {
    type: 'line',
    plugins: [goalLinesPlugin],
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            usePointStyle: true, pointStyle: 'circle',
            filter: function(item) {
              return item.text.indexOf('▲') === 0 || item.text.indexOf('▼') === 0;
            }
          }
        },
        tooltip: {
          filter: function(item) { return item.dataset.order >= 9; },
          callbacks: {
            label: function(c) {
              if (c.raw === null || c.raw === undefined) return null;
              return c.dataset.label + ': $' + Math.round(c.raw).toLocaleString();
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#666', maxRotation: 0, autoSkip: false,
            callback: function(val, index) { return index % 12 === 0 ? 'Año ' + (index / 12) : ''; }
          },
          grid: { display: false }
        },
        y: {
          ticks: { callback: function(v) { return '$' + Math.round(v).toLocaleString(); }, color: '#666' },
          grid:  { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });

  _gbiRenderHistoricalSummary(seriesList, goalsSorted, W0);
}

function _gbiRenderHistoricalSummary(seriesList, goals, W0) {
  var el = document.getElementById('gbi-historical-summary');
  if (!el || !seriesList || seriesList.length === 0) return;

  var N = seriesList.length;
  var sumCagr = 0, sumVol = 0;
  var bestCagr = -Infinity, worstCagr = Infinity;
  var bestCagrLabel = '', worstCagrLabel = '';
  var bestFinal = -Infinity, worstFinal = Infinity;
  var bestFinalLabel = '', worstFinalLabel = '';

  seriesList.forEach(function(s) {
    sumCagr += s.cagr; sumVol += s.vol;
    if (s.cagr > bestCagr)         { bestCagr  = s.cagr;       bestCagrLabel  = s.startLabel; }
    if (s.cagr < worstCagr)        { worstCagr = s.cagr;       worstCagrLabel = s.startLabel; }
    if (s.finalValue > bestFinal)  { bestFinal  = s.finalValue; bestFinalLabel  = s.startLabel; }
    if (s.finalValue < worstFinal) { worstFinal = s.finalValue; worstFinalLabel = s.startLabel; }
  });

  var pct = function(v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'; };
  var usd = function(v) { return '$' + Math.round(v).toLocaleString(); };
  var clr = function(v, ok) { return v >= ok ? '#166534' : '#991b1b'; };

  var cards = [
    { label: 'Simulaciones',         value: N,                       color: null,          sub: null },
    { label: 'CAGR promedio',        value: pct(sumCagr / N),        color: clr(sumCagr / N, 0), sub: null },
    { label: 'Volatilidad promedio', value: pct(sumVol / N),         color: null,          sub: null },
    { label: 'Mejor CAGR',          value: pct(bestCagr),           color: '#166534',     sub: bestCagrLabel },
    { label: 'Peor CAGR',           value: pct(worstCagr),          color: '#991b1b',     sub: worstCagrLabel },
    { label: 'Mejor valor final',   value: usd(bestFinal),          color: '#166534',     sub: bestFinalLabel },
    { label: 'Peor valor final',    value: usd(worstFinal),         color: '#991b1b',     sub: worstFinalLabel }
  ];

  var html = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">';
  cards.forEach(function(c) {
    html += '<div style="background:#f8f9fa;border-radius:8px;padding:10px 14px;min-width:110px;">';
    html += '<div style="font-size:11px;color:#888;margin-bottom:3px;">' + c.label + '</div>';
    html += '<div style="font-size:16px;font-weight:700;' + (c.color ? 'color:' + c.color + ';' : '') + '">' + c.value + '</div>';
    if (c.sub) html += '<div style="font-size:11px;color:#666;margin-top:2px;">' + c.sub + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Goals table: show how many simulations each goal was NOT met
  if (goals && goals.length > 0) {
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:2px solid #e5e7eb;">' +
      '<th style="text-align:left;padding:6px 8px;color:#888;">Objetivo</th>' +
      '<th style="text-align:center;padding:6px 8px;color:#888;">No cumplido</th>' +
      '<th style="text-align:left;padding:6px 8px;color:#888;">Inicio de simulaciones fallidas</th>' +
      '</tr></thead><tbody>';

    goals.forEach(function(g, ki) {
      var failed = seriesList.filter(function(s) { return !s.goalsMet[ki]; });
      var rowBg  = failed.length > 0 ? 'background:#fef2f2;' : '';
      var countColor = failed.length > 0 ? '#991b1b' : '#166534';
      var failLabels = failed.length > 0
        ? failed.map(function(s) { return s.startLabel; }).join(', ')
        : '—';
      html += '<tr style="border-bottom:1px solid #f3f4f6;' + rowBg + '">' +
        '<td style="padding:6px 8px;">' + g.nombre + ' — Año ' + g.Tk + ' ($' + Math.round(g.Gk).toLocaleString() + ')</td>' +
        '<td style="text-align:center;padding:6px 8px;font-weight:700;color:' + countColor + ';">' + failed.length + ' / ' + N + '</td>' +
        '<td style="padding:6px 8px;color:#555;font-size:12px;">' + failLabels + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }

  el.innerHTML = html;
}

// ── Update sidebar sliders ────────────────────────────────────────────────────

function _gbiActualizarSliders(consolidatedWeights, assets) {
  // Round to integers that sum to 100
  var assetNames = Object.keys(slidersMap);
  var rounded = {}, total = 0;
  assetNames.forEach(function(a) {
    var pct = Math.round((consolidatedWeights[a] || 0) * 100);
    rounded[a] = pct;
    total += pct;
  });
  var diff = 100 - total;
  if (diff !== 0) {
    var largest = assetNames.reduce(function(best, a) {
      return rounded[a] > rounded[best] ? a : best;
    }, assetNames[0]);
    rounded[largest] += diff;
  }
  assetNames.forEach(function(a) {
    var slider  = slidersMap[a];
    slider.value = rounded[a];
    var display = slider.nextElementSibling;
    if (display) display.textContent = rounded[a] + '%';
  });
  updateTotal();
  updateAllocationChart();
  if (typeof graficarComposicion === 'function') {
    graficarComposicion(document.getElementById('composicionSelector').value);
  }
  if (typeof actualizarPuntoPortafolio === 'function') actualizarPuntoPortafolio();
}
