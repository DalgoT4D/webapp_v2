'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, ChevronDown, Menu, ChevronLeft, ChevronRight, Key, Bell } from 'lucide-react';
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
import { apiGet } from '@/lib/api';

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
  } = useAuthStore();

  const [unreadCount, setUnreadCount] = useState(0);

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

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

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
      <div className="flex items-center gap-2">
        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full bg-muted hover:bg-accent hover:ring-2 hover:ring-primary/20 transition-all duration-200 mr-4"
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

        {/* Current organization name */}
        {currentOrg && (
          <div className="flex items-center">
            <span className="text-sm font-medium text-foreground max-w-[150px] truncate">
              {currentOrg.name}
            </span>
          </div>
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
          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">{userEmail}</p>
                {currentOrg && (
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {currentOrg.name} • {currentOrgUser?.new_role_slug || 'User'}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Organization switching */}
            {availableOrgs.length > 1 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {availableOrgs
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((org) => (
                    <DropdownMenuItem
                      key={org.slug}
                      onClick={() => handleOrgChange(org.slug)}
                      className={currentOrg?.slug === org.slug ? 'bg-muted' : ''}
                      disabled={isOrgSwitching}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate">{org.name}</span>
                        {currentOrg?.slug === org.slug && (
                          <span className="ml-2 text-xs text-primary">Current</span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/change-password')}>
                <Key className="mr-2 h-4 w-4" />
                <span>Change Password</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
