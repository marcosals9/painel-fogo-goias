const https = require('https');

const date = new Date().toISOString().split('T')[0];
const baseUrl = 'https://panorama.sipam.gov.br/geoserver/painel_do_fogo/wfs';
const baseParams = `service=WFS&version=1.0.0&request=GetFeature&typeName=painel_do_fogo:mv_evento_filtro&maxFeatures=1&CQL_FILTER=BBOX(geom,-53.25,-19.49,-45.90,-12.39)`;

const tests = [
  {
    name: '1. Baseline (Sem cabeçalhos, JSON)',
    url: `${baseUrl}?${baseParams}&outputFormat=application/json`,
    headers: {}
  },
  {
    name: '2. Spoofing de Navegador (Fingindo ser Chrome Windows, JSON)',
    url: `${baseUrl}?${baseParams}&outputFormat=application/json`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive'
    }
  },
  {
    name: '3. Formato Alternativo (Fingindo ser Chrome, KML)',
    url: `${baseUrl}?${baseParams}&outputFormat=KML`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }
];

async function runTests() {
  console.log('Iniciando testes de performance CENSIPAM...');
  console.log('--------------------------------------------------');

  for (const test of tests) {
    console.log(`Testando: ${test.name}`);
    const startTime = Date.now();
    
    try {
      const response = await fetch(test.url, { headers: test.headers });
      const text = await response.text();
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`Status HTTP: ${response.status}`);
      console.log(`Tamanho recebido: ${(text.length / 1024).toFixed(2)} KB`);
      console.log(`Tempo total: ${timeTaken} segundos`);
      
    } catch (error) {
      console.error(`Erro: ${error.message}`);
    }
    console.log('--------------------------------------------------');
  }
}

runTests();
