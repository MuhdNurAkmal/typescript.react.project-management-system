import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { ConfirmProvider } from '@/components/ConfirmProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppLayout from '@/components/layout/AppLayout'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute'
import { Toaster } from '@/components/ui/sonner'
import { OrgProvider } from '@/components/OrgProvider'
import { RequireOrg } from '@/components/RequireOrg'
import Company from '@/pages/Company'
import Dashboard from '@/pages/Dashboard'
import ForgotPassword from '@/pages/ForgotPassword'
import Attendance from '@/pages/Attendance'
import NotFound from '@/pages/NotFound'
import Login from '@/pages/Login'
import ProjectDetail from '@/pages/ProjectDetail'
import Projects from '@/pages/Projects'
import MyTasks from '@/pages/MyTasks'
import Profile from '@/pages/Profile'
import Reports from '@/pages/Reports'
import Register from '@/pages/Register'
import ResetPassword from '@/pages/ResetPassword'

const queryClient = new QueryClient()

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrgProvider>
        <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<RequireOrg />}>
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:projectId" element={<ProjectDetail />} />
                <Route path="my-tasks" element={<MyTasks />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="reports" element={<Reports />} />
                <Route path="profile" element={<Profile />} />
                <Route path="company" element={<Company />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        </ConfirmProvider>
        </OrgProvider>
      </AuthProvider>
      <Toaster richColors />
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
