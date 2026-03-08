import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn, BookOpen } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { signIn, resetPassword, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email for a reset link');
      setForgotMode(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-dot-pattern">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-dot-pattern px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground tracking-tight">Knowledge Hub</h1>
            <p className="text-xs text-muted-foreground">Admin Portal</p>
          </div>
        </div>
        <Card className="shadow-lg border-border/60 bg-gradient-to-br from-card to-card/80">
          <CardHeader className="text-center space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">
              {forgotMode ? 'Reset Password' : 'Welcome back'}
            </CardTitle>
            <CardDescription>
              {forgotMode
                ? 'Enter your email to receive a reset link'
                : 'Sign in to manage the Knowledge Hub'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={forgotMode ? handleForgot : handleLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="rounded-lg"
              />
              {!forgotMode && (
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="rounded-lg"
                />
              )}
              <Button type="submit" className="w-full gap-2 rounded-lg" disabled={loading}>
                <LogIn className="h-4 w-4" />
                {loading ? 'Please wait…' : forgotMode ? 'Send Reset Link' : 'Sign In'}
              </Button>
            </form>
            <div className="mt-4 flex flex-col items-center gap-2 text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setForgotMode(!forgotMode)}
              >
                {forgotMode ? 'Back to login' : 'Forgot password?'}
              </button>
              <Link to="/admin/signup" className="text-muted-foreground hover:text-primary transition-colors">
                Create admin account
              </Link>
              <Link to="/" className="text-muted-foreground hover:text-primary text-xs mt-1 transition-colors">
                ← Back to Playbook
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
