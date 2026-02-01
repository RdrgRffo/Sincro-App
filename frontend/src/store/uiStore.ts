import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  scheduleSidebarOpen: boolean;
  toggleScheduleSidebar: () => void;
  setScheduleSidebarOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      scheduleSidebarOpen: true,
      toggleScheduleSidebar: () => set((s) => ({ scheduleSidebarOpen: !s.scheduleSidebarOpen })),
      setScheduleSidebarOpen: (v) => set({ scheduleSidebarOpen: v }),
    }),
    {
      name: 'sincro-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        scheduleSidebarOpen: state.scheduleSidebarOpen,
      }),
    },
  )
);
