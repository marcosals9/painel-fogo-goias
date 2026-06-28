export async function onRequest(context) {
  const url = new URL(context.request.url);
  const backendUrl = context.env.BACKEND_URL;
  
  if (!backendUrl) {
    return new Response("Erro: BACKEND_URL não configurado", { status: 500 });
  }

  const targetUrl = new URL(url.pathname + url.search, backendUrl);
  
  // Criar cabeçalhos totalmente novos apenas com o essencial
  // Isso impede que o Cloudflare Worker tente rotear a requisição de volta para si mesmo
  const newHeaders = new Headers();
  
  const contentType = context.request.headers.get('Content-Type');
  if (contentType) newHeaders.set('Content-Type', contentType);
  
  const auth = context.request.headers.get('Authorization');
  if (auth) newHeaders.set('Authorization', auth);
  
  const accept = context.request.headers.get('Accept');
  if (accept) newHeaders.set('Accept', accept);

  const init = {
    method: context.request.method,
    headers: newHeaders,
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
  }

  try {
    return await fetch(targetUrl.toString(), init);
  } catch (err) {
    return new Response("Erro de proxy: " + err.message, { status: 502 });
  }
}
