import axios from 'axios';

const CF_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

export interface WorkerAnalytics {
  requests: number;
  errors: number;
  errorRate: number;
}

export async function fetchWorkerAnalytics(params: {
  accountId: string;
  apiToken: string;
  scriptName: string;
  period: '24h' | '7d';
}): Promise<WorkerAnalytics | null> {
  const { accountId, apiToken, scriptName, period } = params;
  const now = new Date();
  const start = new Date(now.getTime() - (period === '7d' ? 604_800_000 : 86_400_000));

  const query = `{
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        workersInvocationsAdaptive(
          limit: 10000,
          filter: {
            scriptName: "${scriptName}",
            datetimeStart: "${start.toISOString()}",
            datetimeEnd: "${now.toISOString()}"
          }
        ) { sum { requests errors } }
      }
    }
  }`;

  try {
    const res = await axios.post(CF_GRAPHQL, { query }, {
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      timeout: 10_000,
    });

    const rows: Array<{ sum: { requests: number; errors: number } }> =
      res.data?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];

    const totalRequests = rows.reduce((s, r) => s + (r.sum.requests ?? 0), 0);
    const totalErrors   = rows.reduce((s, r) => s + (r.sum.errors   ?? 0), 0);
    const errorRate = totalRequests > 0
      ? Math.round((totalErrors / totalRequests) * 10_000) / 100
      : 0;

    return { requests: totalRequests, errors: totalErrors, errorRate };
  } catch {
    return null;
  }
}
