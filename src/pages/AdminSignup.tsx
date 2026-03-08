import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserPlus, BookOpen } from 'lucide-react';

const AdminSignup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email to confirm your account, then ask an existing admin to grant you the admin role.');
    }
  };

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
            <CardTitle className="text-xl font-semibold">Create Admin Account</CardTitle>
            <CardDescription>
              After signing up, verify your email. An existing admin must grant you access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="rounded-lg"
              />
              <Input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="rounded-lg"
              />
              <Button type="submit" className="w-full gap-2 rounded-lg" disabled={loading}>
                <UserPlus className="h-4 w-4" />
                {loading ? 'Please wait…' : 'Sign Up'}
              </Button>
            </form>
            <div className="mt-4 flex flex-col items-center gap-2 text-sm">
              <Link to="/admin" className="text-primary hover:underline">
                Already have an account? Sign in
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

export default AdminSignup;
