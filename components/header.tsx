'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LogOut,
  ChevronDown,
  Menu,
  ChevronLeft,
  ChevronRight,
  Key,
  Bell,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { apiGet, apiPost } from '@/lib/api';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { CreateOrgDialog } from '@/components/settings/organizations/CreateOrgDialog';

interface HeaderProps {
  onMenuToggle?: () => void;
  hideMenu?: boolean;
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
  responsive?: any;
}

export function Header({
  onMenuToggle,
  hideMenu = false,
  onSidebarToggle,
  isSidebarCollapsed = false,
  responsive,
}: HeaderProps) {
  const router = useRouter();
  const {
    currentOrg,
    orgUsers,
    setSelectedOrg,
    setOrgSwitching,
    isOrgSwitching,
    logout,
    getCurrentOrgUser,
    isAuthenticated,
  } = useAuthStore();

  const [unreadCount, setUnreadCount] = useState(0);
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);

  const { hasPermission } = useUserPermissions();
  const canCreateOrg = hasPermission('can_create_org');

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const data = await apiGet('/api/notifications/unread_count');
        setUnreadCount(data?.res || 0);
      } catch (error) {
        console.error('Failed to fetch notification count:', error);
      }
    };

    fetchUnreadCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  // Get current user email
  const currentOrgUser = getCurrentOrgUser();
  const userEmail = currentOrgUser?.email || 'Unknown User';

  // Get user initials for avatar
  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const handleOrgChange = async (orgSlug: string) => {
    // Don't allow switching if already switching
    if (isOrgSwitching) return;

    // Set switching state to show loading
    setOrgSwitching(true);

    // Update the selected org in store and localStorage
    setSelectedOrg(orgSlug);

    try {
      // Show loader for minimum 2 seconds to give substantial feel
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2000));

      // Wait for minimum delay then refresh
      await minDelay;

      // Refresh the page to trigger data refetch with new org context
      // This is essential for all API calls to use the new org header
      router.refresh();

      // Clear switching state after a slight delay to allow refresh to complete
      setTimeout(() => {
        setOrgSwitching(false);
      }, 500);
    } catch (error) {
      // If anything goes wrong, clear the switching state
      setOrgSwitching(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Call the logout endpoint to clear cookies on server
      await apiPost('/api/logout/', {});
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with logout even if API call fails
    }

    // Clear local state and redirect
    logout();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  // Available organizations for switching
  const availableOrgs = orgUsers.map((ou) => ou.org);

  return (
    <div className="flex h-16 items-center justify-between w-full">
      {/* Left side - Logo, Sidebar toggle, and status */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        {!hideMenu && onMenuToggle && responsive && !responsive.isDesktop && (
          <Button variant="ghost" size="icon" onClick={onMenuToggle} className="h-9 w-9">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        )}

        {/* Dalgo Logo - Always visible */}
        <div className="flex items-center gap-3">
          <Image
            src="/dalgo_logo.svg"
            alt="Dalgo"
            width={60}
            height={68}
            className="text-primary"
          />
        </div>

        {/* Organization switching status */}
        <div className="hidden md:block">
          {isOrgSwitching && (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm text-primary font-medium">Switching organization...</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full bg-muted hover:bg-accent hover:ring-2 hover:ring-primary/20 transition-all duration-200"
          onClick={() => {
            router.push('/notifications');
          }}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>

        {/* Current Organization Name */}
        {currentOrg && (
          <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
            {currentOrg.name}
          </span>
        )}

        {/* Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full hover:bg-accent hover:ring-2 hover:ring-primary/20 transition-all duration-200 cursor-pointer"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className="text-sm font-medium text-blue-700"
                  style={{ backgroundColor: '#E0F2FE' }}
                >
                  {getInitials(userEmail)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 p-2" align="end" forceMount>
            <DropdownMenuLabel className="font-normal px-3 py-2.5">
              <div className="flex flex-col space-y-1">
                <p className="text-base font-medium leading-snug truncate">{userEmail}</p>
                {currentOrg && (
                  <p className="text-sm leading-tight text-muted-foreground truncate">
                    {currentOrg.name} • {currentOrgUser?.new_role_slug || 'User'}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-2" />

            {/* Organization switching - only show if more than 1 organization */}
            {availableOrgs.length > 1 && (
              <>
                <DropdownMenuLabel className="text-sm text-muted-foreground px-3 py-1.5 pb-1">
                  Organizations
                </DropdownMenuLabel>
                <div className="px-1 pb-1.5 max-h-[300px] overflow-y-auto">
                  {availableOrgs
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((org) => (
                      <DropdownMenuItem
                        key={org.slug}
                        onClick={() => handleOrgChange(org.slug)}
                        className={`mx-1 my-0.5 px-3 py-2 rounded-md ${
                          currentOrg?.slug === org.slug ? 'bg-muted' : ''
                        }`}
                        disabled={isOrgSwitching}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate font-medium text-base">{org.name}</span>
                          {currentOrg?.slug === org.slug && (
                            <span className="ml-2 text-sm text-primary font-medium">Current</span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                </div>
                {canCreateOrg && (
                  <div className="px-1 pb-1.5">
                    <DropdownMenuItem
                      onClick={() => setShowCreateOrgDialog(true)}
                      className="mx-1 my-0.5 px-3 py-2 rounded-md"
                    >
                      <div className="flex items-center w-full">
                        <Plus className="mr-3 h-4 w-4" />
                        <span className="font-medium text-base">Create Organization</span>
                      </div>
                    </DropdownMenuItem>
                  </div>
                )}
                <DropdownMenuSeparator className="mx-2" />
              </>
            )}

            {/* Show create org option even if user has only one org but has permission */}
            {availableOrgs.length === 1 && canCreateOrg && (
              <>
                <DropdownMenuLabel className="text-sm text-muted-foreground px-3 py-1.5 pb-1">
                  Organizations
                </DropdownMenuLabel>
                <div className="px-1 pb-1.5">
                  <DropdownMenuItem
                    onClick={() => setShowCreateOrgDialog(true)}
                    className="mx-1 my-0.5 px-3 py-2 rounded-md"
                  >
                    <div className="flex items-center w-full">
                      <Plus className="mr-3 h-4 w-4" />
                      <span className="font-medium text-base">Create Organization</span>
                    </div>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator className="mx-2" />
              </>
            )}

            <DropdownMenuGroup className="px-1 py-1.5">
              <DropdownMenuItem
                onClick={() => router.push('/change-password')}
                className="mx-1 my-0.5 px-3 py-2 rounded-md"
              >
                <Key className="mr-3 h-4 w-4" />
                <span className="font-medium text-base">Change Password</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="mx-2" />
            <div className="px-1 py-1.5">
              <DropdownMenuItem
                onClick={handleLogout}
                className="mx-1 my-0.5 px-3 py-2 rounded-md text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span className="font-medium text-base">Log out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create Organization Dialog */}
      <CreateOrgDialog open={showCreateOrgDialog} onOpenChange={setShowCreateOrgDialog} />
    </div>
  );
}
