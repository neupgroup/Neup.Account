
import React from 'react';
import SigninForm from './form';
import { Skeleton } from '@/components/ui/skeleton';

function LoginPageSkeleton() {
    return (
        <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
             <div className="mx-auto max-w-lg w-full p-6 md:p-0">
                <Skeleton className="h-[450px] w-full" />
            </div>
        </div>
    )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginPageSkeleton />}>
        <SigninForm />
    </React.Suspense>
  )
}
