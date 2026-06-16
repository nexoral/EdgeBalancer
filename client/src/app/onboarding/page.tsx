'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    accountId: '',
    apiToken: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error: any) {
      toast.error('Failed to logout');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.accountId.trim()) {
      newErrors.accountId = 'Account ID is required';
    } else if (formData.accountId.length !== 32) {
      newErrors.accountId = 'Account ID must be 32 characters';
    }
    
    if (!formData.apiToken.trim()) {
      newErrors.apiToken = 'API Token is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await api.saveCloudflareCredentials({
        accountId: formData.accountId,
        apiToken: formData.apiToken,
      });
      
      toast.success('Cloudflare credentials saved successfully!');
      await refreshUser();
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6">
        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </Button>
      </div>

      <div className="w-full max-w-4xl mt-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Connect Your Cloudflare Account</h1>
          <p className="text-muted-foreground">
            Follow the steps below to create an API token and connect your Cloudflare account
          </p>
        </div>

        <Card className="p-8 mb-6">
          <h2 className="text-xl font-semibold mb-6">Step-by-Step Instructions</h2>
          
          <div className="space-y-6">
            <StepCard number={1}>
              <p className="font-medium mb-2">Go to your Cloudflare API Tokens page</p>
              <p className="text-sm text-muted-foreground mb-2">
                Visit{' '}
                <a 
                  href="https://dash.cloudflare.com/profile/api-tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://dash.cloudflare.com/profile/api-tokens
                </a>
              </p>
            </StepCard>

            <StepCard number={2}>
              <p className="font-medium">Click &quot;Create Token&quot;</p>
            </StepCard>

            <StepCard number={3}>
              <p className="font-medium">Click &quot;Create Custom Token&quot;</p>
              <p className="text-sm text-muted-foreground mt-1">
                Do not use any template
              </p>
            </StepCard>

            <StepCard number={4}>
              <p className="font-medium mb-2">Give your token a name</p>
              <p className="text-sm text-muted-foreground">
                For example: &quot;EdgeBalancer&quot;
              </p>
            </StepCard>

            <StepCard number={5}>
              <p className="font-medium mb-2">Add the following permissions:</p>
              <div className="space-y-2 mt-3">
                <PermissionBadge>Account &gt; Worker Scripts &gt; Edit</PermissionBadge>
                <PermissionBadge>Account &gt; Workers KV Storage &gt; Edit</PermissionBadge>
                <PermissionBadge>Account &gt; Account Analytics &gt; Read</PermissionBadge>
                <PermissionBadge>Zone &gt; Zone &gt; Read</PermissionBadge>
                <PermissionBadge>Zone &gt; DNS &gt; Edit</PermissionBadge>
              </div>
            </StepCard>

            <StepCard number={6}>
              <p className="font-medium mb-2">Under &quot;Zone Resources&quot;</p>
              <p className="text-sm text-muted-foreground">
                Select &quot;All Zones&quot; or pick the specific zone you want to use
              </p>
            </StepCard>

            <StepCard number={7}>
              <p className="font-medium">Click &quot;Continue to summary&quot;, then &quot;Create Token&quot;</p>
            </StepCard>

            <StepCard number={8}>
              <p className="font-medium mb-2">Copy the token immediately</p>
              <p className="text-sm text-muted-foreground">
                ⚠️ Cloudflare will not show it again after you leave the page
              </p>
            </StepCard>
          </div>
        </Card>

        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-6">Enter Your Credentials</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="accountId" className="block text-sm font-medium mb-2">
                Cloudflare Account ID
              </label>
              <Input
                id="accountId"
                type="text"
                placeholder="32-character Account ID"
                value={formData.accountId}
                onChange={(e) => {
                  setFormData({ ...formData, accountId: e.target.value });
                  setErrors({ ...errors, accountId: '' });
                }}
                className={errors.accountId ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.accountId && (
                <p className="text-sm text-red-500 mt-1">{errors.accountId}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Find your Account ID at{' '}
                <a 
                  href="https://dash.cloudflare.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  dash.cloudflare.com
                </a>
                {' '}in the right sidebar under &quot;Account ID&quot;
              </p>
            </div>

            <div>
              <label htmlFor="apiToken" className="block text-sm font-medium mb-2">
                Cloudflare API Token
              </label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Your API Token"
                value={formData.apiToken}
                onChange={(e) => {
                  setFormData({ ...formData, apiToken: e.target.value });
                  setErrors({ ...errors, apiToken: '' });
                }}
                className={errors.apiToken ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.apiToken && (
                <p className="text-sm text-red-500 mt-1">{errors.apiToken}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                The token you just created in step 8 above
              </p>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Validating...' : 'Connect Cloudflare Account'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function StepCard({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
        {number}
      </div>
      <div className="flex-1 pt-1">
        {children}
      </div>
    </div>
  );
}

function PermissionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20 text-sm font-mono">
      {children}
    </div>
  );
}
