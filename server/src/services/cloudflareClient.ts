import axios, { AxiosInstance } from 'axios';
import { retryWithBackoff } from '../utils/retry';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export class CloudflareClient {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: CLOUDFLARE_API_BASE,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });
  }

  async testWorkerScriptsPermission(accountId: string): Promise<boolean> {
    try {
      await retryWithBackoff(
        () => this.client.get(`/accounts/${accountId}/workers/scripts`),
        { maxRetries: 2 }
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async testWorkersKVPermission(accountId: string): Promise<boolean> {
    try {
      await retryWithBackoff(
        () => this.client.get(`/accounts/${accountId}/storage/kv/namespaces`),
        { maxRetries: 2 }
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async testZoneReadPermission(accountId: string): Promise<boolean> {
    try {
      await retryWithBackoff(
        () => this.client.get(`/zones?account.id=${accountId}`),
        { maxRetries: 2 }
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async getZones(accountId: string): Promise<any> {
    const response = await retryWithBackoff(
      () => this.client.get(`/zones?account.id=${accountId}`),
      { maxRetries: 3 }
    );
    return response.data;
  }

  async getWorkerScriptByName(accountId: string, scriptName: string): Promise<{ id: string; script_name: string } | null> {
    const response = await retryWithBackoff(
      () => this.client.get(`/accounts/${accountId}/workers/scripts`),
      { maxRetries: 3 }
    );

    const scripts = response.data?.result ?? [];
    const script = scripts.find((item: any) => (
      item?.id === scriptName ||
      item?.script_name === scriptName ||
      item?.name === scriptName
    ));

    if (!script?.id) {
      return null;
    }

    return {
      id: script.id,
      script_name: script.script_name || script.name || scriptName,
    };
  }

  async workerNameExists(accountId: string, scriptName: string): Promise<boolean> {
    const script = await this.getWorkerScriptByName(accountId, scriptName);
    return !!script;
  }

  async testDnsEditPermission(accountId: string): Promise<boolean> {
    try {
      const zones = await this.getZones(accountId);
      const firstZone = zones?.result?.[0];
      if (!firstZone?.id) return true; // no zones available to test against — skip
      await retryWithBackoff(
        () => this.client.get(`/zones/${firstZone.id}/dns_records?per_page=1`),
        { maxRetries: 2 }
      );
      return true;
    } catch {
      return false;
    }
  }

  async getWorkerDomains(accountId: string): Promise<any[]> {
    const response = await retryWithBackoff(
      () => this.client.get(`/accounts/${accountId}/workers/domains`),
      { maxRetries: 3 }
    );

    return response.data?.result ?? [];
  }
}