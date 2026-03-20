import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AIStatusProvider } from "@/hooks/useAIStatus";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicPlaybook from "./pages/PublicPlaybook";
import AdminLogin from "./pages/AdminLogin";
import AdminSignup from "./pages/AdminSignup";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./components/Dashboard";
import SlackSimulator from "./pages/SlackSimulator";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AIStatusProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<PublicPlaybook />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/signup" element={<AdminSignup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </AIStatusProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
