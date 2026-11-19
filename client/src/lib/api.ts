import axios, { AxiosInstance, AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api';

interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    // Call backend directly (no Next.js proxy)
    const backendURL = process.env.NEXT_PUBLIC_API_URL || 'https://apiedge.nexoral.in';

    this.client = axios.create({
      baseURL: `${backendURL}/api`,
      withCredentials: true, // Include httpOnly cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse>) => {
        const message = error.response?.data?.message || error.message || 'An error occurred';
        const customError = new Error(message) as Error & { response?: AxiosError['response']; data?: any };
        customError.response = error.response;
        customError.data = error.response?.data?.data;
        throw customError;
      }
    );
  }

  
  // Auth endpoints
  async googleAuth(data: { idToken: string }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/google', data);
    return response.data;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async setupTotp(data: { name?: string }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/setup', data);
    return response.data;
  }

  async confirmTotp(data: { deviceId: string; code: string }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/confirm', data);
    return response.data;
  }

  async removeTotp(data: { deviceId: string; code: string }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/remove', data);
    return response.data;
  }

  async verifyTotp(data: { code: string }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/verify', data);
    return response.data;
  }

  async passkeyRegisterOptions(): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/passkey/register/options');
    return response.data;
  }

  async passkeyRegisterVerify(data: { response: unknown }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/passkey/register/verify', data);
    return response.data;
  }

  async passkeyAuthOptions(): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/passkey/auth/options');
    return response.data;
  }

  async passkeyAuthVerify(data: { response: unknown }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/passkey/auth/verify', data);
    return response.data;
  }

  async removePasskey(data: { passkeyId: string }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/passkey/remove', data);
    return response.data;
  }

  async renameCredential(data: { kind: 'totp' | 'passkey'; id: string; name: string }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/rename', data);
    return response.data;
  }

  async setSecondFactorPreference(data: { method: 'totp' | 'passkey' | null }): Promise<ApiResponse> {
    const response = await this.client.post('/auth/2fa/preference', data);
    return response.data;
  }

  // Cloudflare endpoints
  async saveCloudflareCredentials(data: any): Promise<ApiResponse> {
    const response = await this.client.post('/cloudflare/credentials', data);
    return response.data;
  }

  async updateCloudflareCredentials(data: any): Promise<ApiResponse> {
    const response = await this.client.put('/cloudflare/credentials', data);
    return response.data;
  }

  async getCloudflareCredentials(): Promise<ApiResponse> {
    const response = await this.client.get('/cloudflare/credentials');
    return response.data;
  }

  async getCloudflareZones(): Promise<ApiResponse> {
    const response = await this.client.get('/cloudflare/zones');
    return response.data;
  }

  async getCloudflareOAuthUrl(): Promise<ApiResponse<{ url: string }>> {
    const response = await this.client.get('/cloudflare/oauth/authorize');
    return response.data;
  }

  async disconnectCloudflareOAuth(): Promise<ApiResponse> {
    const response = await this.client.post('/cloudflare/oauth/disconnect');
    return response.data;
  }

  // Load Balancer endpoints
  async createLoadBalancer(data: any, options?: RequestOptions): Promise<ApiResponse> {
    const response = await this.client.post('/loadbalancers', data, options);
    return response.data;
  }

  async validateLoadBalancerHostname(data: {
    domain: string;
    subdomain?: string;
    // Optional — enables the server's Worker Routes conflict check on the preflight.
    zoneId?: string;
    excludeLoadBalancerId?: string;
  }): Promise<ApiResponse> {
    const response = await this.client.post('/loadbalancers/validate-hostname', data);
    return response.data;
  }

  async getLoadBalancers(params?: { search?: string; status?: 'active' | 'paused' }): Promise<ApiResponse> {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.set('search', params.search.trim());
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const response = await this.client.get(`/loadbalancers${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  async getLoadBalancer(id: string): Promise<ApiResponse> {
    const response = await this.client.get(`/loadbalancers/${id}`);
    return response.data;
  }

  async updateLoadBalancer(id: string, data: any, options?: RequestOptions): Promise<ApiResponse> {
    const response = await this.client.put(`/loadbalancers/${id}`, data, options);
    return response.data;
  }

  async deleteLoadBalancer(id: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/loadbalancers/${id}`);
    return response.data;
  }

  async cancelLoadBalancerOperation(operationId: string): Promise<ApiResponse> {
    const response = await this.client.post(`/loadbalancers/operations/${operationId}/cancel`);
    return response.data;
  }

  async pauseLoadBalancer(id: string, mode: 'release-domain' | 'keep-domain'): Promise<ApiResponse> {
    const response = await this.client.post(`/loadbalancers/${id}/pause`, { mode });
    return response.data;
  }

  async resumeLoadBalancer(id: string): Promise<ApiResponse> {
    const response = await this.client.post(`/loadbalancers/${id}/resume`);
    return response.data;
  }

  async getLoadBalancerAnalytics(id: string, period: '24h' | '7d' = '24h'): Promise<ApiResponse> {
    const response = await this.client.get(`/loadbalancers/${id}/analytics`, { params: { period } });
    return response.data;
  }

  async getBatchLoadBalancerAnalytics(period: '24h' | '7d' = '24h'): Promise<ApiResponse> {
    const response = await this.client.get('/loadbalancers/analytics', { params: { period } });
    return response.data;
  }

  async getOriginIp(lbId: string, hostname: string): Promise<ApiResponse> {
    const response = await this.client.get(`/loadbalancers/${lbId}/origin-ip`, { params: { hostname } });
    return response.data;
  }

  async restartOriginHealth(lbId: string, originIndex: number): Promise<ApiResponse> {
    const response = await this.client.post(`/loadbalancers/${lbId}/health/restart-origin`, { originIndex });
    return response.data;
  }

  // Gateway endpoints
  async createGateway(data: any, options?: RequestOptions): Promise<ApiResponse> {
    const response = await this.client.post('/gateways', data, options);
    return response.data;
  }

  async validateGatewayHostname(data: {
    domain: string;
    subdomain?: string;
    zoneId?: string;
    gatewayId?: string;
  }): Promise<ApiResponse> {
    const response = await this.client.post('/gateways/validate-hostname', data);
    return response.data;
  }

  async getGateways(): Promise<ApiResponse> {
    const response = await this.client.get('/gateways');
    return response.data;
  }

  async getGateway(id: string): Promise<ApiResponse> {
    const response = await this.client.get(`/gateways/${id}`);
    return response.data;
  }

  async updateGateway(id: string, data: any, options?: RequestOptions): Promise<ApiResponse> {
    const response = await this.client.put(`/gateways/${id}`, data, options);
    return response.data;
  }

  async deleteGateway(id: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/gateways/${id}`);
    return response.data;
  }

  async cancelGatewayOperation(operationId: string): Promise<ApiResponse> {
    const response = await this.client.post(`/gateways/operations/${operationId}/cancel`);
    return response.data;
  }

  async pauseGateway(id: string, mode: 'release-domain' | 'keep-domain'): Promise<ApiResponse> {
    const response = await this.client.post(`/gateways/${id}/pause`, { mode });
    return response.data;
  }

  async resumeGateway(id: string): Promise<ApiResponse> {
    const response = await this.client.post(`/gateways/${id}/resume`);
    return response.data;
  }

  // Session endpoints
  async getSessions(params?: { cursor?: string; limit?: number; filter?: 'all' | 'active' | 'inactive' }): Promise<ApiResponse> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.filter && params.filter !== 'all') query.set('filter', params.filter);
    const qs = query.toString();
    const response = await this.client.get(`/sessions${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  async getSessionScript(id: string): Promise<ApiResponse> {
    const response = await this.client.get(`/sessions/${id}/script`);
    return response.data;
  }

  // AI Run endpoints
  async getAiRuns(params?: { cursor?: string; limit?: number }): Promise<ApiResponse> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const response = await this.client.get(`/ai/runs${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  async getAiRun(id: string): Promise<ApiResponse> {
    const response = await this.client.get(`/ai/runs/${id}`);
    return response.data;
  }

  // User/Profile endpoints
  async getProfile(): Promise<ApiResponse> {
    const response = await this.client.get('/user/profile');
    return response.data;
  }

  // Payment endpoints
  async createOrder(planType: string, phone: string): Promise<ApiResponse> {
    const response = await this.client.post('/payments', { planType, phone });
    return response.data;
  }

  async verifyPayment(orderId: string): Promise<ApiResponse> {
    const response = await this.client.post('/payments/verify', { orderId });
    return response.data;
  }

  async createUpgradeOrder(toPlan: string, phone: string): Promise<ApiResponse> {
    const response = await this.client.post('/payments/upgrade', { toPlan, phone });
    return response.data;
  }

  async getPaymentHistory(params?: { cursor?: string; limit?: number }): Promise<ApiResponse> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const response = await this.client.get(`/payments/history${qs ? `?${qs}` : ''}`);
    return response.data;
  }
}

// Export singleton instance
export const api = new ApiClient();