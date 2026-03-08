

## Admin Login Page

### Overview
Add email/password authentication so only logged-in admins can access Issues, Health, Trending, and AI Agent tabs. Public visitors see only the Playbook tab (no login required).

### Architecture

```text
/           → Public Playbook (no auth)
/admin      → Login page
/dashboard  → Protected admin dashboard (Issues, Playbook, Health, Trending, AI Agent)
```

### Changes

1. **Database**: Create `user_roles` table with RLS and a `has_role` security definer function (per security guidelines). Seed your account as admin after signup.

2. **Auth pages**:
   - `src/pages/AdminLogin.tsx` -- email/password login form, clean minimal design
   - `src/pages/AdminSignup.tsx` -- signup form (you can disable later once admins are created)
   - `src/pages/ResetPassword.tsx` -- password reset flow

3. **Auth context**: `src/hooks/useAuth.tsx` -- session listener, login/logout helpers, admin role check via `has_role` function.

4. **Protected route wrapper**: `src/components/ProtectedRoute.tsx` -- redirects to `/admin` if not authenticated or not admin.

5. **Public Playbook page**: `src/pages/PublicPlaybook.tsx` -- renders only the Playbook view (with DynamicFAQ) and AI chat, no header controls for editing.

6. **Dashboard update**: Move current Dashboard to `/dashboard`, guard it with ProtectedRoute. Add logout button to header.

7. **Routing** (`App.tsx`):
   - `/` → PublicPlaybook
   - `/admin` → AdminLogin
   - `/admin/signup` → AdminSignup
   - `/reset-password` → ResetPassword
   - `/dashboard` → ProtectedRoute → Dashboard

### Security
- `user_roles` table with RLS using `has_role` security definer function
- Admin status checked server-side, never from localStorage
- Email verification required before login (no auto-confirm)

