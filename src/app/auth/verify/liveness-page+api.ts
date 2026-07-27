function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJsString(value: string): string {
  return JSON.stringify(value);
}

function renderPage(sdkUrl: string, pubKey: string, redirectUri: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verify it's really you</title>
  <script src="${escapeHtml(sdkUrl)}"></script>
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex;
      align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 24px; }
    #status { max-width: 320px; }
    #retry { display: none; margin-top: 16px; padding: 12px 20px; border-radius: 8px; border: none;
      background: #2563eb; color: white; font-size: 15px; }
  </style>
</head>
<body>
  <div id="status">
    <p>Starting face verification…</p>
    <button id="retry" onclick="startVerification()">Try again</button>
  </div>
  <script>
    var PUB_KEY = ${escapeJsString(pubKey)};
    var REDIRECT_URI = ${escapeJsString(redirectUri)};

    function redirectWith(params) {
      var url = REDIRECT_URI + (REDIRECT_URI.indexOf('?') === -1 ? '?' : '&') +
        Object.keys(params).map(function (key) {
          return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        }).join('&');
      window.location.href = url;
    }

    function startVerification() {
      document.getElementById('status').firstElementChild.textContent = 'Starting face verification…';
      document.getElementById('retry').style.display = 'none';

      window.eKYC().start({ pubKey: PUB_KEY }).then(function (response) {
        var sessionId = response && response.result && response.result.session_id;
        if (!sessionId) {
          redirectWith({ error: 'missing_session_id' });
          return;
        }
        redirectWith({ session_id: sessionId });
      }).catch(function (error) {
        var message = (error && (error.message || error.code)) || 'liveness_failed';
        document.getElementById('status').firstElementChild.textContent =
          'Verification was cancelled or failed.';
        document.getElementById('retry').style.display = 'inline-block';
        console.error('Liveness check error or cancelled:', error);
        redirectWith({ error: String(message) });
      });
    }

    startVerification();
  </script>
</body>
</html>`;
}

export async function GET(request: Request) {
  const sdkUrl = process.env.EGOV_VERIFY_LIVENESS_SDK_URL;
  const pubKey = process.env.EGOV_VERIFY_PUBLIC_KEY;

  if (!sdkUrl || !pubKey) {
    console.error('liveness-page route called with missing env config (EGOV_VERIFY_LIVENESS_SDK_URL/PUBLIC_KEY)');
    return new Response('Server misconfiguration', { status: 500 });
  }

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri');
  if (!redirectUri) {
    return new Response('redirect_uri is required', { status: 400 });
  }

  const html = renderPage(sdkUrl, pubKey, redirectUri);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
