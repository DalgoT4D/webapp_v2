'use client';

/**
 * Welcome modal shown once per session to the read-only guest demo user.
 *
 * On guest login the app would normally drop the user on the Impact page; this
 * modal greets them first and offers to start the guided walkthrough of the
 * prebuilt Dalgo pipeline. "Skip" dismisses it (Impact stays); "Next" starts the
 * tour. Gated by sessionStorage so it appears once per browser session.
 *
 * NEW, self-contained — only shows for the guest account, never for real users.
 */
import { useEffect, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const TEAL = '#00897B';
const GUEST_EMAIL = 'guest_user@dalgo.org';
const SEEN_KEY = 'dalgo_guest_welcome_seen';

export function GuestWelcomeModal({
  suppressed,
  onStart,
}: {
  suppressed: boolean;
  onStart: () => void;
}) {
  const { orgUsers, selectedOrgSlug } = useAuthStore();
  const currentEmail =
    orgUsers.find((ou) => ou.org.slug === selectedOrgSlug)?.email ?? orgUsers[0]?.email ?? null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentEmail) return;
    if (currentEmail.toLowerCase() !== GUEST_EMAIL) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // sessionStorage may be unavailable
    }
    if (!seen) setOpen(true);
  }, [currentEmail]);

  function markSeen() {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
  }

  function skip() {
    markSeen();
    setOpen(false);
  }

  function start() {
    markSeen();
    setOpen(false);
    onStart();
  }

  if (!open || suppressed) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/90 p-4"
      style={{ fontFamily: 'var(--font-anek-latin), system-ui, sans-serif' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-[440px] max-w-[92vw] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* teal accent header */}
        <div
          className="flex flex-col items-center gap-3 px-7 pb-6 pt-8 text-center"
          style={{ background: `linear-gradient(160deg, ${TEAL}14, transparent)` }}
        >
          <button
            type="button"
            onClick={skip}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: `${TEAL}1A` }}
          >
            <Compass className="h-7 w-7" style={{ color: TEAL }} />
          </span>
          <h2 className="text-xl font-bold text-gray-900">Welcome to Dalgo&apos;s guided tour</h2>
          <p className="text-[14px] leading-relaxed text-gray-600">
            We&apos;ll walk you through a prebuilt Dalgo pipeline — from raw data all the way to a
            finished dashboard — so you can see how the whole product fits together. It only takes a
            minute.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 px-7 pb-7">
          <button
            type="button"
            onClick={skip}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: TEAL }}
          >
            Start the tour →
          </button>
        </div>
      </div>
    </div>
  );
}
