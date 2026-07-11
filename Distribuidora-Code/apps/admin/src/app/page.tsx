import { redirect } from 'next/navigation';

// Root page: redirect authenticated users to /dashboard
// (unauthenticated users are redirected to /login by middleware)
export default function RootPage() {
  redirect('/dashboard');
}
