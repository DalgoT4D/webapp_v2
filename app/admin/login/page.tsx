'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { Eye, EyeOff, Shield } from 'lucide-react';

interface AdminLoginForm {
  username: string;
  password: string;
}

/**
 * Collapse a sign-in error into a fixed, non-identifying category for analytics.
 * The backend answers 403 "not a platform admin" for a real user who lacks the
 * flag, and 401 "invalid credentials" for a bad password — worth telling apart,
 * since the first means someone is knocking on a door they can see.
 */
function failureReason(message: string): 'not_platform_admin' | 'invalid_credentials' | 'error' {
  const normalized = message.toLowerCase();
  if (normalized.includes('platform admin')) return 'not_platform_admin';
  if (normalized.includes('credential') || normalized.includes('password')) {
    return 'invalid_credentials';
  }
  return 'error';
}

/**
 * Admin portal sign-in — an independent session, separate from the normal product login.
 * It calls the admin login endpoint, which issues the admin_access_token cookie only for a
 * platform admin; a non-admin is refused here (403) and shown the error. This page is
 * public in client-layout (not wrapped in AuthGuard/AdminGuard).
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<AdminLoginForm>();

  const onLogin = async (data: AdminLoginForm) => {
    try {
      await apiPost('/api/v1/admin/login/', {
        username: data.username,
        password: data.password,
      });
      trackEvent(ANALYTICS_EVENTS.ADMIN_LOGGED_IN);
      // The admin_access_token cookie is set by the server; AdminGuard will admit us.
      router.replace('/admin');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      // A refused admin sign-in is worth a signal of its own — this is a
      // higher-privilege surface. Send a coarse reason only: never the raw
      // message (it could echo input) and never the email.
      trackEvent(ANALYTICS_EVENTS.ADMIN_LOGIN_FAILED, { reason: failureReason(message) });
      setError('root', { message });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <form
        onSubmit={handleSubmit(onLogin)}
        data-testid="admin-login-form"
        className="w-full max-w-sm space-y-6 rounded-lg bg-white/95 backdrop-blur-sm p-8 shadow-lg border border-white/20"
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Admin Portal</h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in to the Dalgo admin portal</p>
        </div>

        <div>
          <Label htmlFor="username">Business Email*</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="eg. user@domain.com"
            data-testid="admin-login-username"
            {...register('username', { required: 'Username is required' })}
            className="mt-1"
          />
          {errors.username && (
            <p className="text-red-600 text-sm mt-1">{errors.username.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="password">Password*</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              data-testid="admin-login-password"
              {...register('password', { required: 'Password is required' })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              data-testid="admin-login-toggle-password"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        {errors.root && (
          <div className="text-red-600 text-sm text-center" data-testid="admin-login-error">
            {errors.root.message}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
          data-testid="admin-login-submit"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
