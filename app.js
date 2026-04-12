// ==========================
// VARIABLES GLOBALES
// ==========================
let allocationChart;

let chart;
let drawdownChart;
let mcChart;
let histogramChart;
let rollingChart;
let rollingHistChart;

let withdrawalChart;
let survivalChart;
let fanChart;
let ruinChart;
let sequenceChart;


function mostrarAcumulacion() {
    document.getElementById("accumulationView").style.display = "block";
    document.getElementById("withdrawalView").style.display = "none";
}

function mostrarRetiros() {
    document.getElementById("accumulationView").style.display = "none";
    document.getElementById("withdrawalView").style.display = "block";
}

// ==========================
// UTILIDADES
// ==========================
function limpiarNumero(valor) {
    return parseFloat(String(valor).replace(",", ""));
}

// ==========================
// OBTENER PESOS
// ==========================
function getWeights() {
    let weights = {};

    Object.keys(slidersMap).forEach(asset => {
        weights[asset] = slidersMap[asset].value / 100;
    });

    return weights;
}

// ==========================
// ASSET ALLOCATION POR CLASE DE ACTIVO
// ==========================
function agruparAssetAllocation(weights) {

    let acciones = 
        (weights["Acciones USA"] || 0) +
        (weights["Acciones Europa"] || 0) +
        (weights["Acciones EM"] || 0);

    let rentaFija =
        (weights["Renta Fija Global IG"] || 0) +
        (weights["Renta Fija Global HY"] || 0) +
        (weights["Renta Fija EM"] || 0);

    let otros = {
        "Money Market": weights["Money Market"] || 0,
        "Real Estate": weights["Real Estate"] || 0,
        "Infrastructure": weights["Infrastructure"] || 0,
        "Oro": weights["Oro"] || 0,
        "Commodities": weights["Commodities"] || 0
    };

    // ==========================
    // COLORES FIJOS (CLAVE PRO)
    // ==========================
    const colorMap = {
        "Acciones": "#1f3a8a",       // azul fuerte
        "Renta Fija": "#60a5fa",     // celeste
        "Money Market": "#9ca3af",   // gris medio
        "Real Estate": "#a78bfa",    // violeta suave
        "Infrastructure": "#34d399", // verde
        "Oro": "#f59e0b",            // dorado
        "Commodities": "#f97316"     // naranja
    };

    // ==========================
    // ARMAR ITEMS
    // ==========================
    let items = [];

    if (acciones > 0) {
        items.push({ label: "Acciones", value: acciones * 100 });
    }

    if (rentaFija > 0) {
        items.push({ label: "Renta Fija", value: rentaFija * 100 });
    }

    Object.keys(otros).forEach(k => {
        if (otros[k] > 0) {
            items.push({ label: k, value: otros[k] * 100 });
        }
    });

    // ==========================
    // ORDENAR (MAYOR → MENOR)
    // ==========================
    items.sort((a, b) => b.value - a.value);

    // ==========================
    // RECONSTRUIR
    // ==========================
    let labels = items.map(i => i.label);
    let data = items.map(i => i.value);
    let colors = items.map(i => colorMap[i.label] || "#cccccc");

    // ==========================
    // BREAKDOWN (para tooltip)
    // ==========================
    return {
        labels,
        data,
        colors,
        breakdown: {
            acciones: {
                "USA": (weights["Acciones USA"] || 0) * 100,
                "Europa": (weights["Acciones Europa"] || 0) * 100,
                "EM": (weights["Acciones EM"] || 0) * 100
            },
            rentaFija: {
                "IG": (weights["Renta Fija Global IG"] || 0) * 100,
                "HY": (weights["Renta Fija Global HY"] || 0) * 100,
                "EM": (weights["Renta Fija EM"] || 0) * 100
            }
        }
    };
}
function updateAllocationChart() {

    const weights = getWeights();
    const grouped = agruparAssetAllocation(weights);

    const ctx = document.getElementById("allocationChart");

    if (allocationChart) allocationChart.destroy();

    allocationChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: grouped.labels,
            datasets: [{
                data: grouped.data,
                backgroundColor: grouped.colors, // 🔥 dinámico y consistente
                borderWidth: 0
            }]
        },
        options: {

        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",

            plugins: {

            legend: {
            position: "right",
            labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 15,

                    generateLabels: function(chart) {

                        const data = chart.data;
                        const dataset = data.datasets[0];

                        return data.labels.map((label, i) => {

                            const value = dataset.data[i];
                            const total = dataset.data.reduce((a, b) => a + b, 0);

                            const pct = total > 0 ? (value / total * 100).toFixed(1) : 0;

                            return {
                                text: `${label} — ${pct}%`,
                                fillStyle: dataset.backgroundColor[i],
                                strokeStyle: dataset.backgroundColor[i],
                                lineWidth: 0,
                                hidden: false,
                                index: i
                            };
                        });
                    }
                }
            },

            tooltip: {
                callbacks: {
                    label: function(context) {

                        const label = context.label;
                        const value = context.raw.toFixed(1);

                        let lines = [`${label}: ${value}%`];

                        if (label === "Acciones") {
                            const b = grouped.breakdown.acciones;

                            if (b["USA"] > 0) lines.push(`USA: ${b["USA"].toFixed(1)}%`);
                            if (b["Europa"] > 0) lines.push(`Europa: ${b["Europa"].toFixed(1)}%`);
                            if (b["EM"] > 0) lines.push(`EM: ${b["EM"].toFixed(1)}%`);
                        }

                        if (label === "Renta Fija") {
                            const b = grouped.breakdown.rentaFija;

                            if (b["IG"] > 0) lines.push(`IG: ${b["IG"].toFixed(1)}%`);
                            if (b["HY"] > 0) lines.push(`HY: ${b["HY"].toFixed(1)}%`);
                            if (b["EM"] > 0) lines.push(`EM: ${b["EM"].toFixed(1)}%`);
                        }

                        return lines;
                    }
                }
            }
        }
        }
    });
}


// ==========================
// CÁLCULO PORTAFOLIO
// ==========================
function calcularPortafolio(data, weights, initialValue) {

    data = data.filter(row => row["Fecha"]);

    const activos = Object.keys(weights)
        .filter(a => weights[a] > 0 && data[0][a] !== undefined);

    let fechas = [];
    let valores = [];
    let retornos = [];
    let rfSeries = [];

    let V = initialValue;

    // punto inicial
    fechas.push(data[0]["Fecha"]);
    valores.push(V);

    for (let t = 1; t < data.length; t++) {

        let retornoPortafolio = 0;

        activos.forEach(activo => {
            let precioHoy = limpiarNumero(data[t][activo]);
            let precioAyer = limpiarNumero(data[t - 1][activo]);

            if (isNaN(precioHoy) || isNaN(precioAyer)) return;

            let retorno = (precioHoy / precioAyer) - 1;

            retornoPortafolio += weights[activo] * retorno;
        });

        // 🔹 Rf (Money Market)
        let precioHoyRF = limpiarNumero(data[t]["Money Market"]);
        let precioAyerRF = limpiarNumero(data[t - 1]["Money Market"]);

        let rf = 0;
        if (!isNaN(precioHoyRF) && !isNaN(precioAyerRF)) {
        rf = (precioHoyRF / precioAyerRF) - 1;
        }

        rfSeries.push(rf);

        V = V * (1 + retornoPortafolio);

        fechas.push(data[t]["Fecha"]);
        valores.push(V);
        retornos.push(retornoPortafolio);
    }

    return { fechas, valores, retornos, rfSeries };
}

// ==========================
// ESTADÍSTICAS
// ==========================
function calcularEstadisticas(valores, retornos, rfSeries, fechas, initialValue) {

    const n = retornos.length;

    const valorFinal = valores[valores.length - 1];
    const retornoTotal = (valorFinal / initialValue) - 1;
    const retornoAnual = Math.pow(1 + retornoTotal, 12 / n) - 1;

    // volatilidad
    const promedio = retornos.reduce((a, b) => a + b, 0) / n;

    const varianza = retornos.reduce((acc, r) => {
        return acc + Math.pow(r - promedio, 2);
    }, 0) / n;

    const volMensual = Math.sqrt(varianza);
    const volAnual = volMensual * Math.sqrt(12);

    // 🔹 drawdown completo
let peak = valores[0];
let peakIndex = 0;

let maxDD = 0;
let ddStart = null;
let ddEnd = null;
let ddDuration = 0;

let currentStart = 0;

valores.forEach((v, i) => {

    if (v > peak) {
        peak = v;
        peakIndex = i;
        currentStart = i;
    }

    let dd = (v / peak) - 1;

    if (dd < maxDD) {
        maxDD = dd;
        ddStart = peakIndex;
        ddEnd = i;
        ddDuration = i - peakIndex;
    }
});

    // positivos / negativos
    let positivos = retornos.filter(r => r > 0).length;
    let negativos = retornos.filter(r => r < 0).length;

    // sharpe
    let excess = retornos.map((r, i) => r - rfSeries[i]);
    let avgExcess = excess.reduce((a, b) => a + b, 0) / n;

    let varExcess = excess.reduce((acc, r) => {
        return acc + Math.pow(r - avgExcess, 2);
    }, 0) / n;

    let stdExcess = Math.sqrt(varExcess);
    let sharpe = (avgExcess / stdExcess) * Math.sqrt(12);

    let ddStartDate = ddStart !== null ? fechas[ddStart] : "-";
    let ddEndDate = ddEnd !== null ? fechas[ddEnd] : "-";

    return {
    valorFinal,
    retornoTotal,
    retornoAnual,
    volAnual,
    maxDD,
    sharpe,
    positivos,
    negativos,
    totalMeses: n,
    ddStart: ddStartDate,
    ddEnd: ddEndDate,
    ddDuration
};
}

// ==========================
// GRÁFICO
// ==========================
function graficar(fechas, valores) {

    const ctx = document.getElementById("portfolioChart");

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: fechas,
            datasets: [{
                label: "Portafolio",
                data: valores,
                borderWidth: 2,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    ticks: {
                        callback: v => "$" + Math.round(v).toLocaleString()
                    }
                }
            }
        }
    });
}

// ==========================
// MOSTRAR RESUMEN
// ==========================
function mostrarResumen(stats) {

    const pct = x => (x * 100).toFixed(2) + "%";

    document.getElementById("summaryStats").innerHTML = `

        <!-- FILA 1 -->
        <div style="display:flex; gap:15px; margin-bottom:15px;">
            <div class="stat-box"><h4>Valor Final</h4><p>$${Math.round(stats.valorFinal).toLocaleString()}</p></div>
            <div class="stat-box"><h4>Retorno Total</h4><p>${pct(stats.retornoTotal)}</p></div>
            <div class="stat-box"><h4>Retorno Anual</h4><p>${pct(stats.retornoAnual)}</p></div>
            <div class="stat-box"><h4>Sharpe</h4><p>${stats.sharpe.toFixed(2)}</p></div>
        </div>

        <!-- FILA 2 -->
        <div style="display:flex; gap:15px;">
            <div class="stat-box"><h4>Volatilidad</h4><p>${pct(stats.volAnual)}</p></div>

            <div class="stat-box">
                <h4>Max Drawdown</h4>
                <p>${pct(stats.maxDD)}</p>
                <small>
                    ${stats.ddStart} → ${stats.ddEnd}<br>
                    ${stats.ddDuration} meses
                </small>
            </div>

            <div class="stat-box">
                <h4>Meses +</h4>
                <p>${stats.positivos} (${pct(stats.positivos / stats.totalMeses)})</p>
            </div>

            <div class="stat-box">
                <h4>Meses -</h4>
                <p>${stats.negativos} (${pct(stats.negativos / stats.totalMeses)})</p>
            </div>
        </div>
    `;
}

// ==========================
// RUN
// ==========================
function runSimulation() {

    mostrarAcumulacion();

    if (!marketDataNominal || marketDataNominal.length === 0) {
        alert("Datos aún no cargados");
        return;
    }

    const initialValue = parseFloat(document.getElementById("initialValue").value);
    const weights = getWeights();

    const returnType = document.getElementById("returnType").value;

    const dataToUse = (returnType === "real") 
    ? marketDataReal 
    : marketDataNominal;

    const resultado = calcularPortafolio(dataToUse, weights, initialValue);

    graficar(resultado.fechas, resultado.valores);

    const stats = calcularEstadisticas(
    resultado.valores,
    resultado.retornos,
    resultado.rfSeries,
    resultado.fechas,
    initialValue
    );

    mostrarResumen(stats);

    // DRAWOWNS
    const dds = calcularDrawdowns(resultado.valores, resultado.fechas);

    const topDDs = procesarTopDrawdowns(dds, resultado.valores, resultado.fechas);

    if (topDDs.length > 0) {
        graficarDrawdowns(topDDs);
        mostrarTablaDrawdowns(topDDs);
    }

    // MONTE CARLO
    const mcResultados = correrMonteCarlo(resultado.retornos);

    graficarMonteCarlo(mcResultados);

    mostrarMonteCarloStats(mcResultados);

    // HISTOGRAMA
        const selectorFreq = document.getElementById("histogramFrequency");
    const selectorMode = document.getElementById("histogramMode");

    function actualizarHistograma() {
        graficarHistograma(resultado.retornos, selectorFreq.value);
    }

    selectorFreq.onchange = actualizarHistograma;
    selectorMode.onchange = actualizarHistograma;

    // inicial
    graficarHistograma(resultado.retornos, selectorFreq.value);

    // ===== ROLLING RETURNS =====
    const rollingData = calcularRollingReturns(
        resultado.retornos,
        resultado.fechas,
        12
    );

    graficarRolling(rollingData.rolling, rollingData.rollingFechas);
    graficarHistogramaRolling(rollingData.rolling);

}


// ==========================
// SIMULACIÓN CON RETIROS
// ==========================

function simularConRetiros(retornos, initialValue, withdrawal, startYear, horizonYears = 30) {

    const totalMonths = horizonYears * 12;
    const startMonth = startYear * 12;

    let V = initialValue;
    let valores = [V];

    let ruinMonth = null;

    const camino = generarCaminoEstacionario(retornos, totalMonths, 0.083);

    for (let m = 0; m < totalMonths; m++) {

        V = V * (1 + camino[m]);

        // retiro anual al final de cada año
        if ((m + 1) % 12 === 0 && m >= startMonth) {
            V = Math.max(0, V - withdrawal);
        }

        if (V <= 0 && ruinMonth === null) {
            ruinMonth = m;
            V = 0;
        }

        valores.push(V);
    }

    return {
        valores,
        ruinMonth,
        finalValue: V
    };
}


// ==========================
// MONTE CARLO CON RETIROS
// ==========================

function correrSimulacionRetiros(retornos, initialValue, withdrawal, startYear, simulaciones = 2000) {

    let resultados = [];
    let paths = [];

    for (let i = 0; i < simulaciones; i++) {

        const sim = simularConRetiros(retornos, initialValue, withdrawal, startYear);

        paths.push(sim.valores);

        resultados.push({
            ruinYears: sim.ruinMonth !== null ? sim.ruinMonth / 12 : 30,
            finalValue: sim.finalValue
        });
    }

    return { resultados, paths };
}


// ==========================
// SUPERVIVENCIA
// ==========================

function calcularSupervivencia(paths) {

    const months = paths[0].length;
    const sims = paths.length;

    let survival = [];

    for (let m = 0; m < months; m++) {

        let alive = 0;

        for (let i = 0; i < sims; i++) {
            if (paths[i][m] > 0) alive++;
        }

        survival.push(alive / sims);
    }

    return survival;
}


// ==========================
// DISTRIBUCIÓN DE RUINA
// ==========================

function calcularDistribucionRuina(resultados) {

    let tiempos = resultados.map(r => r.ruinYears);

    tiempos.sort((a, b) => a - b);

    const n = tiempos.length;

    return {
        media: tiempos.reduce((a, b) => a + b, 0) / n,
        p5: tiempos[Math.floor(n * 0.05)],
        p50: tiempos[Math.floor(n * 0.5)],
        p95: tiempos[Math.floor(n * 0.95)],
        tiempos
    };
}


// ==========================
// SEQUENCING RISK
// ==========================

function analizarSequencing(retornos, initialValue, withdrawal, startYear) {

    const sorted = retornos.slice().sort((a, b) => a - b);

    const worst = simularConRetirosHistoricoOrdenado(sorted, initialValue, withdrawal, startYear);
    const best = simularConRetirosHistoricoOrdenado(sorted.slice().reverse(), initialValue, withdrawal, startYear);

    return {
        worst,
        best
    };
}


function runWithdrawalSimulation() {

    mostrarRetiros();

    if (!marketDataReal || marketDataReal.length === 0) {
        alert("Datos no cargados");
        return;
    }

    const initialValue = parseFloat(document.getElementById("initialValue").value);
    const withdrawal = parseFloat(document.getElementById("withdrawalAmount").value);
    const startYear = parseInt(document.getElementById("withdrawalStart").value) || 0;

    const weights = getWeights();

    // ===== PORTAFOLIO HISTÓRICO =====
    const resultado = calcularPortafolio(marketDataReal, weights, initialValue);

    const valoresSin = resultado.valores;

    // ===== PATH BASE =====
    const base = simularRetirosHistorico(
    resultado.retornos,
    resultado.fechas,
    initialValue,
    withdrawal,
    startYear
    );

    // ===== MONTE CARLO =====
    const sim = correrSimulacionRetiros(
        resultado.retornos,
        initialValue,
        withdrawal,
        startYear
    );

    // ===== GRÁFICO PRINCIPAL =====
    graficarRetiros(resultado.fechas, base.valores, valoresSin);

    // ===== SUPERVIVENCIA =====
    const survival = calcularSupervivencia(sim.paths);
    graficarSupervivencia(survival);

    // ===== FAN CHART =====
    graficarFanChart(sim.paths);

    // ===== DISTRIBUCIÓN RUINA =====
    const dist = calcularDistribucionRuina(sim.resultados);
    graficarRuina(dist);

    // ===== MÉTRICAS =====
    mostrarStatsRetiros(sim, base, valoresSin, initialValue, withdrawal);

    // ===== SEQUENCING =====
    const seq = analizarSequencing(
        resultado.retornos,
        initialValue,
        withdrawal,
        startYear
    );

    graficarSequencing(seq);
}


function calcularDrawdowns(valores, fechas) {

    let drawdowns = [];

    let peakIndex = 0;
    let peakValue = valores[0];

    let inDrawdown = false;
    let troughIndex = 0;
    let troughValue = valores[0];

    for (let i = 1; i < valores.length; i++) {

        let v = valores[i];

        // nuevo peak → cierra drawdown anterior si existía
        if (v >= peakValue) {

            if (inDrawdown) {

                drawdowns.push({
                    peakIndex,
                    troughIndex,
                    recoveryIndex: i,
                    peakValue,
                    troughValue
                });

                inDrawdown = false;
            }

            peakValue = v;
            peakIndex = i;
        }

        // estamos en drawdown
        if (v < peakValue) {

            if (!inDrawdown) {
                inDrawdown = true;
                troughValue = v;
                troughIndex = i;
            }

            if (v < troughValue) {
                troughValue = v;
                troughIndex = i;
            }
        }
    }

    // drawdown abierto (no recuperado)
    if (inDrawdown) {
        drawdowns.push({
            peakIndex,
            troughIndex,
            recoveryIndex: null,
            peakValue,
            troughValue
        });
    }

    return drawdowns;
}

function procesarTopDrawdowns(drawdowns, valores, fechas) {

    // profundidad
    drawdowns.forEach(dd => {
        dd.depth = (dd.troughValue / dd.peakValue) - 1;
    });

    // ordenar por peor
    drawdowns.sort((a, b) => a.depth - b.depth);

    let top = drawdowns.slice(0, 3);

    // enriquecer info
    top.forEach(dd => {

        dd.startDate = fechas[dd.peakIndex];
        dd.troughDate = fechas[dd.troughIndex];

        dd.duration = dd.troughIndex - dd.peakIndex;

        if (dd.recoveryIndex !== null) {
            dd.recoveryDuration = dd.recoveryIndex - dd.troughIndex;
            dd.recoveryDate = fechas[dd.recoveryIndex];
        } else {
            dd.recoveryDuration = null;
            dd.recoveryDate = null;
        }

        // serie normalizada
        let end = dd.recoveryIndex !== null ? dd.recoveryIndex : valores.length - 1;

        dd.series = [];

        for (let i = dd.peakIndex; i <= end; i++) {
            dd.series.push((valores[i] / dd.peakValue) * 100);
        }
    });

    return top;
}

function graficarDrawdowns(drawdowns) {

    const ctx = document.getElementById("drawdownChart");

    if (drawdownChart) drawdownChart.destroy();

    const datasets = drawdowns.map((dd, i) => ({
        label: `DD ${i + 1}`,
        data: dd.series,
        borderWidth: 2,
        tension: 0.1
    }));

    // eje X = 0...max
    const maxLength = Math.max(...drawdowns.map(d => d.series.length));
    const labels = Array.from({ length: maxLength }, (_, i) => i);

    drawdownChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    //min: 0,
                    ticks: {
                        callback: v => v.toFixed(0)
                    }
                }
            }
        }
    });
}

function formatFecha(fechaStr) {
    const d = new Date(fechaStr);
    if (isNaN(d)) return fechaStr;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();

    return `${dd}/${mm}/${yyyy}`;
}

function mostrarTablaDrawdowns(drawdowns) {

    const pct = x => (x * 100).toFixed(2) + "%";

    const container = document.getElementById("drawdownCards");
    container.innerHTML = "";

    drawdowns.forEach((dd, i) => {

        const card = `
            <div class="dd-card">

                <div class="dd-title">Drawdown #${i + 1}</div>

                <div class="dd-depth">
                    ${pct(dd.depth)}
                </div>

                <div class="dd-dates">
                    <strong>Inicio:</strong> ${formatFecha(dd.startDate)}<br>
                    <strong>Valle:</strong> ${formatFecha(dd.troughDate)}<br>
                    <strong>Recuperación:</strong> ${dd.recoveryDate ? formatFecha(dd.recoveryDate) : "No recuperado"}
                </div>

                <div class="dd-extra">
                    ⏱ Caída: ${dd.duration} meses<br>
                    🔄 Recuperación: ${dd.recoveryDuration !== null ? dd.recoveryDuration + " meses" : "-"}
                </div>

            </div>
        `;

        container.innerHTML += card;
    });
}


    function generarCaminoEstacionario(retornos, meses, p = 0.083) {

        let camino = [];

            // elegir punto inicial aleatorio
            let index = Math.floor(Math.random() * retornos.length);

        for (let t = 0; t < meses; t++) {

            camino.push(retornos[index]);

            // decidir si continuar bloque o cortar
            if (Math.random() < p) {
                // cortar → nuevo punto aleatorio
                index = Math.floor(Math.random() * retornos.length);
            } else {
                // continuar bloque
                index = (index + 1) % retornos.length;
            }
        }

        return camino;
    }

function calcularRetornoAnualizado(retornos) {

    const total = retornos.reduce((acc, r) => acc * (1 + r), 1);

    const n = retornos.length;

    return Math.pow(total, 12 / n) - 1;
}

function correrMonteCarlo(retornos) {

    const horizontes = [1, 3, 5, 7, 10, 15];
    const simulaciones = 3000;

    let resultados = [];

    horizontes.forEach(h => {

        const meses = h * 12;
        let sims = [];

        for (let i = 0; i < simulaciones; i++) {

            const camino = generarCaminoEstacionario(retornos, meses, 0.083);

            const r = calcularRetornoAnualizado(camino);

            sims.push(r);
        }

        // ordenar simulaciones
        const simsSorted = sims.slice().sort((a, b) => a - b);
            // Mediana
        const mediana = simsSorted[Math.floor(sims.length / 2)];
            // Percentiles 5% y 95%
        const p1 = simsSorted[Math.floor(sims.length * 0.01)];
        const p99 = simsSorted[Math.floor(sims.length * 0.99)];

        const positivos = sims.filter(x => x > 0).length;
        const prob = positivos / sims.length;

        resultados.push({
            horizonte: h,
            mediana,
            p1,
            p99,
            prob
        });
    });

    return resultados;
}

function graficarMonteCarlo(resultados) {

    const ctx = document.getElementById("mcChart");

    if (mcChart) mcChart.destroy();

    const labels = resultados.map(r => r.horizonte + "y");

    const mediana = resultados.map(r => r.mediana);
    const p1 = resultados.map(r => r.p1);
    const p99 = resultados.map(r => r.p99);

    mcChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "P99",
                    data: p99,
                    borderWidth: 1,
                    borderColor: 'rgba(150,150,150,0.5)',
                    borderDash: [5,5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0
                 },
                 {
                    label: "P1",
                    data: p1,
                    borderWidth: 1,
                    borderColor: 'rgba(150,150,150,0.5)',
                    tension: 0.3,
                    fill: '-1',
                    backgroundColor: 'rgba(110, 194, 250, 0.25)',
                    pointRadius: 0
                },
                 {
                    label: "Mediana",
                    data: mediana,
                    borderWidth: 3,
                    borderColor: '#456db8',
                    tension: 0.3,
                    pointRadius: 0
                 }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8
                    }
                }
            },
            elements: {
                line: {
                    borderJoinStyle: 'round'
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: v => (v * 100).toFixed(1) + "%",
                        color: '#666'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    ticks: {
                        color: '#666'
                    },
                    grid: {
                        display: false
                    }
        }
    }
}
    });
}

function mostrarMonteCarloStats(resultados) {

    const pct = x => (x * 100).toFixed(2) + "%";

    let html = `<div style="
    display:grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap:15px;
    ">`;

    resultados.forEach(r => {

        html += `
            <div class="stat-box">
                <h4>${r.horizonte} años</h4>
                <p>Mediana: ${pct(r.mediana)}</p>
                <p>Percentil 1: ${pct(r.p1)}</p>
                <p>Percentil 99: ${pct(r.p99)}</p>
                <p>Prob. > 0: ${pct(r.prob)}</p>
            </div>
        `;
    });

    html += `</div>`;

    document.getElementById("mcStats").innerHTML = html;
}

function agruparRetornos(retornos, tipo) {

    let bloque = 1;

    if (tipo === "semestral") bloque = 6;
    if (tipo === "anual") bloque = 12;

    let agrupados = [];

    // SIN OVERLAPPING
    for (let i = 0; i <= retornos.length - bloque; i += bloque) {

        let total = 1;

        for (let j = 0; j < bloque; j++) {
            total *= (1 + retornos[i + j]);
        }

        agrupados.push(total - 1);
    }

    return agrupados;
}

function graficarHistograma(retornos, tipo = "mensual") {

    const ctx = document.getElementById("histogramChart");

    if (histogramChart) histogramChart.destroy();

    // modo seleccionado
    const modo = document.getElementById("histogramMode").value;

    let window = 1;
    if (tipo === "semestral") window = 6;
    if (tipo === "anual") window = 12;

    let data = [];

    if (modo === "rolling") {

        // ===== ROLLING =====
        for (let i = window; i < retornos.length; i++) {

            let total = 1;

            for (let j = i - window; j < i; j++) {
                total *= (1 + retornos[j]);
            }

            data.push(total - 1);
        }

    } else {

        // ===== NO ROLLING =====
        data = agruparRetornos(retornos, tipo);

        }

    if (data.length === 0) return;

    // ===== VaR 5% =====
    const sorted = data.slice().sort((a, b) => a - b);
    const var5 = sorted[Math.floor(sorted.length * 0.05)];

    // ===== bins dinámicos =====
let bins;

if (data.length < 30) {
    bins = 8;
} else if (data.length < 80) {
    bins = 12;
} else {
    bins = 20;
}

// ===== rango original =====
const min = Math.min(...data);
const max = Math.max(...data);

// ===== padding =====
const padding = (max - min) * 0.05;

const minAdj = min - padding;
const maxAdj = max + padding;

// ===== nuevo step =====
const step = (maxAdj - minAdj) / bins;
if (step === 0) return;

let counts = new Array(bins).fill(0);

    data.forEach(r => {
        let index = Math.floor((r - minAdj) / step);
        if (index >= bins) index = bins - 1;
        if (index < 0) index = 0;
        counts[index]++;
    });

    // etiquetas eje X
            const labels = counts.map((_, i) => {
            const start = minAdj + i * step;
            const end = start + step;

            return `${(start * 100).toFixed(1)}% a ${(end * 100).toFixed(1)}%`;
        });

    // posiciones líneas
    const zeroIndex = (0 - min) / step;
    const varIndex = (var5 - min) / step;

    histogramChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                borderWidth: 1,
                borderColor: '#456db8',
                backgroundColor: 'rgba(110, 194, 250, 0.4)'
            }]
        },
                options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            elements: {
                bar: {
                    borderRadius: 2
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#666'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    ticks: {
                        color: '#666',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function calcularRollingReturns(retornos, fechas, window = 12) {

    let rolling = [];
    let rollingFechas = [];

    for (let i = window; i < retornos.length; i++) {

        let total = 1;

        for (let j = i - window; j < i; j++) {
            total *= (1 + retornos[j]);
        }

        rolling.push(total - 1);
        rollingFechas.push(fechas[i]);
    }

    return { rolling, rollingFechas };
}

function graficarRolling(rolling, fechas) {

    const ctx = document.getElementById("rollingChart");

    if (rollingChart) rollingChart.destroy();

    rollingChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: fechas,
            datasets: [{
                label: "Rolling 1Y",
                data: rolling,
                borderColor: '#456db8',
                borderWidth: 2,
                tension: 0.2,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        callback: v => (v * 100).toFixed(1) + "%"
                    }
                },
                x: {
                    display: false
                }
            }
        }
    });
}

function graficarHistogramaRolling(rolling) {

    const ctx = document.getElementById("rollingHistChart");

    if (rollingHistChart) rollingHistChart.destroy();

    // bins dinámicos
    let bins = rolling.length < 50 ? 10 : 20;

    const min = Math.min(...rolling);
    const max = Math.max(...rolling);

    const step = (max - min) / bins;
    if (step === 0) return;

    let counts = new Array(bins).fill(0);

    rolling.forEach(r => {
        let index = Math.floor((r - min) / step);
        if (index >= bins) index = bins - 1;
        if (index < 0) index = 0;
        counts[index]++;
    });

    const labels = counts.map((_, i) => {
    const start = min + i * step;
    const end = start + step;

    return `${(start * 100).toFixed(0)}% a ${(end * 100).toFixed(0)}%`;
    });

    rollingHistChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: 'rgba(110, 194, 250, 0.4)',
                borderColor: '#456db8',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // 🔥 esto lo gira
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                     ticks: {
                    color: '#666'
                 },
                    grid: {
                     color: 'rgba(0,0,0,0.05)'
                    }
                },
                y: {
                     ticks: {
                    callback: function(value, index) {
                    return this.getLabelForValue(value);
                    },
                    color: '#666'
                    },
                    grid: {
                    display: false
                    }
                }
            }
        }
    });
}

function graficarRetiros(fechas, valoresCon, valoresSin) {

    const ctx = document.getElementById("withdrawalChart");

    if (withdrawalChart) withdrawalChart.destroy();

    withdrawalChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: fechas,
          datasets: [
        {
        label: "Con retiros",
        data: valoresCon,
        borderWidth: 2,
        borderColor: "#1f3a8a" // azul oscuro
        },
        {
        label: "Sin retiros",
        data: valoresSin,
        borderWidth: 1,
        borderColor: "gray",
        borderDash: [5,5]
        }
        ]
        }
    });
}


function mostrarStatsRetiros(sim, base, valoresSin, initialValue, withdrawal) {

    const pct = x => (x * 100).toFixed(2) + "%";

    const horizontes = [5,10,15,20,30];

    // ==========================
    // 1. TIEMPO MEDIO A RUINA
    // ==========================
    // const avgRuin = sim.resultados.reduce((acc, r) => acc + r.ruinYears, 0) / sim.resultados.length;

    // ==========================
    // 1b. TIEMPO A RUINA HISTÓRICO
    // ==========================

    let ruinIndexHist = base.valores.findIndex(v => v <= 0);

    let ruinYearsHist = ruinIndexHist !== -1 ? ruinIndexHist / 12 : null;

    // ==========================
    // 2. RETORNOS
    // ==========================

    const finalCon = base.valores[base.valores.length - 1];
    const finalSin = valoresSin[valoresSin.length - 1];

    const totalMonths = base.valores.length;
    const years = totalMonths / 12;

    // número de retiros realizados
    const totalWithdrawals = base.totalWithdrawn;

    // retorno total
    const totalReturnCon = (finalCon + totalWithdrawals) / initialValue - 1;

console.log("---- DEBUG RETIROS ----");
console.log("Inicial:", initialValue);
console.log("Final:", finalCon);
console.log("Retiros reales:", totalWithdrawals);
console.log("Check:", (finalCon + totalWithdrawals) / initialValue - 1);

    const totalReturnSin = finalSin / initialValue - 1;

    // retorno anualizado
    const annCon = Math.pow(1 + totalReturnCon, 1 / years) - 1;
    const annSin = Math.pow(1 + totalReturnSin, 1 / years) - 1;

    // ==========================
    // 3. HTML
    // ==========================

    let html = `

    <!-- FILA 1: RETORNOS -->
    <div style="display:flex; gap:15px; margin-bottom:15px;">

        <div class="stat-box">
            <h4>Retorno Total (con retiros)</h4>
            <p>${pct(totalReturnCon)}</p>
        </div>

        <div class="stat-box">
            <h4>Retorno Total (sin retiros)</h4>
            <p>${pct(totalReturnSin)}</p>
        </div>

        <div class="stat-box">
            <h4>Retorno Anual (con retiros)</h4>
            <p>${pct(annCon)}</p>
        </div>

        <div class="stat-box">
            <h4>Retorno Anual (sin retiros)</h4>
            <p>${pct(annSin)}</p>
        </div>


        <div class="stat-box">
            <h4>Tiempo a ruina (histórico)</h4>
            <p>${ruinYearsHist !== null ? ruinYearsHist.toFixed(1) + " años" : "No se agota"}</p>
        </div>

    </div>

    <!-- FILA 2: SUPERVIVENCIA -->
    <h4 style="margin: 10px 0 5px 0;">Probabilidad de supervivencia</h4>
    <div style="display:flex; gap:15px;">
    `;

    horizontes.forEach(h => {

        const t = h * 12;

        let alive = sim.paths.filter(p => p[t] > 0).length;
        let prob = alive / sim.paths.length;

        html += `
            <div class="stat-box">
                <h4>${h} años</h4>
                <p>${pct(prob)}</p>
            </div>
        `;
    });

    html += `</div>`;

    document.getElementById("withdrawalStats").innerHTML = html;
}


function graficarSupervivencia(survival) {

    const ctx = document.getElementById("survivalChart");

    if (survivalChart) survivalChart.destroy();

    const labels = survival.map((_, i) => (i/12).toFixed(1));

    survivalChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Supervivencia",
                data: survival,
                borderWidth: 2
            }]
        }
    });
}


function graficarFanChart(paths) {

    const ctx = document.getElementById("fanChart");

    if (fanChart) fanChart.destroy();

    const months = paths[0].length;
    const sims = paths.length;

    let p5 = [], p50 = [], p95 = [];

    for (let m = 0; m < months; m++) {

        let vals = paths.map(p => p[m]).sort((a,b)=>a-b);

        p5.push(vals[Math.floor(sims*0.05)]);
        p50.push(vals[Math.floor(sims*0.5)]);
        p95.push(vals[Math.floor(sims*0.95)]);
    }

    const labels = p5.map((_, i) => (i/12).toFixed(1));

    fanChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "P95",
                    data: p95,
                    borderWidth: 1,
                    borderDash: [5,5]
                },
                {
                    label: "P5",
                    data: p5,
                    borderWidth: 1,
                    fill: '-1'
                },
                {
                    label: "Mediana",
                    data: p50,
                    borderWidth: 2
                }
            ]
        }
    });
}


function graficarRuina(dist) {

    const ctx = document.getElementById("ruinHistogram");

    if (ruinChart) ruinChart.destroy();

    const bins = 20;
    const max = 30;

    let counts = new Array(bins).fill(0);

    dist.tiempos.forEach(t => {
        let index = Math.floor((t / max) * bins);
        if (index >= bins) index = bins - 1;
        counts[index]++;
    });

    const labels = counts.map((_, i) => (i * max / bins).toFixed(0));

    ruinChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Frecuencia",
                data: counts
            }]
        }
    });
}


function graficarSequencing(seq) {

    const ctx = document.getElementById("sequenceChart");

    if (sequenceChart) sequenceChart.destroy();

    const labels = seq.worst.valores.map((_, i) => i === 0 ? 0 : (i/12).toFixed(1));

    sequenceChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Worst sequence",
                    data: seq.worst.valores
                },
                {
                    label: "Best sequence",
                    data: seq.best.valores
                }
            ]
        }
    });
}


function simularRetirosHistorico(retornos, fechas, initialValue, withdrawal, startYear) {

    let V = initialValue;
    let valores = [V];
    let totalWithdrawn = 0; // 🔥 nuevo

    const startMonth = startYear * 12;

    for (let m = 0; m < retornos.length; m++) {

        V = V * (1 + retornos[m]);

        if ((m + 1) % 12 === 0 && m >= startMonth) {

            let retiro = Math.min(V, withdrawal); // 🔥 clave
            V -= retiro;
            totalWithdrawn += retiro;
        }

        valores.push(V);

        // 🔥 cortar simulación cuando llega a 0
        if (V <= 0) {
            break;
        }
    }

    return {
        valores,
        totalWithdrawn // 🔥 nuevo output
    };
}

function simularConRetirosHistoricoOrdenado(retornos, initialValue, withdrawal, startYear) {

    let V = initialValue;
    let valores = [V];

    const startMonth = startYear * 12;

    for (let m = 0; m < retornos.length; m++) {

        const r = retornos[m];

        V = V * (1 + r);

        // retiro anual
        if ((m + 1) % 12 === 0 && m >= startMonth) {
            V = Math.max(0, V - withdrawal);
        }

        // 🔴 RUINA = estado absorbente
        if (V <= 0) {
            V = 0;
            valores.push(V);

            // completar el resto en 0
            for (let k = m + 1; k < retornos.length; k++) {
                valores.push(0);
            }

            break;
        }

        valores.push(V);
    }

    return { valores };
}
