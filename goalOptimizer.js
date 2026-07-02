'use strict';

// goalOptimizer.js — pure computation, no DOM, no Chart.js
// Importado por goalWorker.js via importScripts

// ── Return matrix ─────────────────────────────────────────────────────────────

function buildReturnMatrix(marketData) {
  var keys = Object.keys(marketData[0]).filter(function(k) {
    return k !== 'Fecha' && k !== 'Inflacion';
  });
  var n    = keys.length;
  var rows = [];

  for (var t = 1; t < marketData.length; t++) {
    var row   = new Float64Array(n);
    var valid = true;
    for (var i = 0; i < n; i++) {
      var p1 = parseFloat(String(marketData[t][keys[i]]).replace(',', ''));
      var p0 = parseFloat(String(marketData[t - 1][keys[i]]).replace(',', ''));
      if (isNaN(p1) || isNaN(p0) || p0 === 0) { valid = false; break; }
      row[i] = p1 / p0 - 1;
    }
    if (valid) rows.push(row);
  }

  var T_rows = rows.length;
  var R      = new Float64Array(T_rows * n);
  for (var t2 = 0; t2 < T_rows; t2++)
    for (var i2 = 0; i2 < n; i2++)
      R[t2 * n + i2] = rows[t2][i2];

  return { R: R, T_rows: T_rows, n: n, assets: keys };
}

// ── Multi-asset block bootstrap ───────────────────────────────────────────────
// Returns Float64Array[nSim * Tmax * n]

function generarScenarios(R, T_rows, n, nSim, Tmax, p) {
  if (p === undefined) p = 0.083;
  var out = new Float64Array(nSim * Tmax * n);
  for (var s = 0; s < nSim; s++) {
    var idx  = Math.floor(Math.random() * T_rows);
    var base = s * Tmax * n;
    for (var t = 0; t < Tmax; t++) {
      for (var i = 0; i < n; i++)
        out[base + t * n + i] = R[idx * n + i];
      if (Math.random() < p) idx = Math.floor(Math.random() * T_rows);
      else idx = (idx + 1) % T_rows;
    }
  }
  return out;
}

// ── Projection onto probability simplex ──────────────────────────────────────

function projectSimplex(v) {
  var n    = v.length;
  var u    = v.slice().sort(function(a, b) { return b - a; });
  var cssv = 0, rho = 0;
  for (var j = 0; j < n; j++) {
    cssv += u[j];
    if (u[j] - (cssv - 1) / (j + 1) > 0) rho = j;
  }
  var theta = (u.slice(0, rho + 1).reduce(function(a, b) { return a + b; }, 0) - 1) / (rho + 1);
  return v.map(function(vi) { return Math.max(vi - theta, 0); });
}

// ── CVaR: mean of worst (1-alpha) shortfalls ─────────────────────────────────

function evalCVaR(scenarios, nSim, n, Tmax, Ak, xk, Tk, Gk, alpha) {
  var nTail = Math.max(1, Math.round(nSim * (1 - alpha)));
  var Svals = new Float64Array(nSim);
  for (var s = 0; s < nSim; s++) {
    var V    = Ak;
    var base = s * Tmax * n;
    for (var t = 0; t < Tk; t++) {
      var rp = 0;
      for (var j = 0; j < n; j++) rp += xk[j] * scenarios[base + t * n + j];
      V *= (1 + rp);
      if (V < 0) V = 0;
    }
    Svals[s] = Math.max(Gk - V, 0);
  }
  Svals.sort();  // ascending; worst nTail are at the end
  var cvar = 0;
  for (var i = nSim - nTail; i < nSim; i++) cvar += Svals[i];
  return cvar / nTail;
}

// ── Finite-difference gradient of CVaR on the simplex ────────────────────────

function gradFD(scenarios, nSim, n, Tmax, Ak, xk, Tk, Gk, alpha, cvar0) {
  var eps  = 1e-4;
  var grad = new Float64Array(n);
  for (var j = 0; j < n; j++) {
    var xp  = new Float64Array(xk);
    xp[j]  += eps;
    var sum  = 0;
    for (var k = 0; k < n; k++) sum += xp[k];
    for (var k2 = 0; k2 < n; k2++) xp[k2] /= sum;
    grad[j] = (evalCVaR(scenarios, nSim, n, Tmax, Ak, xp, Tk, Gk, alpha) - cvar0) / eps;
  }
  return grad;
}

// ── Inner projected-gradient minimization of CVaR for fixed Ak ───────────────
// Returns { xk: Float64Array[n], cvar }

function minimizarCVaR(scenarios, nSim, n, Tmax, Ak, xk0, Tk, Gk, alpha, maxIter) {
  var xk       = new Float64Array(xk0);
  var cvar0    = evalCVaR(scenarios, nSim, n, Tmax, Ak, xk, Tk, Gk, alpha);
  var best     = new Float64Array(xk);
  var cvarBest = cvar0;
  var lr       = 1e-2;

  for (var iter = 0; iter < maxIter; iter++) {
    var grad = gradFD(scenarios, nSim, n, Tmax, Ak, xk, Tk, Gk, alpha, cvar0);

    // Backtracking line search
    var step     = lr;
    var improved = false;
    for (var bt = 0; bt < 15; bt++) {
      var xTry = new Array(n);
      for (var j = 0; j < n; j++) xTry[j] = xk[j] - step * grad[j];
      var xProj   = projectSimplex(xTry);
      var cvarTry = evalCVaR(scenarios, nSim, n, Tmax, Ak, xProj, Tk, Gk, alpha);
      if (cvarTry < cvar0 - 1e-8) {
        xk       = new Float64Array(xProj);
        cvar0    = cvarTry;
        improved = true;
        lr       = Math.min(lr * 1.2, 1e-2);
        break;
      }
      step *= 0.5;
    }

    if (cvar0 < cvarBest) { cvarBest = cvar0; best = new Float64Array(xk); }
    if (!improved) { lr *= 0.5; if (lr < 1e-6) break; }
  }

  return { xk: best, cvar: cvarBest };
}

// ── Bisection over Ak + inner CVaR minimization ───────────────────────────────
// Returns { Ak, xk }
// Feasibility: P(V(Tk) >= Gk) >= 1 - ck
// Inner loop: minimize CVaR as smooth proxy to find good weights

function optimizarObjetivo(scenarios, nSimOpt, n, Tmax, Tk, Gk, ck, options) {
  options = options || {};
  var alpha     = options.alpha    || 0.95;
  var bisecIter = options.bisecIter || 20;
  var innerIter = options.innerIter || 80;

  var pkMin = 1 - ck;  // required success probability

  // Equal-weight initialization
  var xk0 = new Float64Array(n);
  for (var j = 0; j < n; j++) xk0[j] = 1 / n;

  var lo = 1;        // $1 minimum
  var hi = Gk;       // worst case: commit full target
  var xkWarm = new Float64Array(xk0);
  var bestAk  = hi;
  var bestXk  = new Float64Array(xk0);

  for (var iter = 0; iter < bisecIter; iter++) {
    var mid = (lo + hi) / 2;
    // CVaR minimization finds good weights for this Ak level
    var res = minimizarCVaR(scenarios, nSimOpt, n, Tmax, mid, xkWarm, Tk, Gk, alpha, innerIter);

    // Feasibility check: actual success probability must reach pkMin
    var pk = computeTerminalProbability(scenarios, nSimOpt, n, Tmax, mid, res.xk, Tk, Gk);

    if (pk >= pkMin) {
      hi     = mid;
      bestAk = mid;
      bestXk = new Float64Array(res.xk);
      xkWarm = new Float64Array(res.xk);
    } else {
      lo     = mid;
      xkWarm = new Float64Array(res.xk);
    }
  }

  return { Ak: bestAk, xk: bestXk };
}

// ── Terminal probability (fraction of scenarios where Wk(Tk) >= Gk) ───────────

function computeTerminalProbability(scenarios, nSim, n, Tmax, Ak, xk, Tk, Gk) {
  var hits = 0;
  for (var s = 0; s < nSim; s++) {
    var logV = 0;
    var base = s * Tmax * n;
    for (var t = 0; t < Tk; t++) {
      var rp = 0;
      for (var j = 0; j < n; j++) rp += xk[j] * scenarios[base + t * n + j];
      logV += Math.log(Math.max(1 + rp, 1e-10));
    }
    if (Ak * Math.exp(logV) >= Gk) hits++;
  }
  return hits / nSim;
}

// ── CVaR evaluation (for reporting) — same formula as evalCVaR ───────────────

function computeCVaR(scenarios, nSim, n, Tmax, Ak, xk, Tk, Gk, alpha) {
  return evalCVaR(scenarios, nSim, n, Tmax, Ak, xk, Tk, Gk, alpha);
}

// ── Analytical expected return and vol for a weight vector ────────────────────
// Uses the historical return matrix to compute mu and Sigma

function computePortfolioStats(R, T_rows, n, xk) {
  // Compute mean monthly returns
  var mu = new Float64Array(n);
  for (var t = 0; t < T_rows; t++)
    for (var i = 0; i < n; i++)
      mu[i] += R[t * n + i];
  for (var i2 = 0; i2 < n; i2++) mu[i2] /= T_rows;

  // Portfolio monthly return and vol
  var muP = 0;
  for (var j = 0; j < n; j++) muP += xk[j] * mu[j];

  var varP = 0;
  var mi   = mu;
  for (var t2 = 0; t2 < T_rows; t2++) {
    var rp = 0;
    for (var j2 = 0; j2 < n; j2++) rp += xk[j2] * R[t2 * n + j2];
    var dev = rp - muP;
    varP += dev * dev;
  }
  varP /= (T_rows - 1);

  return {
    retAnual: Math.pow(1 + muP, 12) - 1,
    volAnual: Math.sqrt(varP * 12)
  };
}

// ── Joint probability: fraction of scenarios where ALL goals are met ──────────

function computeJointProbability(scenarios, nSim, n, Tmax, goalResults) {
  var K    = goalResults.length;
  var hits = 0;
  for (var s = 0; s < nSim; s++) {
    var allMet = true;
    for (var k = 0; k < K; k++) {
      var g    = goalResults[k];
      var Tk   = g.Tk * 12;
      var logV = 0;
      var base = s * Tmax * n;
      for (var t = 0; t < Tk; t++) {
        var rp = 0;
        for (var j = 0; j < n; j++) rp += g.xk[j] * scenarios[base + t * n + j];
        logV += Math.log(Math.max(1 + rp, 1e-10));
      }
      if (g.Ak * Math.exp(logV) < g.Gk) { allMet = false; break; }
    }
    if (allMet) hits++;
  }
  return hits / nSim;
}

// ── Wealth trajectories ───────────────────────────────────────────────────────
// Returns { consolidado, subPortfolios, labels }
// consolidado: { p05, mediana, p95 }  — annual sample points 0..Tmax/12
// subPortfolios: [{ nombre, activeUntil (years|null), p05, mediana, p95 }]

function buildWealthTrajectories(scenarios, nSim, n, Tmax, goalResults, AG, growthResult, xG) {
  var K       = goalResults.length;
  var TmaxYrs = Tmax / 12;
  var timePoints = [];
  for (var y = 0; y <= TmaxYrs; y++) timePoints.push(y * 12);
  var nTP = timePoints.length;

  // Paths: use plain arrays to support null (expired portfolios)
  var consoPaths = [];                    // [nSim][nTP]
  var growthSubPaths = AG > 0 ? [] : null; // [nSim][nTP]
  var goalSubPaths = [];                  // [K][nSim][nTP]
  for (var k0 = 0; k0 < K; k0++) goalSubPaths.push([]);

  for (var s = 0; s < nSim; s++) {
    var base      = s * Tmax * n;
    var consoRow  = new Array(nTP);
    var growthRow = AG > 0 ? new Array(nTP) : null;
    var goalRows  = [];
    for (var k1 = 0; k1 < K; k1++) goalRows.push(new Array(nTP));

    // t = 0
    var W0total = AG;
    for (var k2 = 0; k2 < K; k2++) W0total += goalResults[k2].Ak;
    consoRow[0] = W0total;
    if (growthRow) growthRow[0] = AG;
    for (var k3 = 0; k3 < K; k3++) goalRows[k3][0] = goalResults[k3].Ak;

    var logGrowth = 0;
    var logGoals  = new Float64Array(K);
    var tpIdx     = 1;

    for (var t = 0; t < Tmax; t++) {
      var tMonth = t + 1;

      // Growth portfolio return (always accumulate)
      if (AG > 0) {
        var rpG = 0;
        for (var j = 0; j < n; j++) rpG += xG[j] * scenarios[base + t * n + j];
        logGrowth += Math.log(Math.max(1 + rpG, 1e-10));
      }

      // Goal portfolios: always accumulate returns regardless of maturity
      // (logGoals[k] is only read at timepoints before/at maturity)
      for (var k4 = 0; k4 < K; k4++) {
        var rpK = 0;
        for (var j2 = 0; j2 < n; j2++) rpK += goalResults[k4].xk[j2] * scenarios[base + t * n + j2];
        logGoals[k4] += Math.log(Math.max(1 + rpK, 1e-10));
      }

      if (tpIdx < nTP && timePoints[tpIdx] === tMonth) {
        var gVal = AG > 0 ? AG * Math.exp(logGrowth) : 0;
        if (growthRow) growthRow[tpIdx] = gVal;
        var Wtotal = gVal;

        for (var k5 = 0; k5 < K; k5++) {
          var gTkM = goalResults[k5].Tk * 12;
          var kVal5 = goalResults[k5].Ak * Math.exp(logGoals[k5]);
          if (tMonth < gTkM) {
            // Active: include in both consolidated and sub-portfolio
            goalRows[k5][tpIdx] = kVal5;
            Wtotal += kVal5;
          } else if (tMonth === gTkM) {
            // Maturity: show final value in sub-portfolio, but NOT in consolidated
            // Design decision: consolidated drops at t=Tk (portfolios independent)
            goalRows[k5][tpIdx] = kVal5;
            // kVal5 intentionally not added to Wtotal
          } else {
            // Post-maturity: null everywhere
            goalRows[k5][tpIdx] = null;
          }
        }
        consoRow[tpIdx] = Wtotal;
        tpIdx++;
      }
    }

    consoPaths.push(consoRow);
    if (growthSubPaths) growthSubPaths.push(growthRow);
    for (var k6 = 0; k6 < K; k6++) goalSubPaths[k6].push(goalRows[k6]);
  }

  // Percentile helper — handles null values (excluded from percentile calc)
  function perc(paths) {
    var p05 = new Array(nTP), med = new Array(nTP), p95 = new Array(nTP);
    for (var tp = 0; tp < nTP; tp++) {
      var vals = [];
      for (var sv = 0; sv < nSim; sv++) {
        var v = paths[sv][tp];
        if (v !== null && v !== undefined) vals.push(v);
      }
      if (vals.length === 0) { p05[tp] = null; med[tp] = null; p95[tp] = null; continue; }
      vals.sort(function(a, b) { return a - b; });
      var nv = vals.length;
      p05[tp] = vals[Math.floor(0.05 * nv)];
      med[tp] = vals[Math.floor(0.50 * nv)];
      p95[tp] = vals[Math.floor(0.95 * nv)];
    }
    return { p05: p05, mediana: med, p95: p95 };
  }

  var labels = timePoints.map(function(m) { return m / 12; });
  var consoP = perc(consoPaths);

  var subPortfolios = [];
  if (growthSubPaths) {
    var gp = perc(growthSubPaths);
    subPortfolios.push({ nombre: 'Growth Portfolio', activeUntil: null,
      p05: gp.p05, mediana: gp.mediana, p95: gp.p95 });
  }
  for (var k7 = 0; k7 < K; k7++) {
    var kp = perc(goalSubPaths[k7]);
    subPortfolios.push({ nombre: goalResults[k7].nombre, activeUntil: goalResults[k7].Tk,
      p05: kp.p05, mediana: kp.mediana, p95: kp.p95 });
  }

  return {
    consolidado:   { p05: consoP.p05, mediana: consoP.mediana, p95: consoP.p95 },
    subPortfolios: subPortfolios,
    labels:        labels
  };
}
