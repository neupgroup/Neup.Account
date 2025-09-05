
'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserDetails, UserActivityLog, UserPermissions } from '@/types';
import { ProfileForm } from './profile-form'; // Changed import
import { VerificationManager } from './verification-manager';
import { ActivityList } from './activity/page'; 
import { PermissionsForm } from './permissions/form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from '@/components/icons';
import { useRouter } from 'next/navigation';

interface UserDetailsClientProps {
    initialUserDetails: UserDetails;
    initialActivity?: UserActivityLog[];
    initialPermissions?: UserPermissions;
}

export function UserDetailsClient({ initialUserDetails, initialActivity, initialPermissions }: UserDetailsClientProps) {
    const [userDetails, setUserDetails] = useState(initialUserDetails);
    const router = useRouter();

    const handleBack = () => {
        router.push('/manage/root/accounts/list');
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex items-center mb-4">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold ml-2">{userDetails.profile.firstName} {userDetails.profile.lastName}</h1>
            </div>

            <Tabs defaultValue="profile">
                <TabsList>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="verification">Verification</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                    <ProfileForm 
                        profile={userDetails.profile} 
                        accountId={userDetails.accountId} 
                    />
                </TabsContent>
                <TabsContent value="verification">
                    <VerificationManager accountId={userDetails.accountId} />
                </TabsContent>
                <TabsContent value="activity">
                    <ActivityList initialActivity={initialActivity} accountId={userDetails.accountId} />
                </TabsContent>
                <TabsContent value="permissions">
                    <PermissionsForm 
                        accountId={userDetails.accountId} 
                        assignedPermissionSetIds={initialPermissions?.assignedPermissionSetIds || []} 
                        restrictedPermissionSetIds={initialPermissions?.restrictedPermissionSetIds || []}                    
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
