'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/api';
import Link from 'next/link';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<ResetPasswordForm>();

  const password = watch('password');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError('root', { message: 'Invalid password reset link' });
    }
    setToken(tokenParam);
  }, [searchParams, setError]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError('root', { message: 'Invalid password reset link' });
      return;
    }

    try {
      await apiPost('/api/users/reset_password/', {
        token: token,
        password: data.password,
      });

      // Show success message and redirect to login
      router.push('/login?reset=success');
    } catch (error: any) {
      // Handle specific error messages from the backend
      if (error.message?.includes('detail')) {
        try {
          const errorDetail = JSON.parse(error.message);
          setError('root', { message: errorDetail.detail[0]?.msg || 'Failed to reset password' });
        } catch {
          setError('root', { message: error.message || 'Failed to reset password' });
        }
      } else {
        setError('root', {
          message: error.message || 'Failed to reset password. Please try again.',
        });
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Set new password</h1>
          <p className="text-gray-600 dark:text-gray-400">Please enter your new password</p>
        </div>

        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter new password"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            })}
            className="mt-1"
          />
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === password || 'Passwords do not match',
            })}
            className="mt-1"
          />
          {errors.confirmPassword && (
            <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {errors.root && (
          <div className="text-red-600 text-sm text-center">{errors.root.message}</div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
          {isSubmitting ? 'Resetting...' : 'Reset password'}
        </Button>

        <div className="text-center text-sm">
          <Link href="/login" className="text-primary hover:underline font-medium">
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}
