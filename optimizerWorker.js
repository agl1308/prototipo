importScripts('portfolioOptimizer.js');

onmessage = function(e) {
  const resultado = self.calcularFronteraCompleta(e.data.marketData);
  postMessage(resultado);
};

onerror = function(e) {
  postMessage({ error: e.message });
};
