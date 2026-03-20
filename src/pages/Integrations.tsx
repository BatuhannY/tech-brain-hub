import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Slack, Globe, Webhook, CheckCircle2, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const Integrations = () => {
  const navigate = useNavigate();
  const [botToken, setBotToken] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const [secretSaved, setSecretSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-webhook`;

  const handleSaveToken = () => {
    if (!botToken.startsWith('xoxb-')) {
      toast.error('Bot token should start with xoxb-');
      return;
    }
    setTokenSaved(true);
    toast.success('Bot token saved locally. To deploy, add it as a secret in your backend.');
  };

  const handleSaveSecret = () => {
    if (signingSecret.length < 10) {
      toast.error('Signing secret seems too short');
      return;
    }
    setSecretSaved(true);
    toast.success('Signing secret saved locally. To deploy, add it as a secret in your backend.');
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <div className="w-px h-5 bg-border" />
          <h1 className="text-lg font-bold text-foreground">Integrations</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Slack Integration Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#4a154b] flex items-center justify-center">
                  <Slack className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Slack Integration</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Connect your Knowledge Hub to Slack for instant support responses
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">Setup Required</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Webhook className="h-3.5 w-3.5" />
                Webhook URL
              </Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs bg-muted" />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl} className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this URL in your Slack App's slash command or event subscription settings.
              </p>
            </div>

            {/* Bot Token */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bot User OAuth Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={botToken}
                    onChange={e => { setBotToken(e.target.value); setTokenSaved(false); }}
                    placeholder="xoxb-..."
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleSaveToken}
                  disabled={!botToken || tokenSaved}
                  size="sm"
                  className="shrink-0 gap-1.5"
                >
                  {tokenSaved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : 'Save'}
                </Button>
              </div>
            </div>

            {/* Signing Secret */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Signing Secret</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={signingSecret}
                    onChange={e => { setSigningSecret(e.target.value); setSecretSaved(false); }}
                    placeholder="Your Slack signing secret..."
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleSaveSecret}
                  disabled={!signingSecret || secretSaved}
                  size="sm"
                  className="shrink-0 gap-1.5"
                >
                  {secretSaved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : 'Save'}
                </Button>
              </div>
            </div>

            {/* Setup guide link */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h4 className="text-sm font-medium mb-2">Quick Setup Guide</h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Create a Slack App at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">api.slack.com <ExternalLink className="h-3 w-3" /></a></li>
                <li>Add a Slash Command (e.g., <code className="bg-secondary px-1 rounded text-foreground">/helpdesk</code>) pointing to the webhook URL above</li>
                <li>Install the app to your workspace and copy the Bot Token + Signing Secret</li>
                <li>Paste both credentials above and add them as backend secrets</li>
              </ol>
            </div>

            {/* Preview simulator link */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <p className="text-sm font-medium">Slack Preview Simulator</p>
                <p className="text-xs text-muted-foreground">See how the bot looks inside Slack</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/slack-preview')}>
                <Globe className="h-4 w-4" />
                Open Simulator
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Integrations;
