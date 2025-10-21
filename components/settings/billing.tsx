'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Info, Calendar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/use-toast';

interface OrgPlan {
  org: {
    name: string;
    slug: string;
    type: string;
  };
  base_plan: string;
  superset_included: boolean;
  subscription_duration: string;
  features: {
    pipeline?: string[];
    superset?: string[];
    aiFeatures?: string[];
    dataQuality?: string[];
  };
  start_date: string | null;
  end_date: string | null;
  can_upgrade_plan: boolean;
  upgrade_requested: boolean;
}

const calculatePlanStatus = (endDate: string | null) => {
  if (!endDate) return { isExpired: false, isLessThanAWeek: false, daysRemaining: null };

  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    isExpired: diffDays < 0,
    isLessThanAWeek: diffDays >= 0 && diffDays < 7,
    daysRemaining: Math.max(0, diffDays),
  };
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function Billing() {
  const [orgPlan, setOrgPlan] = useState<OrgPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const { getCurrentOrgUser } = useAuthStore();
  const { toast } = useToast();

  const currentOrgUser = getCurrentOrgUser();
  const permissions = currentOrgUser?.permissions || [];
  const canUpgrade = permissions.some((p) => p.slug === 'can_initiate_org_plan_upgrade');

  useEffect(() => {
    fetchOrgPlan();
  }, []);

  const fetchOrgPlan = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/orgpreferences/org-plan');
      if (response.success && response.res) {
        setOrgPlan(response.res);
      }
    } catch (error: any) {
      console.error('Failed to fetch org plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradePlan = async () => {
    setUpgrading(true);
    try {
      const response = await apiPost('/api/orgpreferences/org-plan/upgrade', {});
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Upgrade request has been successfully registered',
        });
        fetchOrgPlan();
      }
    } catch (error: any) {
      console.error('Failed to upgrade plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit upgrade request',
        variant: 'destructive',
      });
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading Billing Information...</div>
        </div>
      </div>
    );
  }

  if (!orgPlan) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-muted-foreground">No Billing Information Available</div>
        </div>
      </div>
    );
  }

  const { isExpired, isLessThanAWeek, daysRemaining } = calculatePlanStatus(orgPlan.end_date);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing</h1>
        <p className="text-muted-foreground">Manage Your Subscription And Billing Information</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl text-primary">
                {orgPlan.base_plan}
                {orgPlan.superset_included && !orgPlan.base_plan.includes('Free trial') && (
                  <span className="text-foreground"> + Superset</span>
                )}
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-semibold">
                {orgPlan.subscription_duration}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {orgPlan.upgrade_requested && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-5 w-5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The request to upgrade the plan has been registered</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                onClick={handleUpgradePlan}
                disabled={
                  !orgPlan.can_upgrade_plan || !canUpgrade || orgPlan.upgrade_requested || upgrading
                }
                className="min-w-[100px]"
              >
                {upgrading ? 'Upgrading...' : 'Upgrade'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Plan Features</h3>
            <div className="space-y-2">
              {/* Pipeline Features */}
              {orgPlan.features.pipeline && orgPlan.features.pipeline.length > 0 && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {orgPlan.features.pipeline.join(' | ')}
                  </p>
                </div>
              )}

              {/* Other Features */}
              {Object.entries(orgPlan.features).map(([key, items]) => {
                if (key === 'pipeline' || !items || items.length === 0) return null;

                return (
                  <div key={key} className="space-y-2">
                    {Array.isArray(items) ? (
                      items.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-sm font-medium text-muted-foreground">{item}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium text-muted-foreground">{items}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subscription Period */}
          {(orgPlan.start_date || orgPlan.end_date) && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Calendar className="h-5 w-5 text-muted-foreground" />

                {orgPlan.start_date && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">Start date:</span>
                    <span className="text-sm font-semibold">{formatDate(orgPlan.start_date)}</span>
                  </div>
                )}

                {orgPlan.end_date && (
                  <>
                    <span className="text-muted-foreground">-</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">End date:</span>
                      <span className="text-sm font-semibold">{formatDate(orgPlan.end_date)}</span>
                    </div>

                    <span className="text-muted-foreground">-</span>
                    <span
                      className={`text-sm font-semibold ${
                        isExpired
                          ? 'text-destructive'
                          : isLessThanAWeek
                            ? 'text-orange-500'
                            : 'text-primary'
                      }`}
                    >
                      {isExpired
                        ? 'Plan has expired'
                        : daysRemaining !== null
                          ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
                          : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
