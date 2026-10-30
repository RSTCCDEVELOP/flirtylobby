// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { EditModeSwitch } from "./EditMode";
import { useSession } from "./Session";
import UserMenu from "./UserMenu";

// A page without the header of the site (a design taken over from an html file): whoever is logged in still has the avatar menu (back to the dashboard / admin, log out)
// and the edit button, floating at the top right.
export default function FloatingUser() {
  const { user, ready, logout } = useSession();
  if (!ready || !user) return null;
  return (
    <div className="floating-user">
      <EditModeSwitch />
      <UserMenu user={user} onLogout={logout} />
    </div>
  );
}
