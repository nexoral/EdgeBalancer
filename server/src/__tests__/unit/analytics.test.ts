import axios from 'axios';
import { fetchWorkerAnalytics } from '../../modules/loadbalancer/services/analytics.service';

jest.mock('axios');
const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

function makeGraphQLResponse(rows: Array<{ requests: number; errors: number }>) {
  return {
    data: {
      data: {
        viewer: {
          accounts: [
            {
              workersInvocationsAdaptive: rows.map(r => ({ sum: r })),
            },
          ],
        },
      },
    },
  };
}

const BASE_PARAMS = {
  accountId: 'acct123',
  apiToken: 'token456',
  scriptName: 'my-lb',
  period: '24h' as const,
};

describe('fetchWorkerAnalytics', () => {
  it('aggregates requests and errors across multiple rows', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([
      { requests: 100, errors: 5 },
      { requests: 200, errors: 10 },
    ]));

    const result = await fetchWorkerAnalytics(BASE_PARAMS);

    expect(result).not.toBeNull();
    expect(result!.requests).toBe(300);
    expect(result!.errors).toBe(15);
  });

  it('calculates errorRate as a percentage rounded to 2dp', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([
      { requests: 1000, errors: 37 },
    ]));

    const result = await fetchWorkerAnalytics(BASE_PARAMS);

    expect(result!.errorRate).toBe(3.7);
  });

  it('returns errorRate of 0 when there are no requests', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([]));

    const result = await fetchWorkerAnalytics(BASE_PARAMS);

    expect(result!.requests).toBe(0);
    expect(result!.errorRate).toBe(0);
  });

  it('returns errorRate of 0 when requests exist but errors are 0', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([{ requests: 500, errors: 0 }]));

    const result = await fetchWorkerAnalytics(BASE_PARAMS);

    expect(result!.errorRate).toBe(0);
  });

  it('returns null when axios throws (network error)', async () => {
    mockedPost.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchWorkerAnalytics(BASE_PARAMS);

    expect(result).toBeNull();
  });

  it('returns null when CF response has no viewer data (invalid token)', async () => {
    mockedPost.mockResolvedValueOnce({ data: { errors: [{ message: 'Unauthorized' }] } });

    const result = await fetchWorkerAnalytics(BASE_PARAMS);

    expect(result).toBeNull();
  });

  it('uses a wider datetime window for the 7d period', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([{ requests: 0, errors: 0 }]));

    await fetchWorkerAnalytics({ ...BASE_PARAMS, period: '7d' });

    const body = mockedPost.mock.calls[0][1] as { query: string };
    const start = new Date(body.query.match(/datetimeStart: "([^"]+)"/)![1]);
    const end   = new Date(body.query.match(/datetimeEnd: "([^"]+)"/)![1]);
    const diffMs = end.getTime() - start.getTime();

    expect(diffMs).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 5000);
  });

  it('uses a 24h datetime window for the 24h period', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([{ requests: 0, errors: 0 }]));

    await fetchWorkerAnalytics(BASE_PARAMS);

    const body = mockedPost.mock.calls[0][1] as { query: string };
    const start = new Date(body.query.match(/datetimeStart: "([^"]+)"/)![1]);
    const end   = new Date(body.query.match(/datetimeEnd: "([^"]+)"/)![1]);
    const diffMs = end.getTime() - start.getTime();

    expect(diffMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
  });

  it('sends the correct scriptName in the GraphQL query body', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([{ requests: 0, errors: 0 }]));

    await fetchWorkerAnalytics({ ...BASE_PARAMS, scriptName: 'custom-lb' });

    const body = mockedPost.mock.calls[0][1] as { query: string };
    expect(body.query).toContain('scriptName: "custom-lb"');
  });

  it('sends the correct accountId in the GraphQL query body', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([{ requests: 0, errors: 0 }]));

    await fetchWorkerAnalytics({ ...BASE_PARAMS, accountId: 'myaccount' });

    const body = mockedPost.mock.calls[0][1] as { query: string };
    expect(body.query).toContain('accountTag: "myaccount"');
  });

  it('sends Authorization Bearer header', async () => {
    mockedPost.mockResolvedValueOnce(makeGraphQLResponse([{ requests: 0, errors: 0 }]));

    await fetchWorkerAnalytics({ ...BASE_PARAMS, apiToken: 'my-secret-token' });

    const config = mockedPost.mock.calls[0][2] as any;
    expect(config.headers?.Authorization).toBe('Bearer my-secret-token');
  });

  it('handles missing errors field gracefully (treats as 0)', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        data: {
          viewer: {
            accounts: [
              {
                workersInvocationsAdaptive: [{ sum: { requests: 200 } }],
              },
            ],
          },
        },
      },
    });

    const result = await fetchWorkerAnalytics(BASE_PARAMS);

    expect(result!.requests).toBe(200);
    expect(result!.errors).toBe(0);
    expect(result!.errorRate).toBe(0);
  });
});
