// ==========================
// VARIABLES GLOBALES
// ==========================
var efficientFrontierChartInstance = null;
var frontierCacheData     = null;   // nominal
var frontierCacheDataReal = null;   // real
let allocationChart;
let composicionChartInstance;

const COMPOSICION_COLORS = [
    "#e07b54", "#5b8dd9", "#54b89e", "#d4a843", "#9b6bb5",
    "#e05c7a", "#6dbf6d", "#c97c3a", "#4fa8c4", "#b5845a",
    "#7a9e4f", "#d46b8b", "#5e7ec2", "#c9a65a", "#6bb59b",
    "#d47070", "#8a74c2", "#5fb8a0", "#d49040", "#a06bb5"
];

let chart;
let drawdownChart;
let mcChart;
let histogramChart;
let rollingChart;
let calendarChart;
let withdrawalEvolutionChart;
let mcVizChart;
let forwardReturnChart;

let resultadoCompleto    = null;
let mcSupervivenciaData  = null;
let forwardReturnData    = null;



function showView(view) {
    document.getElementById('accumulationView').style.display = view === 'accumulation' ? 'block' : 'none';
    document.getElementById('withdrawalView').style.display   = view === 'withdrawal'   ? 'block' : 'none';
    document.getElementById('goalsView').style.display        = view === 'goals'        ? 'block' : 'none';
    document.getElementById('glossaryView').style.display     = view === 'glossary'     ? 'block' : 'none';

    document.querySelectorAll('.nav-btn').forEach(function(btn, idx) {
        btn.classList.toggle('active',
            (view === 'accumulation' && idx === 0) ||
            (view === 'withdrawal'   && idx === 1) ||
            (view === 'goals'        && idx === 2)
        );
    });

    if (view === 'goals') {
        if (typeof gbiInicializar === 'function') gbiInicializar();
    }
}

function mostrarAcumulacion() { showView('accumulation'); }
function mostrarRetiros()     { showView('withdrawal'); }

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
        "Renta Variable": "#1f3a8a",  // azul fuerte
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
        items.push({ label: "Renta Variable", value: acciones * 100 });
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

                        if (label === "Renta Variable") {
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
function calcularPortafolio(data, weights, initialValue, rebalanceo = "mensual") {

    data = data.filter(row => row["Fecha"]);

    const activos = Object.keys(weights)
        .filter(a => weights[a] > 0 && data[0][a] !== undefined);

    let fechas = [];
    let valores = [];
    let retornos = [];
    let rfSeries = [];

    let V = initialValue;

    fechas.push(data[0]["Fecha"]);
    valores.push(V);

    if (rebalanceo === "mensual") {

        for (let t = 1; t < data.length; t++) {

            let retornoPortafolio = 0;

            activos.forEach(activo => {
                let precioHoy = limpiarNumero(data[t][activo]);
                let precioAyer = limpiarNumero(data[t - 1][activo]);
                if (isNaN(precioHoy) || isNaN(precioAyer)) return;
                retornoPortafolio += weights[activo] * ((precioHoy / precioAyer) - 1);
            });

            let precioHoyRF = limpiarNumero(data[t]["Money Market"]);
            let precioAyerRF = limpiarNumero(data[t - 1]["Money Market"]);
            let rf = (!isNaN(precioHoyRF) && !isNaN(precioAyerRF)) ? (precioHoyRF / precioAyerRF) - 1 : 0;
            rfSeries.push(rf);

            V = V * (1 + retornoPortafolio);
            fechas.push(data[t]["Fecha"]);
            valores.push(V);
            retornos.push(retornoPortafolio);
        }

    } else {

        // Anual y sin rebalanceo: seguimiento de valor por activo
        let Vi = {};
        activos.forEach(a => { Vi[a] = weights[a] * initialValue; });

        for (let t = 1; t < data.length; t++) {

            let Vprev = V;

            activos.forEach(activo => {
                let precioHoy = limpiarNumero(data[t][activo]);
                let precioAyer = limpiarNumero(data[t - 1][activo]);
                if (isNaN(precioHoy) || isNaN(precioAyer)) return;
                Vi[activo] *= (precioHoy / precioAyer);
            });

            V = activos.reduce((sum, a) => sum + Vi[a], 0);

            let precioHoyRF = limpiarNumero(data[t]["Money Market"]);
            let precioAyerRF = limpiarNumero(data[t - 1]["Money Market"]);
            let rf = (!isNaN(precioHoyRF) && !isNaN(precioAyerRF)) ? (precioHoyRF / precioAyerRF) - 1 : 0;
            rfSeries.push(rf);

            fechas.push(data[t]["Fecha"]);
            valores.push(V);
            retornos.push(V / Vprev - 1);

            // Rebalanceo anual: al cierre del mes 12, 24, 36...
            if (rebalanceo === "anual" && t % 12 === 0) {
                activos.forEach(a => { Vi[a] = weights[a] * V; });
            }
        }
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
    }, 0) / (n - 1);

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
    }, 0) / (n - 1);

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
// RENDIMIENTOS POR AÑO CALENDARIO
// ==========================
function calcularRendimientosAnuales(fRetornos, fFechas) {

    // fFechas[0] = fecha inicial sin retorno
    // fRetornos[i] corresponde al período que termina en fFechas[i+1]
    const byYear = {};

    for (let i = 0; i < fRetornos.length; i++) {
        const fechaStr = fFechas[i + 1];
        const parts = String(fechaStr).split('/');
        if (parts.length !== 3) continue;
        const year = parseInt(parts[2]);
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(fRetornos[i]);
    }

    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

    return years.map(year => {
        const rets = byYear[year];
        const rendimiento = rets.reduce((acc, r) => acc * (1 + r), 1) - 1;
        const completo = rets.length === 12;
        return { year, rendimiento, completo };
    });
}

function graficarCalendario(data) {

    const ctx = document.getElementById("calendarChart");
    if (calendarChart) calendarChart.destroy();

    const labels = data.map(d => d.completo ? String(d.year) : d.year + "*");
    const values = data.map(d => parseFloat((d.rendimiento * 100).toFixed(2)));

    calendarChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: values.map(v =>
                    v >= 0 ? 'rgba(110, 194, 250, 0.6)' : 'rgba(166, 27, 27, 0.5)'
                ),
                borderColor: values.map(v =>
                    v >= 0 ? '#456db8' : '#a61b1b'
                ),
                borderWidth: 1,
                borderRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const raw = ctx.raw;
                            const item = data[ctx.dataIndex];
                            const sufijo = item.completo ? '' : ' (año parcial)';
                            return (raw >= 0 ? '+' : '') + raw.toFixed(2) + '%' + sufijo;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%',
                        color: '#666'
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: { color: '#666' },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================
// FILTRO DE PERÍODO
// ==========================
function aplicarPeriodo(periodo) {

    if (!resultadoCompleto) return;

    const { fechas, valores, retornos, rfSeries } = resultadoCompleto;
    const initialValue = parseFloat(document.getElementById("initialValue").value);

    let fFechas, fValores, fRetornos, fRfSeries;

    if (periodo === "5y") {
        const n = Math.min(60, retornos.length);
        fRetornos  = retornos.slice(-n);
        fRfSeries  = rfSeries.slice(-n);
        fValores   = valores.slice(-(n + 1));
        fFechas    = fechas.slice(-(n + 1));
    } else if (periodo === "10y") {
        const n = Math.min(120, retornos.length);
        fRetornos  = retornos.slice(-n);
        fRfSeries  = rfSeries.slice(-n);
        fValores   = valores.slice(-(n + 1));
        fFechas    = fechas.slice(-(n + 1));
    } else {
        fFechas   = fechas;
        fValores  = valores;
        fRetornos = retornos;
        fRfSeries = rfSeries;
    }

    // Normalizar para que el gráfico y los cálculos arranquen desde el aporte inicial
    const scale = initialValue / fValores[0];
    const fValoresNorm = fValores.map(v => v * scale);

    graficar(fFechas, fValoresNorm);

    const stats = calcularEstadisticas(
        fValoresNorm,
        fRetornos,
        fRfSeries,
        fFechas,
        initialValue
    );

    mostrarResumen(stats);

    // Rendimientos por año calendario
    const calData = calcularRendimientosAnuales(fRetornos, fFechas);
    graficarCalendario(calData);

    // Distribución de retornos
    const selectorFreq = document.getElementById("histogramFrequency");
    graficarHistograma(fRetornos, selectorFreq.value);

    // Rolling Returns
    const rollingData = calcularRollingReturns(fRetornos, fFechas, 12);
    graficarRolling(rollingData.rolling, rollingData.rollingFechas);
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

    const rebalanceo = document.getElementById("rebalanceo").value;
    resultadoCompleto = calcularPortafolio(dataToUse, weights, initialValue, rebalanceo);

    const selectorPeriodo = document.getElementById("periodoChart");
    const selectorFreq    = document.getElementById("histogramFrequency");
    const selectorMode    = document.getElementById("histogramMode");

    const refrescar = () => aplicarPeriodo(selectorPeriodo.value);

    selectorPeriodo.onchange = refrescar;
    selectorFreq.onchange    = refrescar;
    selectorMode.onchange    = refrescar;

    aplicarPeriodo(selectorPeriodo.value);

    // DRAWOWNS
    const dds = calcularDrawdowns(resultadoCompleto.valores, resultadoCompleto.fechas);

    const topDDs = procesarTopDrawdowns(dds, resultadoCompleto.valores, resultadoCompleto.fechas);

    if (topDDs.length > 0) {
        graficarDrawdowns(topDDs);
        mostrarTablaDrawdowns(topDDs);
    }

    // MONTE CARLO
    const mcResultados = correrMonteCarlo(resultadoCompleto.retornos);

    graficarMonteCarlo(mcResultados);

    mostrarMonteCarloStats(mcResultados);

    graficarComposicion(document.getElementById('composicionSelector').value);
}


// ==========================
// SIMULACIÓN CON RETIROS
// ==========================

// ==========================
// CÁLCULO PORTAFOLIO CON RETIROS
// ==========================
function calcularPortafolioConRetiros(data, weights, initialValue, rebalanceo, withdrawal) {

    data = data.filter(row => row["Fecha"]);

    const activos = Object.keys(weights)
        .filter(a => weights[a] > 0 && data[0][a] !== undefined);

    let fechas         = [data[0]["Fecha"]];
    let valores        = [initialValue];
    let retornos       = [];
    let totalWithdrawn = 0;

    let V = initialValue;

    if (rebalanceo === "mensual") {

        for (let t = 1; t < data.length; t++) {

            // 1. Retorno de mercado desde precios (pesos fijos)
            let rt = 0;
            activos.forEach(a => {
                let hoy  = limpiarNumero(data[t][a]);
                let ayer = limpiarNumero(data[t - 1][a]);
                if (!isNaN(hoy) && !isNaN(ayer) && ayer !== 0)
                    rt += weights[a] * (hoy / ayer - 1);
            });

            // 2. Valor pre-retiro
            let Vpre = V * (1 + rt);

            // 3. Registrar retorno de mercado (antes del retiro)
            retornos.push(rt);

            // 4. Aplicar retiro al cierre de cada año
            if (t % 12 === 0) {
                const retiro = Math.min(Vpre, withdrawal);
                totalWithdrawn += retiro;
                V = Vpre - retiro;
            } else {
                V = Vpre;
            }

            fechas.push(data[t]["Fecha"]);
            valores.push(V);

            if (V <= 0) break;
        }

    } else {

        // Rebalanceo anual o sin rebalanceo: rastrear posiciones individuales
        let Vi = {};
        activos.forEach(a => { Vi[a] = weights[a] * initialValue; });

        for (let t = 1; t < data.length; t++) {

            // 1. Actualizar posiciones con precios de mercado
            activos.forEach(a => {
                let hoy  = limpiarNumero(data[t][a]);
                let ayer = limpiarNumero(data[t - 1][a]);
                if (!isNaN(hoy) && !isNaN(ayer) && ayer !== 0)
                    Vi[a] *= (hoy / ayer);
            });

            // 2. Valor pre-retiro
            let Vpre = activos.reduce((sum, a) => sum + Vi[a], 0);

            // 3. Retorno de mercado (antes del retiro)
            retornos.push(Vpre / V - 1);

            if (t % 12 === 0) {

                // 4. Aplicar retiro
                const retiro = Math.min(Vpre, withdrawal);
                totalWithdrawn += retiro;
                let Vpost = Vpre - retiro;

                if (rebalanceo === "anual") {
                    activos.forEach(a => { Vi[a] = weights[a] * Vpost; });
                } else {
                    const factor = Vpre > 0 ? Vpost / Vpre : 0;
                    activos.forEach(a => { Vi[a] *= factor; });
                }

                V = Vpost;

            } else {
                V = Vpre;
            }

            fechas.push(data[t]["Fecha"]);
            valores.push(V);

            if (V <= 0) break;
        }
    }

    return { fechas, valores, retornos, totalWithdrawn };
}


// ==========================
// GRÁFICO EVOLUCIÓN CON RETIROS
// ==========================
function graficarEvolucionRetiros(fechasSin, valoresSin, fechasCon, valoresCon) {

    const ctx = document.getElementById("withdrawalEvolutionChart");
    if (withdrawalEvolutionChart) withdrawalEvolutionChart.destroy();

    // Alinear serie "con retiros" al mismo eje X que "sin retiros"
    // Si el portafolio se agotó antes, rellenar con null
    const conPadded = [...valoresCon];
    while (conPadded.length < valoresSin.length) conPadded.push(null);

    withdrawalEvolutionChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: fechasSin,
            datasets: [
                {
                    label: "Sin retiros",
                    data: valoresSin,
                    borderColor: "#9ca3af",
                    borderWidth: 1.5,
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: "Con retiros",
                    data: conPadded,
                    borderColor: "#456db8",
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0,
                    spanGaps: false
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    labels: { usePointStyle: true, pointStyle: "circle" }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.raw === null) return null;
                            return ctx.dataset.label + ": $" + Math.round(ctx.raw).toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: v => "$" + Math.round(v).toLocaleString(),
                        color: "#666"
                    },
                    grid: { color: "rgba(0,0,0,0.05)" }
                },
                x: {
                    ticks: {
                        color: "#666",
                        maxTicksLimit: 12,
                        maxRotation: 0
                    },
                    grid: { display: false }
                }
            }
        }
    });
}


// ==========================
// FORWARD RETURNS CON RETIROS
// ==========================
function graficarForwardReturns(windowMeses, metrica = "retornoTotal") {

    const ctx = document.getElementById("forwardReturnChart");
    if (forwardReturnChart) forwardReturnChart.destroy();

    const { retornosMercado, fechas, withdrawal, initialValue } = forwardReturnData;
    const n      = retornosMercado.length;
    const labels = [];
    const dataPoints = [];

    for (let t = 0; t < n - windowMeses + 1; t++) {

        let V         = initialValue;
        let retirados = 0;

        for (let m = 0; m < windowMeses; m++) {
            V *= (1 + retornosMercado[t + m]);
            if ((m + 1) % 12 === 0) {
                const retiro = Math.min(V, withdrawal);
                retirados += retiro;
                V = Math.max(0, V - retiro);
            }
            if (V <= 0) { V = 0; break; }
        }

        const punto = metrica === "retornoTotal"
            ? (V + retirados) / initialValue - 1
            : V;

        labels.push(fechas[t]);
        dataPoints.push(punto);
    }

    const promedio = dataPoints.reduce((s, v) => s + v, 0) / dataPoints.length;

    const fmtY    = metrica === "retornoTotal"
        ? v => (v * 100).toFixed(0) + "%"
        : v => "$" + Math.round(v).toLocaleString();
    const fmtTip  = metrica === "retornoTotal"
        ? v => (v * 100).toFixed(1) + "%"
        : v => "$" + Math.round(v).toLocaleString();

    const mainLabel = metrica === "retornoTotal"
        ? `Retorno ${windowMeses / 12} años`
        : `Valor final ${windowMeses / 12} años`;

    const datasets = [
        {
            label: mainLabel,
            data: dataPoints,
            borderColor: "#456db8",
            borderWidth: 1.5,
            tension: 0.3,
            fill: false,
            pointRadius: 0
        },
        {
            label: "Promedio",
            data: labels.map(() => promedio),
            borderColor: "#f59e0b",
            borderWidth: 1.5,
            borderDash: [6, 3],
            tension: 0,
            fill: false,
            pointRadius: 0
        }
    ];

    if (metrica === "retornoTotal") {
        datasets.push({
            label: "_zero",
            data: labels.map(() => 0),
            borderColor: "rgba(200, 80, 80, 0.5)",
            borderWidth: 1,
            borderDash: [5, 4],
            tension: 0,
            fill: false,
            pointRadius: 0
        });
    }

    forwardReturnChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        filter: item => item.text !== "_zero",
                        usePointStyle: true,
                        pointStyle: "circle"
                    }
                },
                tooltip: {
                    filter: item => item.dataset.label !== "_zero",
                    callbacks: {
                        label: c => c.dataset.label + ": " + fmtTip(c.raw)
                    }
                }
            },
            scales: {
                y: {
                    ticks: { callback: fmtY, color: "#666" },
                    grid: { color: "rgba(0,0,0,0.05)" }
                },
                x: {
                    ticks: { color: "#666", maxTicksLimit: 10 },
                    grid: { display: false }
                }
            }
        }
    });
}


// ==========================
// ESTADÍSTICOS DE RETIROS
// ==========================
function calcularStatsRetiros(conRetiros, initialValue) {

    const { valores, retornos, totalWithdrawn } = conRetiros;

    const n      = retornos.length;                    // meses que duró el portafolio
    const vFinal = valores[valores.length - 1];

    // Retorno total: todo el valor generado (capital restante + lo cobrado)
    const retornoTotal      = (vFinal + totalWithdrawn) / initialValue - 1;
    // TWR: retornos pre-retiro ya calculados en calcularPortafolioConRetiros (estándar GIPS/CFA)
    const cum_twr           = retornos.reduce((acc, r) => acc * (1 + r), 1);
    const retornoAnualizado = Math.pow(Math.max(cum_twr, 0), 12 / n) - 1;

    // Ruina histórica
    const ruinaIdx  = valores.findIndex(v => v <= 0);
    const ruinaAnos = ruinaIdx !== -1 ? ruinaIdx / 12 : null;

    return { vFinal, totalWithdrawn, retornoTotal, retornoAnualizado, ruinaAnos };
}

function mostrarStatsRetiros(stats, initialValue, withdrawal) {

    const pct  = x => (x >= 0 ? "+" : "") + (x * 100).toFixed(2) + "%";
    const usd  = x => "$" + Math.round(x).toLocaleString();
    const tasaRetiro = withdrawal / initialValue;

    document.getElementById("withdrawalStats").innerHTML = `

        <!-- FILA 1: CAPITAL -->
        <div style="display:flex; gap:15px; margin-bottom:15px;">

            <div class="stat-box">
                <h4>Valor final</h4>
                <p>${usd(stats.vFinal)}</p>
            </div>

            <div class="stat-box">
                <h4>Total retirado</h4>
                <p>${usd(stats.totalWithdrawn)}</p>
            </div>

            <div class="stat-box">
                <h4>Tasa de retiro</h4>
                <p>${(tasaRetiro * 100).toFixed(2)}%</p>
                <small>del capital inicial</small>
            </div>

            <div class="stat-box">
                <h4>Retorno total</h4>
                <p>${pct(stats.retornoTotal)}</p>
                <small>(capital + retiros) / V₀</small>
            </div>

            <div class="stat-box">
                <h4>Retorno anualizado</h4>
                <p>${pct(stats.retornoAnualizado)}</p>
            </div>

            <div class="stat-box">
                <h4>Tiempo a ruina</h4>
                <p>${stats.ruinaAnos !== null
                    ? stats.ruinaAnos.toFixed(1) + " años"
                    : "No se agota"}</p>
            </div>

        </div>
    `;
}


// ==========================
// MONTE CARLO — SUPERVIVENCIA
// ==========================
function correrMCSupervivencia(retornos, initialValue, withdrawal) {

    const simulaciones = 3000;
    const horizontes   = [5, 10, 15, 20, 25, 30];
    const mesesMax     = 30 * 12;

    const capitalPorH  = {};
    const retiradoPorH = {};
    horizontes.forEach(h => { capitalPorH[h] = []; retiradoPorH[h] = []; });

    for (let i = 0; i < simulaciones; i++) {

        const camino = generarCaminoEstacionario(retornos, mesesMax, 0.083);
        let V = initialValue;
        let totalRetirado = 0;

        for (let t = 1; t <= mesesMax; t++) {

            V = Math.max(0, V * (1 + camino[t - 1]));

            if (t % 12 === 0) {
                const year = t / 12;

                if (V > 0) {
                    const retiro = Math.min(V, withdrawal);
                    totalRetirado += retiro;
                    V = Math.max(0, V - retiro);
                }

                if (horizontes.includes(year)) {
                    capitalPorH[year].push(V);
                    retiradoPorH[year].push(totalRetirado);
                }
            }
        }
    }

    function _pct(sorted, p) {
        const idx = Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1)));
        return sorted[idx];
    }

    function _std(arr) {
        const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
        return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length);
    }

    return horizontes.map(h => {
        const caps = capitalPorH[h];
        const rets = retiradoPorH[h];
        const n    = caps.length;

        const prob = caps.filter(v => v > 0).length / n;

        const retornosTotales     = caps.map((c, i) => (c + rets[i]) / initialValue);
        const retornosAnualizados = retornosTotales.map(r => Math.pow(Math.max(r, 0), 1 / h) - 1);

        const sortedCaps  = [...caps].sort((a, b) => a - b);
        const sortedTotal = [...retornosTotales].sort((a, b) => a - b);
        const sortedAnual = [...retornosAnualizados].sort((a, b) => a - b);

        return {
            years: h,
            prob,

            capitalP1:      _pct(sortedCaps, 1),
            capitalMediana: _pct(sortedCaps, 50),
            capitalP99:     _pct(sortedCaps, 99),

            retornoTotalP1:      _pct(sortedTotal, 1),
            retornoTotalMediana: _pct(sortedTotal, 50),
            retornoTotalP99:     _pct(sortedTotal, 99),
            retornoTotalStd:     _std(retornosTotales),

            retornoAnualP1:      _pct(sortedAnual, 1),
            retornoAnualMediana: _pct(sortedAnual, 50),
            retornoAnualP99:     _pct(sortedAnual, 99),
            retornoAnualStd:     _std(retornosAnualizados),
        };
    });
}

function mostrarSupervivencia(resultados) {

    const pct = x => (x * 100).toFixed(1) + "%";

    let html = `<div style="display:flex; gap:10px; flex-wrap:wrap;">`;

    resultados.forEach(r => {
        const color = r.prob >= 0.9 ? "#166534"
                    : r.prob >= 0.7 ? "#854d0e"
                    : "#991b1b";

        html += `
            <div class="stat-box">
                <h4>${r.years} años</h4>
                <p style="color:${color}; font-weight:600;">${pct(r.prob)}</p>
            </div>
        `;
    });

    html += `</div>`;
    document.getElementById("survivalStats").innerHTML = html;
}


// ==========================
// GRÁFICA INTERACTIVA MC
// ==========================
function renderMCViz(tipo) {

    if (!mcSupervivenciaData) return;

    const ctx = document.getElementById("mcVizChart");
    if (mcVizChart) mcVizChart.destroy();

    const labels = mcSupervivenciaData.map(d => d.years + " años");

    const fPct  = v => (v * 100).toFixed(1) + "%";
    const fMult = v => v.toFixed(2) + "x";
    const fUsd  = v => "$" + Math.round(v).toLocaleString();

    const scaleX = { ticks: { color: "#666" }, grid: { display: false } };
    const scaleY = (cb) => ({ ticks: { callback: cb, color: "#666" }, grid: { color: "rgba(0,0,0,0.05)" } });

    const lineDatasets = (p99key, medKey, p1key, fmt) => [
        {
            label: "Percentil 99%",
            data: mcSupervivenciaData.map(d => d[p99key]),
            borderColor: "#166534",
            tension: 0.3, pointRadius: 5, fill: false
        },
        {
            label: "Mediana",
            data: mcSupervivenciaData.map(d => d[medKey]),
            borderColor: "#456db8",
            tension: 0.3, pointRadius: 5, borderWidth: 2.5, fill: false
        },
        {
            label: "Percentil 1%",
            data: mcSupervivenciaData.map(d => d[p1key]),
            borderColor: "#991b1b",
            tension: 0.3, pointRadius: 5, fill: false
        }
    ];

    const lineOptions = (yCallback) => ({
        responsive: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { labels: { usePointStyle: true, pointStyle: "circle" } }
        },
        scales: { y: scaleY(yCallback), x: scaleX }
    });

    const tableHead = (cols) => `
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:5px;">
        <thead><tr style="background:#f1f5f9;">
            ${cols.map(([label, color]) =>
                `<th style="padding:10px 8px; text-align:${label === "Horizonte" ? "left" : "center"}; color:${color}; font-weight:600;">${label}</th>`
            ).join("")}
        </tr></thead><tbody>`;

    const tableClose = `</tbody></table>`;

    // ── SUPERVIVENCIA ──
    if (tipo === "supervivencia") {

        const probas   = mcSupervivenciaData.map(d => d.prob);
        const bgColors = probas.map(p =>
            p >= 0.9 ? "rgba(22,101,52,0.75)"
          : p >= 0.7 ? "rgba(133,77,14,0.75)"
          :            "rgba(153,27,27,0.75)"
        );

        mcVizChart = new Chart(ctx, {
            type: "bar",
            data: { labels, datasets: [{ label: "Prob. supervivencia", data: probas, backgroundColor: bgColors, borderRadius: 6 }] },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: c => fPct(c.raw) } }
                },
                scales: {
                    y: { min: 0, max: 1, ticks: { callback: v => (v * 100) + "%", color: "#666" }, grid: { color: "rgba(0,0,0,0.05)" } },
                    x: scaleX
                }
            }
        });

        let html = tableHead([["Horizonte","#555"],["Prob. supervivencia","#555"],["Nivel","#555"]]);
        mcSupervivenciaData.forEach(d => {
            const c = d.prob >= 0.9 ? "#166534" : d.prob >= 0.7 ? "#854d0e" : "#991b1b";
            const n = d.prob >= 0.9 ? "Alta"     : d.prob >= 0.7 ? "Moderada" : "Baja";
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 8px; font-weight:600;">${d.years} años</td>
                <td style="padding:9px 8px; text-align:center; color:${c}; font-weight:600;">${fPct(d.prob)}</td>
                <td style="padding:9px 8px; text-align:center; color:${c};">${n}</td>
            </tr>`;
        });
        document.getElementById("mcVizStats").innerHTML = html + tableClose;

    // ── RETORNO TOTAL ──
    } else if (tipo === "retornoTotal") {

        mcVizChart = new Chart(ctx, {
            type: "line",
            data: { labels, datasets: lineDatasets("retornoTotalP99","retornoTotalMediana","retornoTotalP1", fMult) },
            options: {
                ...lineOptions(v => v.toFixed(1) + "x"),
                plugins: {
                    ...lineOptions().plugins,
                    tooltip: { callbacks: { label: c => c.dataset.label + ": " + fMult(c.raw) } }
                }
            }
        });

        let html = tableHead([["Horizonte","#555"],["Percentil 1%","#991b1b"],["Mediana","#456db8"],["Percentil 99%","#166534"],["Desvío est.","#555"]]);
        mcSupervivenciaData.forEach(d => {
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 8px; font-weight:600;">${d.years} años</td>
                <td style="padding:9px 8px; text-align:center; color:#991b1b;">${fMult(d.retornoTotalP1)}</td>
                <td style="padding:9px 8px; text-align:center; color:#456db8; font-weight:600;">${fMult(d.retornoTotalMediana)}</td>
                <td style="padding:9px 8px; text-align:center; color:#166534;">${fMult(d.retornoTotalP99)}</td>
                <td style="padding:9px 8px; text-align:center; color:#555;">${fMult(d.retornoTotalStd)}</td>
            </tr>`;
        });
        document.getElementById("mcVizStats").innerHTML = html + tableClose;

    // ── CAPITAL FINAL ──
    } else if (tipo === "capitalFinal") {

        mcVizChart = new Chart(ctx, {
            type: "line",
            data: { labels, datasets: lineDatasets("capitalP99","capitalMediana","capitalP1", fUsd) },
            options: {
                ...lineOptions(v => "$" + Math.round(v).toLocaleString()),
                plugins: {
                    ...lineOptions().plugins,
                    tooltip: { callbacks: { label: c => c.dataset.label + ": " + fUsd(c.raw) } }
                }
            }
        });

        let html = tableHead([["Horizonte","#555"],["Percentil 1%","#991b1b"],["Mediana","#456db8"],["Percentil 99%","#166534"]]);
        mcSupervivenciaData.forEach(d => {
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 8px; font-weight:600;">${d.years} años</td>
                <td style="padding:9px 8px; text-align:center; color:#991b1b;">${fUsd(d.capitalP1)}</td>
                <td style="padding:9px 8px; text-align:center; color:#456db8; font-weight:600;">${fUsd(d.capitalMediana)}</td>
                <td style="padding:9px 8px; text-align:center; color:#166534;">${fUsd(d.capitalP99)}</td>
            </tr>`;
        });
        document.getElementById("mcVizStats").innerHTML = html + tableClose;

    // ── RETORNO ANUALIZADO ──
    } else if (tipo === "retornoAnualizado") {

        mcVizChart = new Chart(ctx, {
            type: "line",
            data: { labels, datasets: lineDatasets("retornoAnualP99","retornoAnualMediana","retornoAnualP1", fPct) },
            options: {
                ...lineOptions(v => (v * 100).toFixed(1) + "%"),
                plugins: {
                    ...lineOptions().plugins,
                    tooltip: { callbacks: { label: c => c.dataset.label + ": " + fPct(c.raw) } }
                }
            }
        });

        let html = tableHead([["Horizonte","#555"],["Percentil 1%","#991b1b"],["Mediana","#456db8"],["Percentil 99%","#166534"],["Desvío est.","#555"]]);
        mcSupervivenciaData.forEach(d => {
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 8px; font-weight:600;">${d.years} años</td>
                <td style="padding:9px 8px; text-align:center; color:#991b1b;">${fPct(d.retornoAnualP1)}</td>
                <td style="padding:9px 8px; text-align:center; color:#456db8; font-weight:600;">${fPct(d.retornoAnualMediana)}</td>
                <td style="padding:9px 8px; text-align:center; color:#166534;">${fPct(d.retornoAnualP99)}</td>
                <td style="padding:9px 8px; text-align:center; color:#555;">${fPct(d.retornoAnualStd)}</td>
            </tr>`;
        });
        document.getElementById("mcVizStats").innerHTML = html + tableClose;
    }
}


// ==========================
// RUN SIMULACIÓN CON RETIROS
// ==========================
function runWithdrawalSimulation() {

    mostrarRetiros();

    if (!marketDataNominal || marketDataNominal.length === 0) {
        alert("Datos no cargados");
        return;
    }

    const initialValue = parseFloat(document.getElementById("initialValue").value);
    const withdrawal   = parseFloat(document.getElementById("withdrawalAmount").value) || 0;
    const weights      = getWeights();
    const returnType   = document.getElementById("returnType").value;
    const rebalanceo   = document.getElementById("rebalanceo").value;

    // Misma fuente que acumulación: real o nominal según selección del usuario
    const dataToUse = returnType === "real" ? marketDataReal : marketDataNominal;

    // Serie sin retiros
    const sinRetiros = calcularPortafolio(dataToUse, weights, initialValue, rebalanceo);

    // Serie con retiros (retornos ya son reales o nominales según dataToUse)
    const conRetiros = calcularPortafolioConRetiros(dataToUse, weights, initialValue, rebalanceo, withdrawal);

    // Gráfico evolución
    graficarEvolucionRetiros(
        sinRetiros.fechas, sinRetiros.valores,
        conRetiros.fechas, conRetiros.valores
    );

    // Gráfico forward returns
    forwardReturnData = { retornosMercado: sinRetiros.retornos, fechas: sinRetiros.fechas, withdrawal, initialValue };
    document.getElementById("forwardReturnWindow").value = "60";
    document.getElementById("forwardReturnMetric").value = "retornoTotal";
    graficarForwardReturns(60, "retornoTotal");

    // Estadísticos históricos
    const stats = calcularStatsRetiros(conRetiros, initialValue);
    mostrarStatsRetiros(stats, initialValue, withdrawal);

    // Monte Carlo supervivencia
    mcSupervivenciaData = correrMCSupervivencia(conRetiros.retornos, initialValue, withdrawal);
    mostrarSupervivencia(mcSupervivenciaData);
    document.getElementById("mcVizSelect").value = "supervivencia";
    renderMCViz("supervivencia");

    graficarComposicion(document.getElementById('composicionSelector').value);
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
                    label: "Percentil 99%",
                    data: p99,
                    borderWidth: 1,
                    borderColor: 'rgba(150,150,150,0.5)',
                    borderDash: [5,5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0
                 },
                 {
                    label: "Percentil 1%",
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
                <p>Percentil 1%: ${pct(r.p1)}</p>
                <p>Percentil 99%: ${pct(r.p99)}</p>
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
        for (let i = window; i <= retornos.length; i++) {

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

    for (let i = window; i <= retornos.length; i++) {

        let total = 1;

        for (let j = i - window; j < i; j++) {
            total *= (1 + retornos[j]);
        }

        rolling.push(total - 1);
        rollingFechas.push(fechas[i]);
    }

    return { rolling, rollingFechas };
}

// ==========================
// COMPOSICIÓN DEL PORTAFOLIO
// ==========================
const DIMENSION_KEY_MAP = {
    sectores: 'sectors',
    regiones: 'regions',
    monedas: 'currencies',
    calificacion_crediticia: 'credit_rating'
};

function calcularComposicionPortafolio(weights, dimension) {

    if (!window.assetsData) return { labels: [], values: [] };

    const dimensionKey = DIMENSION_KEY_MAP[dimension];
    const exposicion = {};

    const rfActivos = ["Renta Fija Global IG", "Renta Fija Global HY", "Renta Fija EM"];

    if (dimension === 'calificacion_crediticia') {

        const totalRF = rfActivos.reduce((s, a) => s + (weights[a] || 0), 0);

        if (totalRF === 0) return { labels: [], values: [], sinRF: true };

        rfActivos.forEach(activo => {
            const pesoRF = (weights[activo] || 0) / totalRF;
            if (pesoRF === 0) return;
            const assetData = window.assetsData[activo];
            if (!assetData || !assetData[dimensionKey]) return;
            assetData[dimensionKey].forEach(item => {
                if (!exposicion[item.name]) exposicion[item.name] = 0;
                exposicion[item.name] += pesoRF * item.weight;
            });
        });

        const duracion = rfActivos.reduce((s, a) => {
            const pesoRF = (weights[a] || 0) / totalRF;
            const d = window.assetsData[a] ? (window.assetsData[a].duration || 0) : 0;
            return s + pesoRF * d;
        }, 0);

        const ytmActivos = rfActivos.filter(a => window.assetsData[a] && window.assetsData[a].ytm !== null && window.assetsData[a].ytm !== undefined);
        const totalRF_ytm = ytmActivos.reduce((s, a) => s + (weights[a] || 0), 0);
        let ytmLine = '';
        if (totalRF_ytm > 0) {
            const ytm = ytmActivos.reduce((s, a) => {
                const pesoRF_ytm = (weights[a] || 0) / totalRF_ytm;
                return s + pesoRF_ytm * window.assetsData[a].ytm;
            }, 0);
            ytmLine = `<br>Rendimiento al vencimiento promedio: ${ytm.toFixed(2)}%`;
        }

        const el = document.getElementById('duracionInfo');
        el.innerHTML = `Duración promedio de Renta Fija: ${duracion.toFixed(1)} años${ytmLine}`;
        el.style.display = 'block';

    } else {

        document.getElementById('duracionInfo').style.display = 'none';

        Object.keys(weights).forEach(activo => {
            if (weights[activo] <= 0) return;
            const assetData = window.assetsData[activo];
            if (!assetData || !assetData[dimensionKey]) return;
            assetData[dimensionKey].forEach(item => {
                if (!exposicion[item.name]) exposicion[item.name] = 0;
                exposicion[item.name] += weights[activo] * item.weight;
            });
        });
    }

    const CREDIT_ORDER = [
        'AAA','AA','A','BBB','BB','B','CCC','CC','C','DDD','DD','D','Sin Calificación'
    ];

    const entries = Object.entries(exposicion).filter(([, v]) => v > 0);

    if (dimension === 'calificacion_crediticia') {
        entries.sort((a, b) => {
            const ia = CREDIT_ORDER.indexOf(a[0]);
            const ib = CREDIT_ORDER.indexOf(b[0]);
            const orderA = ia === -1 ? 999 : ia;
            const orderB = ib === -1 ? 999 : ib;
            return orderA - orderB;
        });
    } else {
        entries.sort((a, b) => b[1] - a[1]);
    }

    return {
        labels: entries.map(e => e[0]),
        values: entries.map(e => e[1])
    };
}

function graficarComposicion(dimension) {

    const weights = getWeights();
    const result = calcularComposicionPortafolio(weights, dimension);

    if (composicionChartInstance) {
        composicionChartInstance.destroy();
        composicionChartInstance = null;
    }

    const ctx = document.getElementById('composicionChart');

    if (result.sinRF) {
        document.getElementById('duracionInfo').textContent = 'Sin renta fija en el portafolio';
        document.getElementById('duracionInfo').style.display = 'block';
        document.getElementById('composicionLegend').innerHTML = '';
        return;
    }

    if (result.labels.length === 0) {
        document.getElementById('composicionLegend').innerHTML = '';
        return;
    }

    const colors = result.labels.map((_, i) => COMPOSICION_COLORS[i % COMPOSICION_COLORS.length]);

    composicionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: result.labels,
            datasets: [{
                data: result.values,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? (context.raw / total * 100).toFixed(1) : 0;
                            return `${context.label}: ${pct}%`;
                        }
                    }
                }
            }
        }
    });

    // Leyenda HTML externa
    const total = result.values.reduce((a, b) => a + b, 0);
    const legendEl = document.getElementById('composicionLegend');
    legendEl.innerHTML = result.labels.map((label, i) => {
        const pct = total > 0 ? (result.values[i] / total * 100).toFixed(1) : 0;
        const color = colors[i];
        return `<div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#444; line-height:1.3;">
            <span style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0; display:inline-block;"></span>
            <span>${label} — ${pct}%</span>
        </div>`;
    }).join('');
}

const DIMENSION_TITLES = {
    sectores: 'Sectores',
    regiones: 'Regiones',
    monedas: 'Monedas',
    calificacion_crediticia: 'Calificación Crediticia'
};

document.addEventListener('DOMContentLoaded', function() {
    const sel = document.getElementById('composicionSelector');
    if (sel) {
        sel.addEventListener('change', function() {
            document.getElementById('composicionTitle').textContent = DIMENSION_TITLES[this.value] || this.value;
            graficarComposicion(this.value);
        });
    }
});

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
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    ticks: {
                        callback: v => (v * 100).toFixed(1) + "%",
                        color: '#666'
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: {
                        color: '#666',
                        maxTicksLimit: 12,
                        maxRotation: 0
                    },
                    grid: { display: false }
                }
            }
        }
    });
}


// ==========================
// FRONTERA EFICIENTE
// ==========================

// Acciones USA/Europa/EM → azules | RF IG/HY/EM → verdes | resto → grises
const FRONTIER_COLORS = [
  '#1e3a8a', // Acciones USA      — azul oscuro
  '#2563eb', // Acciones Europa   — azul medio
  '#93c5fd', // Acciones EM       — azul claro
  '#14532d', // RF Global IG      — verde oscuro
  '#16a34a', // RF Global HY      — verde medio
  '#86efac', // RF EM             — verde claro
  '#1f2937', // Money Market      — gris muy oscuro
  '#4b5563', // Real Estate       — gris oscuro
  '#6b7280', // Infrastructure    — gris medio
  '#9ca3af', // Oro               — gris claro
  '#d1d5db'  // Commodities       — gris muy claro
];

var _frontierSlidersBound = false;

function iniciarOptimizerWorker(marketData, isReal) {
  if (!window.Worker) {
    var el = document.getElementById('frontierLoadingState');
    if (el) el.textContent = 'Tu browser no soporta Web Workers. Actualizá el browser.';
    return;
  }
  if (!isReal) mostrarFrontierSpinner(true);
  var worker = new Worker('optimizerWorker.js');
  worker.postMessage({ marketData: marketData });
  worker.onmessage = function(e) {
    if (e.data.error) {
      console.error('Optimizer error:', e.data.error);
      if (!isReal) mostrarFrontierSpinner(false);
      return;
    }
    if (isReal) {
      frontierCacheDataReal = e.data;
      var rt = document.getElementById('returnType');
      var esReal = rt && rt.value === 'real';
      // Si el usuario está en acumulación con "real", redibujar frontera
      var accView = document.getElementById('accumulationView');
      if (esReal && accView && accView.style.display !== 'none') {
        renderEfficientFrontier(e.data);
      }
      // (goals view has no vol slider in the new version)
    } else {
      frontierCacheData = e.data;
      renderEfficientFrontier(e.data);
      mostrarFrontierSpinner(false);
      registrarSliderListenersFrontera();
    }
    worker.terminate();
  };
  worker.onerror = function(e) {
    console.error('Worker error:', e);
    if (!isReal) mostrarFrontierSpinner(false);
  };
}

function mostrarFrontierSpinner(visible) {
  var spinner = document.getElementById('frontierLoadingState');
  var container = document.getElementById('frontierChartContainer');
  if (!spinner || !container) return;
  if (visible) {
    spinner.style.display = 'flex';
    container.style.display = 'none';
  } else {
    spinner.style.display = 'none';
    container.style.display = 'block';
  }
}

function registrarSliderListenersFrontera() {
  if (_frontierSlidersBound) return;
  _frontierSlidersBound = true;
  Object.values(slidersMap).forEach(function(slider) {
    slider.addEventListener('input', actualizarPuntoPortafolio);
  });
}

function actualizarPuntoPortafolio() {
  var cache = _activeFrontierCache();
  if (!cache || !efficientFrontierChartInstance) return;
  var weights = getWeights();
  var mu = cache.mu;
  var Sigma = cache.Sigma;
  var assets = cache.assets;
  var w = assets.map(function(a) { return weights[a] || 0; });

  var ret_p = w.reduce(function(sum, wi, i) { return sum + wi * mu[i]; }, 0);
  var var_p = 0;
  for (var i = 0; i < w.length; i++)
    for (var j = 0; j < w.length; j++)
      var_p += w[i] * Sigma[i][j] * w[j];
  var vol_p = Math.sqrt(Math.max(0, var_p));

  var ds = efficientFrontierChartInstance.data.datasets;
  ds[ds.length - 1].data = [{ x: vol_p * 100, y: ret_p * 100, weights: weights }];
  efficientFrontierChartInstance.update('none');
}

function renderEfficientFrontier(data) {
  if (efficientFrontierChartInstance) {
    efficientFrontierChartInstance.destroy();
    efficientFrontierChartInstance = null;
  }

  var frontierPoints = data.frontierPoints;
  var assetPoints = data.assetPoints;
  var mu = data.mu;
  var Sigma = data.Sigma;
  var assets = data.assets;
  var maxSharpeIndex = data.maxSharpeIndex;

  var weights0 = getWeights();
  var w0 = assets.map(function(a) { return weights0[a] || 0; });
  var ret_p0 = w0.reduce(function(s, wi, i) { return s + wi * mu[i]; }, 0);
  var var_p0 = 0;
  for (var ii = 0; ii < w0.length; ii++)
    for (var jj = 0; jj < w0.length; jj++)
      var_p0 += w0[ii] * Sigma[ii][jj] * w0[jj];
  var vol_p0 = Math.sqrt(Math.max(0, var_p0));

  var datasets = [];

  datasets.push({
    type: 'scatter',
    showLine: true,
    tension: 0.3,
    label: 'Frontera eficiente',
    data: frontierPoints.map(function(p) { return { x: p.vol * 100, y: p.ret * 100, weights: p.weights }; }),
    borderColor: '#64748b',
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 5,
    fill: false
  });

  assetPoints.forEach(function(ap, i) {
    datasets.push({
      type: 'scatter',
      showLine: false,
      label: ap.nombre,
      data: [{ x: ap.vol * 100, y: ap.ret * 100, nombre: ap.nombre }],
      pointStyle: 'rectRot',
      pointRadius: 7,
      pointHoverRadius: 9,
      backgroundColor: FRONTIER_COLORS[i % FRONTIER_COLORS.length],
      borderColor: FRONTIER_COLORS[i % FRONTIER_COLORS.length]
    });
  });

  datasets.push({
    type: 'scatter',
    showLine: false,
    label: 'Mi portafolio',
    data: [{ x: vol_p0 * 100, y: ret_p0 * 100, weights: weights0 }],
    pointStyle: 'circle',
    pointRadius: 11,
    pointHoverRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#1e293b',
    borderWidth: 2.5
  });

  var ctx = document.getElementById('efficientFrontierChart');
  efficientFrontierChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          title: { display: true, text: 'Volatilidad anualizada (%)' },
          ticks: { callback: function(v) { return v.toFixed(1) + '%'; } },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          title: { display: true, text: 'Retorno anualizado (%)' },
          ticks: { callback: function(v) { return v.toFixed(1) + '%'; } },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });

  _setupFrontierTooltip(efficientFrontierChartInstance, ctx, assets, data);
  _renderFrontierLegend(assets, frontierPoints);
}

function _assetColorMap(assets) {
  var map = {};
  assets.forEach(function(a, i) { map[a] = FRONTIER_COLORS[i % FRONTIER_COLORS.length]; });
  return map;
}

function _compositionRows(weightsObj, colorMap) {
  var entries = Object.entries(weightsObj)
    .filter(function(e) { return e[1] > 0; })
    .sort(function(a, b) { return b[1] - a[1]; });

  return entries.map(function(e) {
    var pct = (e[1] * 100).toFixed(1);
    var barW = Math.round(e[1] * 80);
    var color = colorMap[e[0]] || '#999';
    return '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">' +
      '<div style="width:' + barW + 'px;min-width:2px;height:3px;border-radius:2px;background:' + color + ';flex-shrink:0;"></div>' +
      '<span style="font-size:12px;color:#444;">' + e[0] + '</span>' +
      '<span style="font-size:12px;color:#888;margin-left:auto;padding-left:8px;">' + pct + '%</span>' +
      '</div>';
  }).join('');
}

function _setupFrontierTooltip(chartInst, canvas, assets, data) {
  var tooltip = document.getElementById('frontierTooltip');
  var container = document.getElementById('frontierChartContainer');
  if (!tooltip || !container) return;

  var colorMap = _assetColorMap(assets);
  var SEP = '<hr style="border:none;border-top:1px solid #eee;margin:8px 0;">';

  canvas.addEventListener('mousemove', function(e) {
    var elements = chartInst.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
    if (!elements.length) { tooltip.style.display = 'none'; return; }

    var el = elements[0];
    var dsIdx = el.datasetIndex;
    var ds = chartInst.data.datasets[dsIdx];
    var pt = ds.data[el.index];
    var retStr = pt.y.toFixed(2) + '%';
    var volStr = pt.x.toFixed(2) + '%';
    var totalDatasets = chartInst.data.datasets.length;
    var html = '';

    if (dsIdx === 0) {
      html = '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">Portafolio eficiente</div>';
      html += '<div style="font-size:12px;color:#555;">Retorno: <b>' + retStr + '</b></div>';
      html += '<div style="font-size:12px;color:#555;">Volatilidad: <b>' + volStr + '</b></div>';
      if (pt.weights && Object.keys(pt.weights).length) html += SEP + _compositionRows(pt.weights, colorMap);
    } else if (dsIdx === totalDatasets - 1) {
      html = '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">Mi portafolio</div>';
      html += '<div style="font-size:12px;color:#555;">Retorno: <b>' + retStr + '</b></div>';
      html += '<div style="font-size:12px;color:#555;">Volatilidad: <b>' + volStr + '</b></div>';
      if (pt.weights) html += SEP + _compositionRows(pt.weights, colorMap);
    } else {
      var nombre = pt.nombre || ds.label;
      html = '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">' + nombre + '</div>';
      html += '<div style="font-size:12px;color:#555;">Retorno: <b>' + retStr + '</b></div>';
      html += '<div style="font-size:12px;color:#555;">Volatilidad: <b>' + volStr + '</b></div>';
      var singleW = {}; singleW[nombre] = 1;
      html += SEP + _compositionRows(singleW, colorMap);
    }

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';

    var rect = container.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    var left = mouseX > rect.width / 2 ? mouseX - 254 : mouseX + 14;
    tooltip.style.left = left + 'px';
    tooltip.style.top = Math.max(0, mouseY - 20) + 'px';
  });

  canvas.addEventListener('mouseleave', function() {
    tooltip.style.display = 'none';
  });
}

function _renderFrontierLegend(assets, frontierPoints) {
  var legendEl = document.getElementById('frontierLegend');
  if (!legendEl) return;

  var usedAssets = {};
  frontierPoints.forEach(function(p) {
    Object.keys(p.weights || {}).forEach(function(k) { usedAssets[k] = true; });
  });

  var html = '';
  assets.forEach(function(a, i) {
    var color = FRONTIER_COLORS[i % FRONTIER_COLORS.length];
    var opacity = usedAssets[a] ? '1' : '0.4';
    html += '<div style="display:flex;align-items:center;gap:5px;opacity:' + opacity + ';">' +
      '<div style="width:10px;height:10px;background:' + color + ';border-radius:2px;flex-shrink:0;"></div>' +
      '<span style="font-size:12px;color:#444;">' + a + '</span></div>';
  });

  html += '<div style="display:flex;align-items:center;gap:5px;">' +
    '<div style="width:10px;height:10px;background:rgba(255,255,255,0.95);border:2px solid #1e293b;border-radius:50%;flex-shrink:0;box-sizing:border-box;"></div>' +
    '<span style="font-size:12px;color:#444;">Mi portafolio</span></div>';

  legendEl.innerHTML = html;
}


// ── Frontier cache helper (used by efficient frontier chart) ──────────────────

function _activeFrontierCache() {
  var rt = document.getElementById('returnType');
  return (rt && rt.value === 'real') ? frontierCacheDataReal : frontierCacheData;
}


