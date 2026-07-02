'use strict';

// ── Constantes de layout ──────────────────────────────────────────────────────
var _PDF_M  = 14;          // margen izquierdo/derecho (mm)
var _PDF_W  = 210;         // ancho A4
var _PDF_H  = 297;         // alto A4
var _PDF_CW = _PDF_W - 2 * _PDF_M; // ancho útil = 182mm

// ── Entrada pública ───────────────────────────────────────────────────────────
function exportarPDF() {
  if (typeof window.jspdf === 'undefined') {
    alert('La librería jsPDF no está disponible. Verificá la conexión a internet.');
    return;
  }
  var btn = document.getElementById('pdf-export-btn');
  if (btn) { btn.textContent = 'Generando…'; btn.disabled = true; }

  // Diferir para que el browser repinte el botón antes de bloquear con toDataURL
  setTimeout(function() {
    try {
      var view = _pdfVistaActiva();
      var doc  = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      var y    = _pdfHeader(doc, view);

      if      (view === 'accumulation') _pdfAcumulacion(doc, y);
      else if (view === 'withdrawal')   _pdfRetiros(doc, y);
      else if (view === 'goals')        _pdfObjetivos(doc, y);

      // Footer en todas las páginas
      var totalPages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(6.5);
        doc.setTextColor(160, 160, 160);
        doc.text(
          'Sólo con fines ilustrativos. No constituye asesoramiento financiero.',
          _PDF_M, _PDF_H - 4
        );
        doc.text(p + ' / ' + totalPages, _PDF_W - _PDF_M, _PDF_H - 4, { align: 'right' });
      }

      var d = new Date();
      var stamp = d.getFullYear() + ('0'+(d.getMonth()+1)).slice(-2) + ('0'+d.getDate()).slice(-2);
      doc.save('simulacion-portafolio-' + stamp + '.pdf');
    } catch(err) {
      alert('Error al generar PDF: ' + err.message);
    } finally {
      if (btn) { btn.innerHTML = _pdfBtnContent(); btn.disabled = false; }
    }
  }, 50);
}

function _pdfBtnContent() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>Exportar PDF';
}

// ── Vista activa ──────────────────────────────────────────────────────────────
function _pdfVistaActiva() {
  var gv = document.getElementById('goalsView');
  var wv = document.getElementById('withdrawalView');
  if (gv && gv.style.display !== 'none') return 'goals';
  if (wv && wv.style.display !== 'none') return 'withdrawal';
  return 'accumulation';
}

// ── Header ────────────────────────────────────────────────────────────────────
function _pdfHeader(doc, view) {
  var titles = {
    accumulation: 'Simulación de portafolio',
    withdrawal:   'Simulación de portafolio con retiros anuales',
    goals:        'Simulación de portafolio con Objetivos específicos'
  };
  var d   = new Date();
  var fecha = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();

  // Barra azul
  doc.setFillColor(69, 109, 184);
  doc.rect(0, 0, _PDF_W, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(titles[view] || 'Simulación de portafolio', _PDF_M, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Portfolio Simulator', _PDF_M, 18);
  doc.text(fecha, _PDF_W - _PDF_M, 18, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  return 30;
}

// ── Helpers de layout ─────────────────────────────────────────────────────────
function _pdfNewPage(doc, y, needed) {
  if (y + needed > _PDF_H - 12) { doc.addPage(); return _PDF_M; }
  return y;
}

function _pdfTitle(doc, text, y) {
  y = _pdfNewPage(doc, y, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(69, 109, 184);
  doc.text(text, _PDF_M, y);
  doc.setDrawColor(69, 109, 184);
  doc.setLineWidth(0.3);
  doc.line(_PDF_M, y + 1.5, _PDF_M + _PDF_CW, y + 1.5);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.2);
  return y + 7;
}

function _pdfCanvas(doc, id, y, w, maxH) {
  var cv = document.getElementById(id);
  if (!cv || !cv.width || !cv.height) return y;
  var cw = w || _PDF_CW;
  var ch = Math.min(maxH || 80, cw * cv.height / cv.width);
  y = _pdfNewPage(doc, y, ch + 3);
  try { doc.addImage(cv.toDataURL('image/png'), 'PNG', _PDF_M, y, cw, ch); } catch(e) {}
  return y + ch + 4;
}

// Tarjetas de stats (.stat-box dentro del contenedor)
function _pdfStatBoxes(doc, containerId, y) {
  var el = document.getElementById(containerId);
  if (!el) return y;
  var boxes = Array.from(el.querySelectorAll('.stat-box'));
  if (!boxes.length) return y;

  var cols  = Math.min(boxes.length, 4);
  var gap   = 3;
  var cardW = (_PDF_CW - gap * (cols - 1)) / cols;
  var cardH = 22;

  var row = 0, col = 0;
  y = _pdfNewPage(doc, y, cardH + 4);
  var rowY = y;

  boxes.forEach(function(box, bi) {
    if (col >= cols) { col = 0; row++; rowY += cardH + gap; y = _pdfNewPage(doc, rowY, cardH + 4); rowY = y; }
    var x = _PDF_M + col * (cardW + gap);

    doc.setFillColor(248, 249, 250);
    doc.roundedRect(x, rowY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, rowY, cardW, cardH, 2, 2, 'S');

    var h4    = box.querySelector('h4');
    var p     = box.querySelector('p');
    var small = box.querySelector('small');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(h4 ? h4.innerText.trim() : '', x + 3, rowY + 6);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(p ? p.innerText.trim() : '', x + 3, rowY + 13);

    if (small) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      var sub = small.innerText.trim().replace(/\n+/g, ' • ');
      doc.text(sub, x + 3, rowY + 18.5, { maxWidth: cardW - 4 });
    }
    col++;
  });

  doc.setTextColor(0, 0, 0);
  return rowY + cardH + 5;
}

// Tabla HTML genérica
function _pdfTable(doc, el, y) {
  if (!el) return y;
  var table = el.querySelector ? el.querySelector('table') : null;
  if (!table) return _pdfStatBoxes(doc, el.id || '', y);

  var rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) return y;

  var rowH = 7;
  y = _pdfNewPage(doc, y, Math.min(rows.length, 6) * rowH + 4);

  rows.forEach(function(row, ri) {
    if (y + rowH > _PDF_H - 12) { doc.addPage(); y = _PDF_M; }
    var cells   = Array.from(row.querySelectorAll('th, td'));
    var isHead  = ri === 0 || row.querySelector('th');
    var colW    = _PDF_CW / cells.length;

    if (isHead) {
      doc.setFillColor(69, 109, 184);
      doc.rect(_PDF_M, y, _PDF_CW, rowH, 'F');
    } else if (ri % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(_PDF_M, y, _PDF_CW, rowH, 'F');
    }

    cells.forEach(function(cell, ci) {
      var txt    = cell.innerText.trim();
      var isLeft = ci === 0;
      doc.setFontSize(7);
      doc.setFont('helvetica', isHead ? 'bold' : 'normal');
      doc.setTextColor(isHead ? 255 : 40, isHead ? 255 : 40, isHead ? 255 : 40);
      var xTxt = isLeft ? _PDF_M + ci * colW + 2 : _PDF_M + ci * colW + colW / 2;
      doc.text(txt, xTxt, y + rowH - 2, {
        align: isLeft ? 'left' : 'center',
        maxWidth: colW - 2
      });
    });

    doc.setDrawColor(220, 220, 220);
    doc.line(_PDF_M, y + rowH, _PDF_M + _PDF_CW, y + rowH);
    y += rowH;
  });

  doc.setTextColor(0, 0, 0);
  return y + 5;
}

function _pdfTableById(doc, id, y) {
  return _pdfTable(doc, document.getElementById(id), y);
}

// Drawdown cards (.dd-card)
function _pdfDrawdownCards(doc, y) {
  var el = document.getElementById('drawdownCards');
  if (!el) return y;
  var cards = Array.from(el.querySelectorAll('.dd-card'));
  if (!cards.length) return y;

  var n     = cards.length;
  var cardW = (_PDF_CW - (n - 1) * 4) / n;
  var cardH = 38;
  y = _pdfNewPage(doc, y, cardH + 4);

  cards.forEach(function(card, ci) {
    var x = _PDF_M + ci * (cardW + 4);

    doc.setFillColor(248, 249, 250);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'S');

    var titleEl = card.querySelector('.dd-title');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(69, 109, 184);
    doc.text(titleEl ? titleEl.innerText.trim() : '', x + 3, y + 6);

    var depthEl = card.querySelector('.dd-depth');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 30, 30);
    doc.text(depthEl ? depthEl.innerText.trim() : '', x + 3, y + 14);

    var datesEl = card.querySelector('.dd-dates');
    if (datesEl) {
      var lines = datesEl.innerText.trim().split('\n').map(function(s){return s.trim();}).filter(Boolean);
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
      lines.forEach(function(ln, i){ doc.text(ln, x+3, y+21+i*4.5, {maxWidth: cardW-4}); });
    }
    var extraEl = card.querySelector('.dd-extra');
    if (extraEl) {
      var elines = extraEl.innerText.trim().split('\n').map(function(s){return s.trim();}).filter(Boolean);
      doc.setFontSize(6.5); doc.setTextColor(80,80,80);
      elines.forEach(function(ln, i){ doc.text(ln, x+3, y+32+i*3.5, {maxWidth: cardW-4}); });
    }
  });

  doc.setTextColor(0, 0, 0);
  return y + cardH + 5;
}

// Círculo de color relleno (para leyendas)
function _pdfColorDot(doc, color, x, y, r) {
  // Parsear color hex o rgb a componentes R,G,B
  var r_, g_, b_;
  var m = color.match(/^#([0-9a-fA-F]{6})$/);
  if (m) {
    r_ = parseInt(m[1].substr(0,2),16);
    g_ = parseInt(m[1].substr(2,2),16);
    b_ = parseInt(m[1].substr(4,2),16);
  } else {
    var rm = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rm) { r_ = +rm[1]; g_ = +rm[2]; b_ = +rm[3]; }
    else { r_ = 136; g_ = 136; b_ = 136; }
  }
  doc.setFillColor(r_, g_, b_);
  doc.circle(x + r, y + r, r, 'F');
}

// Survival stats (tarjetas coloreadas por horizonte)
function _pdfSurvivalStats(doc, y) {
  var el = document.getElementById('survivalStats');
  if (!el || !el.innerText.trim()) return y;

  var cards = Array.from(el.children).filter(function(c){ return c.tagName !== 'H3' && c.tagName !== 'H4'; });
  if (!cards.length) return y;

  var n     = Math.min(cards.length, 6);
  var cardW = (_PDF_CW - (n-1)*3) / n;
  var cardH = 26;
  y = _pdfNewPage(doc, y, cardH + 4);

  cards.slice(0, n).forEach(function(card, ci) {
    var x    = _PDF_M + ci * (cardW + 3);
    var text = card.innerText.trim().split('\n').map(function(s){return s.trim();}).filter(Boolean);

    // Detectar color según probabilidad
    var probStr = text.find(function(l){ return l.includes('%'); }) || '';
    var prob    = parseFloat(probStr);
    var bg = prob >= 90 ? [220,252,231] : prob >= 70 ? [254,243,199] : [254,226,226];

    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');

    // Horizonte (1ª línea)
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
    doc.text(text[0] || '', x + cardW/2, y+7, {align:'center', maxWidth:cardW-2});

    // Probabilidad (2ª línea)
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30);
    doc.text(text[1] || '', x + cardW/2, y+16, {align:'center', maxWidth:cardW-2});

    // Nivel (3ª línea)
    if (text[2]) {
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
      doc.text(text[2], x + cardW/2, y+22, {align:'center', maxWidth:cardW-2});
    }
  });

  doc.setTextColor(0, 0, 0);
  return y + cardH + 5;
}

// ── Resumen GBI ───────────────────────────────────────────────────────────────
function _pdfGbiCapitalSummary(doc, y) {
  var d = window._gbiLastResult;
  if (!d) return y;
  var W0 = d._W0 || 0;

  var items = [
    { label: 'Capital total',          value: '$' + Math.round(W0).toLocaleString() },
    { label: 'Asignado a objetivos',   value: '$' + Math.round(d.AGoals || 0).toLocaleString() },
    { label: 'Growth Portfolio',       value: '$' + Math.round(d.AG || 0).toLocaleString() },
    { label: 'Prob. conjunta',         value: (((d.jointProb || 0) * 100).toFixed(1)) + '%' }
  ];

  var cardW = (_PDF_CW - 3*4) / 4;
  var cardH = 20;
  y = _pdfNewPage(doc, y, cardH + 4);

  items.forEach(function(item, i) {
    var x = _PDF_M + i * (cardW + 4);
    doc.setFillColor(235, 243, 255);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
    doc.text(item.label, x+3, y+7);
    doc.setFontSize(10.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30);
    doc.text(item.value, x+3, y+15);
  });

  doc.setTextColor(0, 0, 0);
  return y + cardH + 5;
}

function _pdfGbiGoalCards(doc, y) {
  var d = window._gbiLastResult;
  if (!d || !d.goalResults) return y;

  d.goalResults.forEach(function(g) {
    var cardH = 30;
    y = _pdfNewPage(doc, y, cardH + 4);

    doc.setFillColor(248, 249, 250);
    doc.roundedRect(_PDF_M, y, _PDF_CW, cardH, 2, 2, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(_PDF_M, y, _PDF_CW, cardH, 2, 2, 'S');

    doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30);
    doc.text(g.nombre, _PDF_M + 4, y + 8);

    var items = [
      { l:'Objetivo',       v:'$'+Math.round(g.Gk).toLocaleString() },
      { l:'Capital asign.', v:'$'+Math.round(g.Ak).toLocaleString() },
      { l:'Plazo',          v:g.Tk+' años' },
      { l:'Prob. éxito',   v:((g.Pk||0)*100).toFixed(1)+'%' },
      { l:'CVaR 95%',      v:'$'+Math.round(g.cvar||0).toLocaleString() },
      { l:'Ret. anual',    v:((g.retAnual||0)*100).toFixed(1)+'%' },
      { l:'Volatilidad',   v:((g.volAnual||0)*100).toFixed(1)+'%' }
    ];

    var bw = (_PDF_CW - 6) / items.length;
    items.forEach(function(s, i) {
      var bx = _PDF_M + 3 + i * bw;
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(120,120,120);
      doc.text(s.l, bx, y+17);
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30);
      doc.text(s.v, bx, y+24);
    });

    y += cardH + 4;
  });

  doc.setTextColor(0, 0, 0);
  return y;
}

function _pdfGbiGrowthCard(doc, y) {
  var d = window._gbiLastResult;
  if (!d || !d.growthResult) return y;
  var g = d.growthResult;

  var cardH = 24;
  y = _pdfNewPage(doc, y, cardH + 4);

  doc.setFillColor(230, 250, 235);
  doc.roundedRect(_PDF_M, y, _PDF_CW, cardH, 2, 2, 'F');

  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(22,101,52);
  doc.text('Growth Portfolio', _PDF_M + 4, y + 8);

  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
  doc.text(
    'Retorno esperado: ' + ((g.ret||0)*100).toFixed(1) + '% anual   ' +
    'Volatilidad: ' + ((g.vol||0)*100).toFixed(1) + '% anual',
    _PDF_M + 4, y + 15
  );

  var wStr = Object.entries(g.weights || {})
    .filter(function(e){ return e[1] > 0.005; })
    .sort(function(a,b){ return b[1]-a[1]; })
    .map(function(e){ return e[0]+': '+(e[1]*100).toFixed(0)+'%'; })
    .join('   ');
  doc.setFontSize(7);
  doc.text(wStr, _PDF_M + 4, y + 21, { maxWidth: _PDF_CW - 8 });

  doc.setTextColor(0, 0, 0);
  return y + cardH + 5;
}

// ── Vistas ────────────────────────────────────────────────────────────────────
function _pdfAcumulacion(doc, y) {
  // ── Las dos tortas lado a lado, mismo tamaño, leyenda debajo ────────────
  y = _pdfTitle(doc, 'Composición del portafolio', y);

  var allocCv = document.getElementById('allocationChart');
  var compCv  = document.getElementById('composicionChart');
  var pieW    = (_PDF_CW - 8) / 2;   // ancho de cada columna
  var rightX  = _PDF_M + pieW + 8;

  // ── Torta izquierda: ocultar leyenda interna de Chart.js para captura ──
  var allocDataUrl = '';
  var allocLabels  = [];
  var allocColors  = [];
  if (allocCv && allocCv.width) {
    var allocChart = (typeof Chart !== 'undefined') ? Chart.getChart(allocCv) : null;
    if (allocChart) {
      allocLabels = (allocChart.data && allocChart.data.labels) ? allocChart.data.labels.slice() : [];
      var allocVals = (allocChart.data && allocChart.data.datasets && allocChart.data.datasets[0])
        ? allocChart.data.datasets[0].data : [];
      allocColors = (allocChart.data && allocChart.data.datasets && allocChart.data.datasets[0])
        ? [].concat(allocChart.data.datasets[0].backgroundColor) : [];
      // Añadir porcentaje a cada label
      var allocTotal = allocVals.reduce(function(s,v){ return s+(+v||0); }, 0);
      allocLabels = allocLabels.map(function(lbl, i) {
        var pct = allocTotal > 0 ? (100 * (+allocVals[i]||0) / allocTotal).toFixed(1) : '0.0';
        return lbl + ' — ' + pct + '%';
      });
      var legCfg = (allocChart.options.plugins && allocChart.options.plugins.legend)
        ? allocChart.options.plugins.legend : (allocChart.options.legend || null);
      var prevDisplay = legCfg ? legCfg.display : true;
      if (legCfg) legCfg.display = false;
      try { allocChart.update('none'); } catch(e) { try { allocChart.update(0); } catch(e2){} }
      try { allocDataUrl = allocCv.toDataURL('image/png'); } catch(e){}
      if (legCfg) legCfg.display = prevDisplay;
      try { allocChart.update('none'); } catch(e) { try { allocChart.update(0); } catch(e2){} }
    } else {
      try { allocDataUrl = allocCv.toDataURL('image/png'); } catch(e){}
    }
  }

  // ── Calcular pieH desde el aspect ratio real de cada canvas ──────────────
  // Usamos el MÍNIMO de las dos alturas naturales → ambas cabrán sin distorsión
  // y el donut de cada una llenará la misma altura, luciendo visualmente igual.
  var h1 = (allocCv && allocCv.width) ? pieW * allocCv.height / allocCv.width : pieW;
  var h2 = (compCv  && compCv.width)  ? pieW * compCv.height  / compCv.width  : pieW;
  var pieH = Math.min(h1, h2, 80);   // cap a 80mm

  // Ancho real de cada imagen a la altura pieH (centrado en la columna)
  var allocImgW = (allocCv && allocCv.height) ? Math.min(pieW, pieH * allocCv.width / allocCv.height) : pieW;
  var compImgW  = (compCv  && compCv.height)  ? Math.min(pieW, pieH * compCv.width  / compCv.height)  : pieW;
  var allocImgX = _PDF_M + (pieW - allocImgW) / 2;
  var compImgX  = rightX + (pieW - compImgW)  / 2;

  // Estimar alturas de leyenda (2 columnas, 5.5mm por fila)
  var allocLegH = allocLabels.length ? Math.ceil(allocLabels.length / 2) * 5.5 + 2 : 0;
  var legendEl  = document.getElementById('composicionLegend');
  var compItems = legendEl ? Array.from(legendEl.querySelectorAll('div')) : [];
  var compLegH  = compItems.length ? Math.ceil(compItems.length / 2) * 5.5 + 2 : 0;

  y = _pdfNewPage(doc, y, pieH + Math.max(allocLegH, compLegH) + 8);

  // ── Dibujar las dos tortas (sin distorsión) ───────────────────────────────
  if (allocDataUrl) {
    doc.addImage(allocDataUrl, 'PNG', allocImgX, y, allocImgW, pieH);
  }
  if (compCv && compCv.width) {
    try { doc.addImage(compCv.toDataURL('image/png'), 'PNG', compImgX, y, compImgW, pieH); } catch(e){}
  }

  var legY = y + pieH + 3;
  var colW = pieW / 2;

  // ── Leyenda izquierda (debajo de allocationChart) ────────────────────────
  allocLabels.forEach(function(label, idx) {
    var color = Array.isArray(allocColors) ? (allocColors[idx] || '#888888') : '#888888';
    var col   = idx % 2, row = Math.floor(idx / 2);
    var lx    = _PDF_M + col * colW;
    var ly    = legY + row * 5.5;
    _pdfColorDot(doc, color, lx, ly, 1.5);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(String(label), lx + 4, ly + 2, { maxWidth: colW - 5 });
  });

  // ── Leyenda derecha (debajo de composicionChart) ──────────────────────────
  compItems.forEach(function(item, idx) {
    var spans  = item.querySelectorAll('span');
    var circle = spans[0];
    var textEl = spans[1];
    if (!textEl) return;
    var style = circle ? circle.getAttribute('style') : '';
    var match = style && style.match(/background:\s*(#[0-9a-fA-F]{3,8}|rgb[^;)]+)/);
    var color = match ? match[1] : '#888888';
    var col   = idx % 2, row = Math.floor(idx / 2);
    var lx    = rightX + col * colW;
    var ly    = legY + row * 5.5;
    _pdfColorDot(doc, color, lx, ly, 1.5);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(textEl.innerText.trim(), lx + 4, ly + 2, { maxWidth: colW - 5 });
  });

  y = legY + Math.max(allocLegH, compLegH) + 3;
  doc.setTextColor(0, 0, 0);

  // ── Evolución del patrimonio (ancho completo) ─────────────────────────────
  y = _pdfTitle(doc, 'Evolución del portafolio', y);
  y = _pdfCanvas(doc, 'portfolioChart', y, _PDF_CW, 65);

  // Stats
  y = _pdfTitle(doc, 'Estadísticas del portafolio', y);
  y = _pdfStatBoxes(doc, 'summaryStats', y);

  // Histograma
  y = _pdfTitle(doc, 'Distribución de retornos', y);
  y = _pdfCanvas(doc, 'histogramChart', y, _PDF_CW, 65);

  // Rolling (main + hist lado a lado)
  y = _pdfTitle(doc, 'Retornos rolling 12 meses', y);
  var rMain = document.getElementById('rollingChart');
  var rHist = document.getElementById('rollingHistChart');
  if (rMain && rMain.width && rHist && rHist.width) {
    var rmW = _PDF_CW * 0.70, rhW = _PDF_CW * 0.28;
    var rmH = Math.min(55, rmW * rMain.height / rMain.width);
    y = _pdfNewPage(doc, y, rmH + 3);
    try { doc.addImage(rMain.toDataURL('image/png'), 'PNG', _PDF_M, y, rmW, rmH); } catch(e){}
    try { doc.addImage(rHist.toDataURL('image/png'), 'PNG', _PDF_M+rmW+_PDF_CW*0.02, y, rhW, rmH); } catch(e){}
    y += rmH + 4;
  }

  // Drawdowns
  y = _pdfTitle(doc, 'Principales drawdowns', y);
  y = _pdfCanvas(doc, 'drawdownChart', y, _PDF_CW, 55);
  y = _pdfDrawdownCards(doc, y);

  // Monte Carlo
  y = _pdfTitle(doc, 'Simulación Monte Carlo', y);
  y = _pdfCanvas(doc, 'mcChart', y, _PDF_CW, 65);
  y = _pdfTableById(doc, 'mcStats', y);

  return y;
}

function _pdfRetiros(doc, y) {
  y = _pdfTitle(doc, 'Evolución patrimonial', y);
  y = _pdfCanvas(doc, 'withdrawalEvolutionChart', y, _PDF_CW, 70);

  y = _pdfTitle(doc, 'Estadísticas históricas', y);
  y = _pdfStatBoxes(doc, 'withdrawalStats', y);

  y = _pdfTitle(doc, 'Probabilidad de supervivencia por horizonte', y);
  y = _pdfSurvivalStats(doc, y);

  y = _pdfTitle(doc, 'Simulación Monte Carlo', y);
  y = _pdfCanvas(doc, 'mcVizChart', y, _PDF_CW, 70);
  y = _pdfTableById(doc, 'mcVizStats', y);

  return y;
}

function _pdfObjetivos(doc, y) {
  y = _pdfTitle(doc, 'Resumen de capital', y);
  y = _pdfGbiCapitalSummary(doc, y);

  y = _pdfTitle(doc, 'Portafolios por objetivo', y);
  y = _pdfGbiGoalCards(doc, y);

  if (window._gbiLastResult && window._gbiLastResult.growthResult) {
    y = _pdfTitle(doc, 'Growth Portfolio', y);
    y = _pdfGbiGrowthCard(doc, y);
  }

  y = _pdfTitle(doc, 'Portafolio consolidado', y);
  y = _pdfTableById(doc, 'gbi-consolidated-content', y);

  y = _pdfTitle(doc, 'Simulaciones históricas (ventanas 10 años)', y);
  y = _pdfCanvas(doc, 'gbi-historical-chart', y, _PDF_CW, 75);
  y = _pdfTableById(doc, 'gbi-historical-summary', y);

  return y;
}
