import { useState } from 'react';
import PlaybookView from '@/components/PlaybookView';
import TrendingIssues from '@/components/TrendingIssues';
import AIChat from '@/components/AIChat';
import ThemeToggle from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PublicPlaybook = () => {
  const [activeTab, setActiveTab] = useState('playbook');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Knowledge Hub</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="w-full">
            <TabsTrigger value="playbook" className="flex-1 text-xs">Playbook</TabsTrigger>
            <TabsTrigger value="trending" className="flex-1 text-xs">Trending</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 text-xs">AI Agent</TabsTrigger>
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
