import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { STAFF_NAV_ITEMS } from './Sidebar';

interface StaffLayoutProps {
  currentModule: string;
  onSelectModule: (id: string) => void;
  children: React.ReactNode;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  currentModule,
  onSelectModule,
  children,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const activeItem = STAFF_NAV_ITEMS.find((item) => item.id === currentModule);
  const activeTitle = activeItem ? activeItem.label : 'Faculty Portal';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Restricted Staff Sidebar */}
      <Sidebar
        role="STAFF"
        currentModule={currentModule}
        onSelectModule={onSelectModule}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Container */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Topbar
          onToggleSidebar={() => setIsMobileOpen(!isMobileOpen)}
          activeModuleTitle={activeTitle}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
