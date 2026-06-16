"use client";

import { useClerk, useUser } from "@clerk/nextjs";

import { rootUser } from "@/data/users";

import { NavUser } from "./nav-user";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function SidebarUserInfo() {
  if (!hasClerkKey) {
    return <NavUser user={rootUser} />;
  }

  return <ClerkSidebarUserInfo />;
}

function ClerkSidebarUserInfo() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const fallbackName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    rootUser.name;

  const sidebarUser = {
    name: fallbackName,
    email: user?.primaryEmailAddress?.emailAddress || rootUser.email,
    avatar: user?.imageUrl || rootUser.avatar,
  };

  return (
    <NavUser user={isLoaded ? sidebarUser : rootUser} onSignOut={() => signOut({ redirectUrl: "/auth/sign-in" })} />
  );
}
