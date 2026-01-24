import React from 'react';

export const Header = () => {
    return (
        <header className="w-full h-16 bg-white border-b border-gray-200 fixed top-0 left-0 z-50">
            <div className="max-w-[1440px] mx-auto h-full flex items-center px-6">
                <div className="text-xl font-bold">Logo</div>
                {/* Add header content here */}
            </div>
        </header>
    );
};
