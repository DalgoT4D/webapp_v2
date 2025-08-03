'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/api';
import { useAuthStore, type OrgUser } from '@/stores/authStore';
import { Eye, EyeOff } from 'lucide-react';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    token,
    setTokens,
    setOrgUsers,
    setSelectedOrg,
    logout,
    initialize,
    selectedOrgSlug,
    currentOrg,
  } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  // Initialize auth state from localStorage
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Login form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginForm>();

  // Fetch organizations when we have a token
  const { data: orgUsers, error: orgError } = useSWR<OrgUser[]>(
    token ? '/api/currentuserv2' : null
  );

  // Handle org data loading and auto-selection
  useEffect(() => {
    if (orgUsers && orgUsers.length > 0) {
      setOrgUsers(orgUsers);

      // Auto-select organization
      if (!selectedOrgSlug) {
        // If no org is selected, select the first one
        const firstOrg = orgUsers[0].org;
        setSelectedOrg(firstOrg.slug);
      } else {
        // Verify the selected org still exists
        const orgExists = orgUsers.some((ou) => ou.org.slug === selectedOrgSlug);
        if (!orgExists) {
          const firstOrg = orgUsers[0].org;
          setSelectedOrg(firstOrg.slug);
        }
      }
    }
  }, [orgUsers, selectedOrgSlug, setOrgUsers, setSelectedOrg]);

  // Redirect to main app when authenticated and org is selected
  useEffect(() => {
    if (isAuthenticated && token && currentOrg) {
      router.push('/');
    }
  }, [isAuthenticated, token, currentOrg, router]);

  // Handle login
  const onLogin = async (data: LoginForm) => {
    try {
      const response = await apiPost('/api/login/', {
        username: data.username,
        password: data.password,
      });

      if (response?.token) {
        // Store both access and refresh tokens
        setTokens(response.token, response.refresh_token);
      } else {
        setError('root', { message: 'Invalid response from server' });
      }
    } catch (error: any) {
      setError('root', { message: error.message || 'Login failed' });
    }
  };

  // Show loading while checking authentication and org selection
  if (isAuthenticated && token && !currentOrg && !orgError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  // Show login form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black relative">
      {isAuthenticated && (
        <Button onClick={logout} variant="destructive" className="absolute top-4 right-4">
          Logout
        </Button>
      )}

      <form
        onSubmit={handleSubmit(onLogin)}
        className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Welcome to Dalgo</h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in to your account</p>
        </div>

        {searchParams.get('reset') === 'success' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded text-sm">
            Password reset successful! You can now sign in with your new password.
          </div>
        )}

        <div>
          <Label htmlFor="username">Business Email</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="eg. user@domain.com"
            {...register('username', { required: 'Username is required' })}
            className="mt-1"
          />
          {errors.username && (
            <p className="text-red-600 text-sm mt-1">{errors.username.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              {...register('password', { required: 'Password is required' })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        {errors.root && (
          <div className="text-red-600 text-sm text-center">{errors.root.message}</div>
        )}

        {orgError && (
          <div className="text-red-600 text-sm text-center">
            Failed to load organizations. Please try again.
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <a href="/forgot-password" className="hover:underline">
            Forgot password?
          </a>
        </div>

        <div className="text-center text-sm">
          Not a member?{' '}
          <a href="/signup" className="text-primary hover:underline font-medium">
            Sign Up
          </a>
        </div>
      </form>
    </div>
  );
}
