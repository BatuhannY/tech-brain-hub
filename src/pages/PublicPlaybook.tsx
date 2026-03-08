import { useState } from 'react';
import PlaybookView from '@/components/PlaybookView';
import TrendingIssues from '@/components/TrendingIssues';
import AIChat from '@/components/AIChat';
import ThemeToggle from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { Lock, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PublicPlaybook = () => {
  const [activeTab, setActiveTab] = useState('playbook');

  return (
    <div className="min-h-screen bg-background bg-dot-pattern">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Knowledge Hub</h1>
              <p className="text-xs text-muted-foreground">Your team's resolution playbook</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <Lock className="h-3.5 w-3.5" />
                Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full bg-secondary/60 p-1 rounded-xl h-auto">
            <TabsTrigger value="playbook" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Playbook</TabsTrigger>
            <TabsTrigger value="trending" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Trending</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">AI Agent</TabsTrigger>
          </TabsList>
          <div className={activeTab === 'playbook' ? '' : 'hidden'}>
            <PlaybookView />
          </div>
          <div className={activeTab === 'trending' ? '' : 'hidden'}>
            <TrendingIssues />
          </div>
          <div className={activeTab === 'ai' ? '' : 'hidden'}>
            <AIChat />
          </div>
        </Tabs>
      </main>
    </div>
  );
};

export default PublicPlaybook;
