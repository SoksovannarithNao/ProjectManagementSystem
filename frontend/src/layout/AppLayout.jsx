import { Outlet } from 'react-router-dom'
import { LayoutProvider } from './LayoutContext'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <LayoutProvider>
      <div className="bg-canvas flex min-h-[100svh]">
        <Sidebar />
        <main className="ml-[var(--sidebar-width)] min-w-0 flex-1 max-lg:ml-0">
          <div className="mx-auto max-w-[1440px] px-10 pt-8 pb-14 max-lg:px-6 max-lg:pt-5 max-lg:pb-10 max-sm:px-4 max-sm:pt-4 max-sm:pb-8">
            <Outlet />
          </div>
        </main>
      </div>
    </LayoutProvider>
  )
}
