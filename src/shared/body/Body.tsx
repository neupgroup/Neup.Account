import React from 'react';

interface BodyProps {
    children: React.ReactNode;
}

export const Body = ({ children }: BodyProps) => {
    return (
        <main className="flex-1 min-w-0 p-6">
            {children}
        </main>
    );
};
