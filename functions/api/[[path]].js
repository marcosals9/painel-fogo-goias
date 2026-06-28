export async function onRequest(context) {
  const url = new URL(context.request.url);
  const backendUrl = context.env.BACKEND_URL;
  
  if (!backendUrl) {
    return new Response("Erro: BACKEND_URL não configurado", { status: 500 });
  }

  const targetUrl = new URL(url.pathname + url.search, backendUrl);
  
  // Precisamos limpar os cabeçalhos de rastreamento do Cloudflare
  // porque se enviarmos eles de volta para fora, o Cloudflare bloqueia com erro 403 Forbidden!
  const newHeaders = new Headers(context.request.headers);
  newHeaders.delete('host');
  newHeaders.delete('cf-connecting-ip');
  newHeaders.delete('cf-ray');
  newHeaders.delete('cf-visitor');
  newHeaders.delete('cf-ipcountry');
  newHeaders.delete('x-forwarded-proto');
  newHeaders.delete('x-forwarded-for');

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
