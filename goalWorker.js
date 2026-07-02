'use strict';

importScripts('goalOptimizer.js', 'portfolioOptimizer.js');

onmessage = function(e) {
  var msg = e.data;

  // ── Info request: MVP vol for sigma slider ────────────────────────────────
  if (msg.type === 'getInfo') {
    try {
      var info = calcularVolMVP(msg.marketData);
      postMessage({ type: 'info', vol_mvp: info.vol_mvp, vol_max: info.vol_max });
    } catch (err) {
      postMessage({ type: 'info', vol_mvp: 0.04, vol_max: 0.20 });
    }
    return;
  }

  // ── Main optimization ─────────────────────────────────────────────────────
  try {
    var marketData  = msg.marketData;
    var goals       = msg.goals;       // [{nombre, Gk, Tk, ck}, ...]
    var W0          = msg.W0;
    var sigmaTarget = msg.sigmaTarget; // annual vol target for growth portfolio

    var K    = goals.length;
    var Tmax = 0;
    for (var k0 = 0; k0 < K; k0++) Tmax = Math.max(Tmax, goals[k0].Tk * 12);

    // Step 1: build return matrix
    var built  = buildReturnMatrix(marketData);
    var R      = built.R;
    var T_rows = built.T_rows;
    var n      = built.n;
    var assets = built.assets;

    postMessage({ type: 'progress', stage: 'Generando escenarios...', pct: 3 });

    // Step 2: generate scenarios — 1000 for optimization, 5000 for evaluation
    var scenariosOpt = generarScenarios(R, T_rows, n, 1000, Tmax);
    var scenariosFin = generarScenarios(R, T_rows, n, 5000, Tmax);

    postMessage({ type: 'progress', stage: 'Escenarios listos', pct: 8 });

    // Step 3: optimize each goal portfolio
    var goalResults = [];
    var pctPerGoal  = 55 / Math.max(K, 1);

    for (var k = 0; k < K; k++) {
      var g = goals[k];
      postMessage({
        type: 'progress',
        stage: 'Optimizando objetivo ' + (k + 1) + ' de ' + K + ': ' + g.nombre,
        pct: Math.round(8 + k * pctPerGoal)
      });

      var opt = optimizarObjetivo(scenariosOpt, 1000, n, Tmax, g.Tk * 12, g.Gk, g.ck, {
        alpha: 0.95, bisecIter: 20, innerIter: 80
      });

      // Final evaluation on 5000 scenarios
      var Pk    = computeTerminalProbability(scenariosFin, 5000, n, Tmax, opt.Ak, opt.xk, g.Tk * 12, g.Gk);
      var cvar5 = computeCVaR(scenariosFin, 5000, n, Tmax, opt.Ak, opt.xk, g.Tk * 12, g.Gk, 0.95);
      var stats = computePortfolioStats(R, T_rows, n, opt.xk);

      var weights = {};
      assets.forEach(function(a, i) { if (opt.xk[i] > 0.005) weights[a] = opt.xk[i]; });

      goalResults.push({
        nombre:    g.nombre,
        Gk:        g.Gk,
        Tk:        g.Tk,
        ck:        g.ck,
        Ak:        opt.Ak,
        xk:        opt.xk,
        weights:   weights,
        Pk:        Pk,
        cvar:      cvar5,
        retAnual:  stats.retAnual,
        volAnual:  stats.volAnual
      });
    }

    postMessage({ type: 'progress', stage: 'Chequeando factibilidad...', pct: 65 });

    // Step 4: check capital constraint
    var AGoals = 0;
    for (var k2 = 0; k2 < K; k2++) AGoals += goalResults[k2].Ak;

    if (AGoals > W0 * 1.0001) {
      postMessage({
        type: 'error',
        message: 'El capital requerido para los objetivos ($' +
          Math.round(AGoals).toLocaleString() +
          ') supera el patrimonio disponible ($' +
          Math.round(W0).toLocaleString() +
          '). Reducí los objetivos o aumentá la tolerancia de riesgo.'
      });
      return;
    }

    var AG = Math.max(0, W0 - AGoals);

    // Step 5: growth portfolio
    postMessage({ type: 'progress', stage: 'Optimizando Growth Portfolio...', pct: 68 });

    var growthResult = null;
    var xG           = new Float64Array(n).fill(1 / n); // fallback: equal weight

    if (AG > 0) {
      try {
        var qp = calcularPortafolioMaxRet(marketData, sigmaTarget);
        // Reconstruct xG array aligned with our asset order
        // qp.weights filters out w < 0.005, so normalize to ensure sum = 1
        xG = new Float64Array(n);
        assets.forEach(function(a, i) { xG[i] = qp.weights[a] || 0; });
        var sumXG = 0;
        for (var gi = 0; gi < n; gi++) sumXG += xG[gi];
        if (sumXG > 1e-10) for (var gi2 = 0; gi2 < n; gi2++) xG[gi2] /= sumXG;
        else xG.fill(1 / n);

        var gStats = computePortfolioStats(R, T_rows, n, xG);
        growthResult = {
          weights:  qp.weights,
          xk:       xG,
          ret:      gStats.retAnual,
          vol:      gStats.volAnual,
          vol_qp:   qp.vol,
          sigmaAdj: Math.abs(qp.vol - sigmaTarget) > 0.005
            ? 'La volatilidad mínima alcanzable es ' + (qp.vol * 100).toFixed(1) + '%. Se ajustó automáticamente.'
            : null
        };
      } catch (err) {
        // fallback: equal weight
        var gStats2 = computePortfolioStats(R, T_rows, n, xG);
        var fallWeights = {};
        assets.forEach(function(a, i) { fallWeights[a] = xG[i]; });
        growthResult = { weights: fallWeights, xk: xG, ret: gStats2.retAnual, vol: gStats2.volAnual, vol_qp: gStats2.volAnual, sigmaAdj: null };
      }
    }

    // Step 6: wealth trajectories
    postMessage({ type: 'progress', stage: 'Calculando trayectorias...', pct: 72 });

    var xGForTraj = growthResult ? growthResult.xk : xG;
    var trajectories = buildWealthTrajectories(
      scenariosFin, 5000, n, Tmax, goalResults, AG, growthResult, xGForTraj
    );

    // Step 7: joint probability
    postMessage({ type: 'progress', stage: 'Calculando probabilidad conjunta...', pct: 92 });

    var jointProb = computeJointProbability(scenariosFin, 5000, n, Tmax, goalResults);

    // Step 8: consolidated portfolio weights (capital-weighted)
    var consolidatedWeights = {};
    assets.forEach(function(a) { consolidatedWeights[a] = 0; });
    for (var k3 = 0; k3 < K; k3++) {
      var frac = goalResults[k3].Ak / W0;
      assets.forEach(function(a, i) {
        consolidatedWeights[a] += (goalResults[k3].xk[i] || 0) * frac;
      });
    }
    if (growthResult) {
      var fracG = AG / W0;
      assets.forEach(function(a) {
        consolidatedWeights[a] += (growthResult.weights[a] || 0) * fracG;
      });
    }

    // Analytical consolidated stats
    var xConso = new Float64Array(n);
    assets.forEach(function(a, i) { xConso[i] = consolidatedWeights[a] || 0; });
    var consoStats = computePortfolioStats(R, T_rows, n, xConso);

    postMessage({ type: 'progress', stage: 'Listo', pct: 100 });

    postMessage({
      type:               'result',
      goalResults:        goalResults,
      AGoals:             AGoals,
      AG:                 AG,
      growthResult:       growthResult,
      trajectories:       trajectories,
      jointProb:          jointProb,
      consolidatedWeights: consolidatedWeights,
      consoStats:         consoStats,
      assets:             assets
    });

  } catch (err) {
    postMessage({ type: 'error', message: err.message + '\n' + (err.stack || '') });
  }
};
