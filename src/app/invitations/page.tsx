'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';
import { usePublicInvitationAcceptance } from '@/hooks/api/useUserManagement';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InvitationFormData {
  password: string;
  confirmPassword: string;
  work_domain: string;
}

function InvitationAcceptanceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite_code');
  const { acceptInvitation } = usePublicInvitationAcceptance();

  const [formData, setFormData] = useState<InvitationFormData>({
    password: '',
    confirmPassword: '',
    work_domain: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [needsPassword, setNeedsPassword] = useState(false); // Start with no password fields, like webapp

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode) return;

    setError('');

    // Validate password if needed
    if (needsPassword) {
      if (!formData.password) {
        setError('Password is required');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
      if (!formData.work_domain) {
        setError('Please select an option for work domain');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // For password required scenario, don't show toast - we'll show inline message
      const showToast = needsPassword; // Only show toast when we have password (final submission)

      await acceptInvitation(
        {
          invite_code: inviteCode,
          password: needsPassword ? formData.password : undefined,
          work_domain: formData.work_domain || undefined,
        },
        showToast
      );

      // Success - redirect to login page
      router.push('/login?invitation=accepted');
    } catch (error: any) {
      // If error says password is required, show password fields
      if (error.message?.includes('password') && error.message?.includes('required')) {
        setNeedsPassword(true);
        setError('Please set a password for your account');
      } else {
        setError(error.message || 'Failed to accept invitation');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof InvitationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(''); // Clear error when user starts typing
  };

  if (!inviteCode) {
    return (
      <AnimatedBackgroundSimple>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-4">Invalid Invitation</h1>
            <p className="mb-6">The invitation link is invalid or malformed.</p>
            <Button onClick={() => router.push('/login')} variant="secondary">
              Go to Login
            </Button>
          </div>
        </div>
      </AnimatedBackgroundSimple>
    );
  }

  return (
    <AnimatedBackgroundSimple>
      <div className="flex min-h-screen items-center justify-center">
        <form
          onSubmit={handleSubmit}
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
            <h1 className="text-2xl font-bold mb-2">Welcome aboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {needsPassword
                ? 'Please set up your account password'
                : 'Thank you. You are at the last step'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {needsPassword && (
            <>
              <div>
                <Label htmlFor="password">Password*</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
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
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password*</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="work_domain">
                  Which domain best describes the work you do at the organization?
                </Label>
                <Select
                  value={formData.work_domain || ''}
                  onValueChange={(value) => handleInputChange('work_domain', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select your domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Prefer not to say</SelectItem>
                    <SelectItem value="monitoring_evaluation">Monitoring & Evaluation</SelectItem>
                    <SelectItem value="program_manager">Program Manager</SelectItem>
                    <SelectItem value="data_tech">Data & Tech</SelectItem>
                    <SelectItem value="leadership">Leadership (COO, Founder, CTO etc.)</SelectItem>
                    <SelectItem value="field_worker">Field worker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Accepting...' : 'Accept'}
          </Button>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="hover:underline font-medium">
              Sign in here
            </a>
          </div>
        </form>
      </div>
    </AnimatedBackgroundSimple>
  );
}

export default function InvitationsPage() {
  return (
    <Suspense
      fallback={
        <AnimatedBackgroundSimple>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium text-white">Loading invitation...</p>
            </div>
          </div>
        </AnimatedBackgroundSimple>
      }
    >
      <InvitationAcceptanceForm />
    </Suspense>
  );
}
