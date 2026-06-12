'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { apiDelete, apiPost, apiPostFormData } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface OrgLogoData {
  logo_url: string;
  logo_filename: string | null;
  updated_at: string;
}

interface OrgLogoApiResponse {
  success: boolean;
  data: OrgLogoData;
}

type LogoSource = 'upload' | 'url';

export function useBranding() {
  const { orgUsers, setOrgUsers, currentOrg } = useAuthStore();
  const { mutate } = useSWRConfig();

  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const currentLogoUrl: string | null = currentOrg?.logo_url ?? null;
  const savedLogoSource: LogoSource | null = currentLogoUrl
    ? currentOrg?.logo_filename
      ? 'upload'
      : 'url'
    : null;

  const save = useCallback(
    async (
      activeTab: 'upload' | 'link',
      selectedFile: File | null,
      linkInput: string
    ): Promise<boolean> => {
      setIsSaving(true);
      try {
        let savedUrl: string | null = null;
        let res: OrgLogoApiResponse | null = null;

        if (activeTab === 'upload' && selectedFile) {
          const formData = new FormData();
          formData.append('file', selectedFile);
          res = await apiPostFormData('/api/org/logo/upload/', formData);
          savedUrl = res.data.logo_url;
        } else if (activeTab === 'link' && linkInput.trim()) {
          res = await apiPost('/api/org/logo/url/', { image_url: linkInput.trim() });
          savedUrl = res.data.logo_url;
        }

        if (currentOrg) {
          const savedFilename = res?.data?.logo_filename ?? null;
          setOrgUsers(
            orgUsers.map((ou) =>
              ou.org.slug === currentOrg.slug
                ? {
                    ...ou,
                    org: {
                      ...ou.org,
                      logo_url: savedUrl ?? undefined,
                      logo_filename: savedFilename,
                    },
                  }
                : ou
            )
          );
        }

        await mutate('/api/currentuserv2');
        trackEvent(ANALYTICS_EVENTS.BRANDING_LOGO_SAVED, {
          logo_source: activeTab,
          filename: res?.data?.logo_filename ?? null,
          logo_url: savedUrl,
        });
        toastSuccess.saved('Organization logo');
        return true;
      } catch (error) {
        toastError.save(error, 'logo');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [currentOrg, orgUsers, setOrgUsers, mutate]
  );

  const remove = useCallback(async (): Promise<boolean> => {
    setIsRemoving(true);
    try {
      await apiDelete('/api/org/logo/');

      if (currentOrg) {
        setOrgUsers(
          orgUsers.map((ou) =>
            ou.org.slug === currentOrg.slug
              ? { ...ou, org: { ...ou.org, logo_url: undefined, logo_filename: null } }
              : ou
          )
        );
      }

      await mutate('/api/currentuserv2');
      trackEvent(ANALYTICS_EVENTS.BRANDING_LOGO_REMOVED, { logo_source: savedLogoSource });
      toastSuccess.deleted('Organization logo');
      return true;
    } catch (error) {
      toastError.save(error, 'logo');
      return false;
    } finally {
      setIsRemoving(false);
    }
  }, [currentOrg, orgUsers, setOrgUsers, mutate, savedLogoSource]);

  return {
    currentOrg,
    currentLogoUrl,
    savedLogoSource,
    isSaving,
    isRemoving,
    save,
    remove,
  };
}
