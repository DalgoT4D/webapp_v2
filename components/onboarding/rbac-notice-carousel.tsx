'use client';

import { useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiPut } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useAuthStore } from '@/stores/authStore';
import {
  RBAC_NOTICE_HEADING,
  RBAC_NOTICE_STEPS,
  RBAC_NOTICE_SUBTITLE,
  RBAC_ROLE_SUMMARIES,
} from '@/components/onboarding/constants';

// Reuses the existing self-update endpoint — see OrgUserUpdatev1 (DDP_backend).
const USER_SELF_ENDPOINT = '/api/v1/organizations/user_self/';
const CURRENT_USER_KEY = '/api/currentuserv2';
const LAST_STEP_INDEX = RBAC_NOTICE_STEPS.length - 1;
const LAST_ROLE_INDEX = RBAC_ROLE_SUMMARIES.length - 1;

/**
 * One-time RBAC v2 migration carousel. Shows once per OrgUser, on whatever
 * authenticated page they land on, then persists `has_seen_rbac_notice` so it
 * never re-appears. Mounted globally in MainLayout. Layout mirrors the
 * "Rbac spec A - migration notes" Figma frames.
 */
export function RbacNoticeCarousel() {
  const orgUsers = useAuthStore((s) => s.orgUsers);
  const selectedOrgSlug = useAuthStore((s) => s.selectedOrgSlug);
  const setOrgUsers = useAuthStore((s) => s.setOrgUsers);
  const orgUser = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug) ?? null;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (!orgUser || hasOpenedRef.current) return;
    if (orgUser.has_seen_rbac_notice) return;
    hasOpenedRef.current = true;
    setStep(0);
    setOpen(true);
    trackEvent(ANALYTICS_EVENTS.RBAC_NOTICE_VIEWED, { role: orgUser.new_role_slug });
  }, [orgUser]);

  if (!orgUser) return null;

  const persistSeen = async () => {
    // Optimistically flip the flag so the carousel never re-opens this session.
    setOrgUsers(
      orgUsers.map((ou) =>
        ou.org.slug === orgUser.org.slug ? { ...ou, has_seen_rbac_notice: true } : ou
      )
    );
    try {
      await apiPut(USER_SELF_ENDPOINT, {
        toupdate_email: orgUser.email,
        has_seen_rbac_notice: true,
      });
      await mutate(CURRENT_USER_KEY);
    } catch (error) {
      // Non-critical: the notice simply re-appears on the next login if this fails.
      console.error('Failed to persist RBAC notice dismissal', error);
    }
  };

  const handleDismiss = () => {
    trackEvent(ANALYTICS_EVENTS.RBAC_NOTICE_DISMISSED, {
      step: step + 1,
      completed: step === LAST_STEP_INDEX,
    });
    setOpen(false);
    void persistSeen();
  };

  const currentStep = RBAC_NOTICE_STEPS[step];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
      }}
    >
      <DialogContent
        data-testid="rbac-notice-modal"
        preventOutsideClose
        className="gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-[5fr_6fr]">
          {/* Left: heading + static role list, same on every step */}
          <div className="border-b p-8 md:border-r md:border-b-0">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {RBAC_NOTICE_HEADING}
            </DialogTitle>
            <DialogDescription className="mt-2 text-xs text-muted-foreground">
              {RBAC_NOTICE_SUBTITLE}
            </DialogDescription>
            <ul className="mt-6">
              {RBAC_ROLE_SUMMARIES.map((roleSummary, index) => {
                const isActive = roleSummary.name === currentStep.role;
                return (
                  <li
                    key={roleSummary.name}
                    data-testid={`rbac-notice-role-${roleSummary.name.toLowerCase()}`}
                    className={`py-3 ${index === LAST_ROLE_INDEX ? '' : 'border-b'}`}
                  >
                    <p
                      className={`text-[15px] font-semibold ${
                        isActive ? 'text-primary' : 'text-foreground opacity-60'
                      }`}
                    >
                      {roleSummary.name}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        isActive ? 'text-foreground' : 'text-muted-foreground opacity-60'
                      }`}
                    >
                      {roleSummary.summary}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: full-bleed illustration, per-step detail, navigation */}
          <div className="flex flex-col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentStep.image}
              alt=""
              className="block w-full select-none object-cover object-left-top"
            />

            <div className="flex flex-1 flex-col px-6 py-5">
              <p className="text-base font-semibold text-foreground">{currentStep.role}</p>
              <p className="mt-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
                What this means for you
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{currentStep.detail}</p>

              <div className="mt-auto flex justify-end gap-2 pt-6">
                {step > 0 && (
                  <Button
                    variant="outline"
                    data-testid="rbac-notice-back"
                    onClick={() => setStep((current) => current - 1)}
                  >
                    Back
                  </Button>
                )}
                {step < LAST_STEP_INDEX ? (
                  <Button
                    data-testid="rbac-notice-next"
                    onClick={() => setStep((current) => current + 1)}
                  >
                    Next
                  </Button>
                ) : (
                  <Button data-testid="rbac-notice-continue" onClick={handleDismiss}>
                    Continue to workspace
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
