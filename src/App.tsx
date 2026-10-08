import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import AppLayout from '@/components/layout/AppLayout'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute'
import { Toaster } from '@/components/ui/sonner'
import ComingSoon from '@/pages/ComingSoon'
import ForgotPassword from '@/pages/ForgotPassword'
import Login from '@/pages/Login'
import ProjectDetail from '@/pages/ProjectDetail'
import Projects from '@/pages/Projects'
import Profile from '@/pages/Profile'
import Register from '@/pages/Register'
import ResetPassword from '@/pages/ResetPassword'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<ComingSoon title="Dashboard" />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:projectId" element={<ProjectDetail />} />
                <Route path="my-tasks" element={<ComingSoon title="My Tasks" />} />
                <Route path="attendance" element={<ComingSoon title="Attendance" />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <Toaster richColors />
    </QueryClientProvider>
  )
}
