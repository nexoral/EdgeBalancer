export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');

    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Headers':
        request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
      'Vary': 'Origin',
    };

    if (origin) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Maintenance | EdgeBalancer</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #ffffff;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
          }

          .container {
            text-align: center;
            max-width: 440px;
            width: 90%;
            padding: 2.5rem;
          }

          .status-icon {
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
            opacity: 0.9;
          }

          h1 {
            font-size: 2rem;
            font-weight: 600; /* Light bold */
            margin-bottom: 1rem;
            color: #111111;
            letter-spacing: -0.02em;
          }

          p {
            font-size: 1.0625rem;
            line-height: 1.6;
            color: #4b5563;
            margin-bottom: 2rem;
          }

          .divider {
            height: 1px;
            background-color: #f3f4f6;
            width: 60px;
            margin: 0 auto 2rem;
          }

          .meta {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            font-size: 0.8125rem;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 500;
          }

          .brand {
            color: #111111;
            font-weight: 600;
          }

          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
            100% { transform: translateY(0px); }
          }
          
          .floating {
            animation: float 4s infinite ease-in-out;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="status-icon floating">
            ⏸️
          </div>

          <h1>System Paused</h1>
          <p>
            This load balancer is currently <strong>undergoing maintenance</strong>. 
            We expect to be back <strong>very shortly</strong>.
          </p>
          
          <div class="divider"></div>

          <div class="meta">
            <span>Status: 503 Service Unavailable</span>
            <span>Powered by <span class="brand">EdgeBalancer</span></span>
          </div>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      status: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html;charset=UTF-8',
        'Retry-After': '3600',
      },
    });
  },
};
