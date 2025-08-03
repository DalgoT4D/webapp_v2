'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/api';
import Link from 'next/link';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    try {
      await apiPost('/api/users/forgot_password/', {
        email: data.email,
      });
      setEmailSent(true);
    } catch (error: any) {
      setError('root', { message: error.message || 'Something went wrong. Please try again.' });
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Check your email</h1>
            <p className="text-gray-600 dark:text-gray-400">
              We've sent a password reset link to your email address.
            </p>
          </div>
          <div className="text-center pt-4">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Forgot password</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your registered email"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
            className="mt-1"
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
        </div>

        {errors.root && (
          <div className="text-red-600 text-sm text-center">{errors.root.message}</div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </Button>

        <div className="text-center text-sm">
          Remember your password?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
