'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';
import { apiPost } from '@/lib/api';
import { useAuthStore, type OrgUser } from '@/stores/authStore';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

interface LoginForm {
  username: string;
  password: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    setAuthenticated,
    setOrgUsers,
    setSelectedOrg,
    logout,
    initialize,
    selectedOrgSlug,
    currentOrg,
  } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  // Login form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginForm>();

  // Handle login
  const onLogin = async (data: LoginForm) => {
    try {
      await apiPost('/api/v2/login/', {
        username: data.username,
        password: data.password,
      });

      // Cookies are set automatically by the server
      setAuthenticated(true);

      // Redirect to impact page - AuthGuard will handle authentication
    } catch (error: any) {
      setError('root', { message: error.message || 'Login failed' });
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/impact');
    }
  }, [isAuthenticated]);

  // Show loading while checking authentication and org selection
  if (isAuthenticated && !currentOrg) {
    return (
      <AnimatedBackgroundSimple>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium text-white">Setting up your workspace...</p>
          </div>
        </div>
      </AnimatedBackgroundSimple>
    );
  }

  // Show login form
  return (
    <AnimatedBackgroundSimple>
      <div className="flex min-h-screen items-center justify-center relative">
        <form
          onSubmit={handleSubmit(onLogin)}
          className="w-full max-w-sm space-y-6 rounded-lg bg-white/95 backdrop-blur-sm p-8 shadow-lg border border-white/20"
        >
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Image
                src="/dalgo_logo.svg"
                alt="Dalgo"
                width={80}
                height={90}
                className="text-primary"
              />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to Dalgo</h1>
            <p className="text-gray-600 dark:text-gray-400">Sign in to your account</p>
          </div>

          {searchParams.get('reset') === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded text-sm">
              Password reset successful! You can now sign in with your new password.
            </div>
          )}

          {searchParams.get('invitation') === 'accepted' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded text-sm">
              Invitation accepted successfully! You can now sign in to your account.
            </div>
          )}

          <div>
            <Label htmlFor="username">Business Email*</Label>
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
            <Label htmlFor="password">Password*</Label>
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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <a href="/forgot-password" className="hover:underline">
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </AnimatedBackgroundSimple>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AnimatedBackgroundSimple>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium text-white">Loading...</p>
            </div>
          </div>
        </AnimatedBackgroundSimple>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
