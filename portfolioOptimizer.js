// portfolioOptimizer.js — pure calculation, no DOM, no Chart.js
// Runs in Web Worker via importScripts

(function () {

  // ── Helpers ────────────────────────────────────────────────────────────────

  function mean(arr) {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function matVec(M, v) {
    return M.map(row => dot(row, v));
  }

  function vecScale(v, s) {
    return v.map(x => x * s);
  }

  function vecAdd(a, b) {
    return a.map((x, i) => x + b[i]);
  }

  function vecSub(a, b) {
    return a.map((x, i) => x - b[i]);
  }

  function norm(v) {
    return Math.sqrt(dot(v, v));
  }

  // ── Build returns matrix ───────────────────────────────────────────────────

  function buildReturns(marketData) {
    const keys = Object.keys(marketData[0]).filter(k => k !== 'Fecha' && k !== 'Inflacion');
    const n = keys.length;
    const T = marketData.length - 1;

    // returns[i][t] = return of asset i at time t
    const returns = Array.from({ length: n }, () => new Array(T));

    for (let t = 0; t < T; t++) {
      for (let i = 0; i < n; i++) {
        const p1 = parseFloat(String(marketData[t + 1][keys[i]]).replace(',', ''));
        const p0 = parseFloat(String(marketData[t][keys[i]]).replace(',', ''));
        returns[i][t] = (p1 / p0) - 1;
      }
    }

    return { returns, assets: keys, T };
  }

  // ── mu and Sigma ──────────────────────────────────────────────────────────

  function calcMuSigma(returns, T, n) {
    const mu = returns.map(r => mean(r) * 12);

    const Sigma = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      const mi = mean(returns[i]);
      for (let j = i; j < n; j++) {
        const mj = mean(returns[j]);
        let cov = 0;
        for (let t = 0; t < T; t++) {
          cov += (returns[i][t] - mi) * (returns[j][t] - mj);
        }
        cov = (cov / (T - 1)) * 12;
        Sigma[i][j] = cov;
        Sigma[j][i] = cov;
      }
    }

    // Regularise if ill-conditioned (simple diagonal check)
    let maxDiag = 0, minDiag = Infinity;
    for (let i = 0; i < n; i++) {
      maxDiag = Math.max(maxDiag, Sigma[i][i]);
      minDiag = Math.min(minDiag, Sigma[i][i]);
    }
    if (minDiag <= 0 || maxDiag / minDiag > 1e10) {
      for (let i = 0; i < n; i++) Sigma[i][i] += 1e-8;
    }

    return { mu, Sigma };
  }

  // ── Projected Gradient QP Solver ─────────────────────────────────────────
  //
  // min  (1/2) x' Q x + c' x
  // s.t. Aeq x = beq,  lb <= x <= ub
  //
  // Uses projected gradient with Armijo line search.

  function projectBox(x, lb, ub) {
    return x.map((xi, i) => Math.max(lb[i], Math.min(ub[i], xi)));
  }

  // Project onto Aeq x = beq using alternating projections (~20 iters)
  function projectFeasible(x0, lb, ub, Aeq, beq, iters) {
    iters = iters || 20;
    let x = x0.slice();
    const m = Aeq.length;
    const n = x.length;

    for (let iter = 0; iter < iters; iter++) {
      // Project onto each equality constraint
      for (let k = 0; k < m; k++) {
        const row = Aeq[k];
        const rowNormSq = dot(row, row);
        if (rowNormSq < 1e-14) continue;
        const residual = dot(row, x) - beq[k];
        const step = residual / rowNormSq;
        x = vecSub(x, vecScale(row, step));
      }
      // Project onto box
      x = projectBox(x, lb, ub);
    }

    // Final equality correction
    for (let k = 0; k < m; k++) {
      const row = Aeq[k];
      const rowNormSq = dot(row, row);
      if (rowNormSq < 1e-14) continue;
      const residual = dot(row, x) - beq[k];
      x = vecSub(x, vecScale(row, residual / rowNormSq));
    }
    x = projectBox(x, lb, ub);

    return x;
  }

  // Project gradient onto the feasible cone (zero where at bound and pointing out)
  function projectGradient(grad, x, lb, ub, Aeq) {
    const n = grad.length;
    // Remove components along equality constraints
    let g = grad.slice();
    for (let k = 0; k < Aeq.length; k++) {
      const row = Aeq[k];
      const rowNormSq = dot(row, row);
      if (rowNormSq < 1e-14) continue;
      g = vecSub(g, vecScale(row, dot(row, g) / rowNormSq));
    }
    // Zero out components at bounds
    for (let i = 0; i < n; i++) {
      if ((x[i] <= lb[i] + 1e-12 && g[i] > 0) ||
          (x[i] >= ub[i] - 1e-12 && g[i] < 0)) {
        g[i] = 0;
      }
    }
    return g;
  }

  function objective(x, Q, c) {
    return 0.5 * dot(x, matVec(Q, x)) + dot(c, x);
  }

  function armijo(x, grad, Q, c, lb, ub, Aeq, beq) {
    let alpha = 1.0;
    const beta = 0.5;
    const sigma = 1e-4;
    const f0 = objective(x, Q, c);
    const dg = dot(grad, grad);

    for (let i = 0; i < 30; i++) {
      const xNew = projectFeasible(vecSub(x, vecScale(grad, alpha)), lb, ub, Aeq, beq, 5);
      const fNew = objective(xNew, Q, c);
      if (fNew <= f0 - sigma * alpha * dg) return alpha;
      alpha *= beta;
    }
    return alpha;
  }

  function solveQP(Q, c, Aeq, beq, lb, ub, x0, options) {
    options = options || {};
    const ftol = options.ftol || 1e-10;
    const maxiter = options.maxiter || 500;
    const n = c.length;

    let x = projectFeasible(x0.slice(), lb, ub, Aeq, beq, 30);
    let success = false;

    for (let iter = 0; iter < maxiter; iter++) {
      const grad = vecAdd(matVec(Q, x), c);
      const gp = projectGradient(grad, x, lb, ub, Aeq);
      const gnorm = norm(gp);

      if (gnorm < ftol) { success = true; break; }

      const alpha = armijo(x, gp, Q, c, lb, ub, Aeq, beq);
      const xNew = projectFeasible(vecSub(x, vecScale(gp, alpha)), lb, ub, Aeq, beq, 20);

      if (norm(vecSub(xNew, x)) < ftol) { success = true; x = xNew; break; }
      x = xNew;
    }

    return { x, success };
  }

  // ── linspace ─────────────────────────────────────────────────────────────

  function linspace(a, b, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push(a + (b - a) * i / (n - 1));
    }
    return arr;
  }

  // ── Main export ───────────────────────────────────────────────────────────

  function calcularFronteraCompleta(marketData) {
    const { returns, assets, T } = buildReturns(marketData);
    const n = assets.length;
    const { mu, Sigma } = calcMuSigma(returns, T, n);

    const lb = new Array(n).fill(0);
    const ub = new Array(n).fill(1);
    const ones = new Array(n).fill(1);
    const zeros = new Array(n).fill(0);

    // Equality: sum of weights = 1
    const AeqSum = [ones];
    const beqSum = [1];

    // ── MVP ────────────────────────────────────────────────────────────────
    const Q2 = Sigma.map(row => row.map(v => 2 * v));
    const mvpResult = solveQP(Q2, zeros, AeqSum, beqSum, lb, ub, ones.map(v => v / n), { ftol: 1e-10, maxiter: 800 });
    const w_mvp = mvpResult.x;
    const mu_mvp = dot(w_mvp, mu);

    // ── Max return point ──────────────────────────────────────────────────
    const maxMuIdx = mu.indexOf(Math.max(...mu));
    const mu_max = mu[maxMuIdx];

    // ── Frontier ──────────────────────────────────────────────────────────
    const mu_targets = linspace(mu_mvp * 1.0001, mu_max * 0.9999, 100);

    const frontierPoints = [];
    let xPrev = w_mvp.slice();

    for (let k = 0; k < mu_targets.length; k++) {
      const target = mu_targets[k];
      // Aeq = [mu'; ones']  beq = [target; 1]
      const Aeq2 = [mu, ones];
      const beq2 = [target, 1];

      const res = solveQP(Q2, zeros, Aeq2, beq2, lb, ub, xPrev, { ftol: 1e-10, maxiter: 500 });

      if (!res.success && norm(vecSub(matVec(Aeq2, res.x), beq2)) > 1e-3) continue;

      const w = res.x;
      const ret = dot(w, mu);
      let variance = 0;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          variance += w[i] * Sigma[i][j] * w[j];
      const vol = Math.sqrt(Math.max(0, variance));

      // Weights map: only assets with w > 0.005
      const weights = {};
      for (let i = 0; i < n; i++) {
        if (w[i] > 0.005) weights[assets[i]] = w[i];
      }

      frontierPoints.push({ ret, vol, weights });
      xPrev = w.slice();
    }

    // ── Always include the max-return asset as last frontier point ────────
    const wMax = new Array(n).fill(0);
    wMax[maxMuIdx] = 1;
    const volMax = Math.sqrt(Sigma[maxMuIdx][maxMuIdx]);
    const weightsMax = {};
    weightsMax[assets[maxMuIdx]] = 1;
    // Only add if it extends beyond the last computed point
    const lastPt = frontierPoints[frontierPoints.length - 1];
    if (!lastPt || Math.abs(lastPt.ret - mu_max) > 1e-4) {
      frontierPoints.push({ ret: mu_max, vol: volMax, weights: weightsMax });
    }

    // ── Max Sharpe (rf = 0) ───────────────────────────────────────────────
    let maxSharpe = -Infinity;
    let maxSharpeIndex = 0;
    for (let k = 0; k < frontierPoints.length; k++) {
      const s = frontierPoints[k].ret / frontierPoints[k].vol;
      if (s > maxSharpe) { maxSharpe = s; maxSharpeIndex = k; }
    }

    // ── Asset points ──────────────────────────────────────────────────────
    const assetPoints = assets.map((nombre, i) => ({
      nombre,
      ret: mu[i],
      vol: Math.sqrt(Sigma[i][i])
    }));

    return { frontierPoints, assetPoints, mu, Sigma, assets, maxSharpeIndex };
  }

  // ── Max-return portfolio at given annual volatility target ──────────────────

  function calcularPortafolioMaxRet(marketData, sigmaTargetAnual) {
    const { returns, assets, T } = buildReturns(marketData);
    const n = assets.length;
    const { mu, Sigma } = calcMuSigma(returns, T, n);

    const lb    = new Array(n).fill(0);
    const ub    = new Array(n).fill(1);
    const ones  = new Array(n).fill(1);
    const zeros = new Array(n).fill(0);
    const Aeq   = [ones];
    const beq   = [1];
    const Q2    = Sigma.map(row => row.map(v => 2 * v));

    // MVP
    const mvpRes = solveQP(Q2, zeros, Aeq, beq, lb, ub, ones.map(v => v / n), { ftol: 1e-10, maxiter: 800 });
    const w_mvp  = mvpRes.x;
    let var_mvp  = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) var_mvp += w_mvp[i] * Sigma[i][j] * w_mvp[j];
    const vol_mvp = Math.sqrt(Math.max(0, var_mvp));

    const sigma = Math.max(sigmaTargetAnual, vol_mvp * 1.0001);

    // Binary search over target return to find max ret with vol <= sigma
    const mu_mvp = dot(w_mvp, mu);
    const maxRetIdx = mu.indexOf(Math.max(...mu));
    const mu_max    = mu[maxRetIdx];

    let loRet = mu_mvp, hiRet = mu_max;
    let bestW = w_mvp.slice(), bestRet = mu_mvp, bestVol = vol_mvp;

    for (let iter = 0; iter < 40; iter++) {
      const midRet = (loRet + hiRet) / 2;
      const res = solveQP(Q2, zeros, [mu, ones], [midRet, 1], lb, ub, bestW.slice(), { ftol: 1e-10, maxiter: 500 });
      // Accept near-feasible solutions (same tolerance as calcularFronteraCompleta)
      const constraintRes = Math.abs(dot(mu, res.x) - midRet) + Math.abs(dot(ones, res.x) - 1);
      if (!res.success && constraintRes > 1e-3) { hiRet = midRet; continue; }
      const w = res.x;
      let var_ = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) var_ += w[i] * Sigma[i][j] * w[j];
      const vol_ = Math.sqrt(Math.max(0, var_));
      if (vol_ <= sigma + 1e-8) { loRet = midRet; bestW = w.slice(); bestRet = dot(w, mu); bestVol = vol_; }
      else hiRet = midRet;
    }

    const weights = {};
    assets.forEach((a, i) => { if (bestW[i] > 0.005) weights[a] = bestW[i]; });
    return { weights, ret: bestRet, vol: bestVol, vol_mvp, assets };
  }

  // ── MVP volatility (for sigma slider bounds) ─────────────────────────────────

  function calcularVolMVP(marketData) {
    const { returns, assets, T } = buildReturns(marketData);
    const n = assets.length;
    const { Sigma } = calcMuSigma(returns, T, n);

    const lb   = new Array(n).fill(0);
    const ub   = new Array(n).fill(1);
    const ones = new Array(n).fill(1);
    const Q2   = Sigma.map(row => row.map(v => 2 * v));

    const res = solveQP(Q2, new Array(n).fill(0), [ones], [1], lb, ub, ones.map(v => v / n), { ftol: 1e-10, maxiter: 800 });
    const w   = res.x;
    let var_  = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) var_ += w[i] * Sigma[i][j] * w[j];

    const assetVols = assets.map((_, i) => Math.sqrt(Sigma[i][i]));
    return { vol_mvp: Math.sqrt(Math.max(0, var_)), vol_max: Math.max(...assetVols) };
  }

  // Expose to Web Worker scope
  self.calcularFronteraCompleta  = calcularFronteraCompleta;
  self.calcularPortafolioMaxRet  = calcularPortafolioMaxRet;
  self.calcularVolMVP            = calcularVolMVP;

})();
