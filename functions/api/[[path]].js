export async function onRequest(context) {
  const url = new URL(context.request.url);
  const backendUrl = context.env.BACKEND_URL;
  
  if (!backendUrl) {
    return new Response("Erro: BACKEND_URL não configurado nas variáveis de ambiente da Cloudflare.", { status: 500 });
  }

  // Constrói a URL final do backend (ex: http://34.121.71.100:80/api/auth/login)
  const targetUrl = new URL(url.pathname + url.search, backendUrl);
  
  // Cria uma nova requisição baseada na original, mas apontando para o IP real
  const request = new Request(targetUrl, context.request);
  
  // Envia para o backend e retorna a resposta para o frontend
  return fetch(request);
}
