export async function onRequest(context) {
  const url = new URL(context.request.url);
  let backendUrl = context.env.BACKEND_URL;
  
  if (!backendUrl) {
    return new Response("Erro: BACKEND_URL não configurado", { status: 500 });
  }

  const backendUrlObj = new URL(backendUrl);
  // Se for um endereço IP (ex: 34.121.71.100), o Cloudflare Worker bloqueia com erro 1003 (Direct IP Access).
  // Para contornar, adicionamos .nip.io (serviço gratuito de DNS curinga) para transformar o IP em um domínio.
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(backendUrlObj.hostname)) {
    backendUrlObj.hostname = backendUrlObj.hostname + '.nip.io';
  }

  const targetUrl = new URL(url.pathname + url.search, backendUrlObj.toString());
  
  // Criar cabeçalhos totalmente novos apenas com o essencial
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
