import React from 'react';
import { Header } from '../header';
import { Sidebar } from '../sidebar';
import { Body } from '../body';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
    return (
        <div className="min-h-screen bg-white">
            <Header />
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
        </div>
    );
};
