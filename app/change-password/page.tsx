'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { apiPost } from '@/lib/api';
import { hashPassword } from '@/lib/utils';
import { Loader2, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import Image from 'next/image';

interface ChangePasswordForm {
  password: string;
  confirmPassword: string;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ChangePasswordForm>({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  const onSubmit = async (data: ChangePasswordForm) => {
    if (data.password !== data.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password and Confirm password must be same',
      });
      return;
    }

    if (data.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 8 characters long',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiPost('/api/users/change_password/', {
        password: hashPassword(data.password),
        confirmPassword: hashPassword(data.confirmPassword),
      });
      setShowSuccess(true);
      toast({
        title: 'Success',
        description: 'Your password has been changed successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to change password',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <main className="min-h-[100vh] w-full flex items-center justify-center bg-background fixed inset-0">
        <div className="w-full max-w-md p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Go back</span>
                </Button>
              </div>

              {/* Dalgo Logo */}
              <div className="flex justify-center mb-4">
                <Image
                  src="/dalgo_logo.svg"
                  alt="Dalgo"
                  width={60}
                  height={68}
                  className="text-primary"
                />
              </div>
            </CardHeader>
            <CardContent className="text-center">
              <h2 className="text-2xl font-bold mb-4">Password Changed Successfully</h2>
              <p className="text-muted-foreground mb-6">
                Your password has been updated. You can now use your new password to log in.
              </p>
              <Button className="w-full" onClick={() => router.push('/dashboards')}>
                Continue to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100vh] w-full flex items-center justify-center bg-background fixed inset-0">
      <div className="w-full max-w-md p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Go back</span>
              </Button>
            </div>

            {/* Dalgo Logo */}
            <div className="flex justify-center mb-4">
              <Image
                src="/dalgo_logo.svg"
                alt="Dalgo"
                width={60}
                height={68}
                className="text-primary"
              />
            </div>

            <CardTitle className="text-2xl text-center">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create new password"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
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
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) => value === password || 'Passwords do not match',
                    })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
