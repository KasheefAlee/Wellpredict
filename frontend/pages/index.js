import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isAuthenticated } from '../lib/auth';
import { authAPI } from '../lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const route = async () => {
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }
      try {
        const me = await authAPI.getMe();
        const role = me.data.user?.role;
        if (role === 'admin') router.push('/admin');
        else if (role === 'hr') router.push('/hr');
        else router.push('/dashboard');
      } catch (e) {
        router.push('/login');
      }
    };
    route();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Loading...</h1>
      </div>
    </div>
  );
}

