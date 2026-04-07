import React from 'react';
import { HeaderV1 } from '@/components/layout/header.v1';
import { FooterV1 } from '@/components/layout/footer.v1';
import { Sidebar } from '../sidebar';
import { Body } from '../body';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
    return (
        <div className="min-h-screen bg-white flex flex-col">
            <HeaderV1 />
            <div className="pt-16">
                <div className="w-full bg-white"> {/* Full body background */}
                    <div className="max-w-[1440px] mx-auto flex items-start">
                        <Sidebar />
                        <Body>
                            {children}
                        </Body>
                    </div>
                </div>
            </div>
            <FooterV1 />
        </div>
    );
};
