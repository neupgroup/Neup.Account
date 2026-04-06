import React from 'react';

export const Sidebar = () => {
    return (
        <aside className="w-64 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto bg-gray-50 border-r border-gray-200 flex-shrink-0 hidden md:block">
            <nav className="p-4">
                {/* Add navigation links here */}
                <ul>
                    <li className="mb-2"><a href="#" className="block p-2 rounded hover:bg-gray-100">Home</a></li>
                    <li className="mb-2"><a href="#" className="block p-2 rounded hover:bg-gray-100">About</a></li>
                </ul>
            </nav>
        </aside>
    );
};
