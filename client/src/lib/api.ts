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

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse>) => {
        // Extract error message from API response or use default
        const message = error.response?.data?.message || error.message || 'An error occurred';

        // Re-throw with structured error
        throw new Error(message);
      }
    );
  }

  
  // Auth endpoints
  async register(data: any): Promise<ApiResponse> {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(data: any): Promise<ApiResponse> {
    const response = await this.client.post('/auth/login', data);
    return response.data; 
  }

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

  // Load Balancer endpoints
  async createLoadBalancer(data: any, options?: RequestOptions): Promise<ApiResponse> {
    const response = await this.client.post('/loadbalancers', data, options);
    return response.data;
  }

  async validateLoadBalancerHostname(data: {
    domain: string;
    subdomain?: string;
    excludeLoadBalancerId?: string;
  }): Promise<ApiResponse> {
    const response = await this.client.post('/loadbalancers/validate-hostname', data);
    return response.data;
  }

  async getLoadBalancers(): Promise<ApiResponse> {
    const response = await this.client.get('/loadbalancers');
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

  // User/Profile endpoints
  async changePassword(data: any): Promise<ApiResponse> {
    const response = await this.client.put('/user/password', data);
    return response.data;
  }

  async getProfile(): Promise<ApiResponse> {
    const response = await this.client.get('/user/profile');
    return response.data;
  }
}

// Export singleton instance
export const api = new ApiClient();