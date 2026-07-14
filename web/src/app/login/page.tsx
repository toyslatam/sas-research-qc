'use client';

import { Suspense } from 'react';
import { LoginForm } from '@/platform/auth/LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
