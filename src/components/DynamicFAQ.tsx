import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpCircle, Database } from 'lucide-react';
import { useAIStatus } from '@/hooks/useAIStatus';

interface FAQEntry {
  question: string;
  answer: string;
}

function generateLocalFAQs(issues: any[]): FAQEntry[] {
  // Group resolved issues by category and pick the most reported ones
  const resolved = issues.filter(i => i.status === 'Resolved' && (i.internal_fix || i.solution_steps || i.ai_suggested_fix));
  if (!resolved.length) return [];

  const sorted = [...resolved].sort((a, b) => (b.report_count || 1) - (a.report_count || 1));
  return sorted.slice(0, 5).map(issue => {
    const fix = issue.internal_fix || issue.solution_steps || issue.ai_suggested_fix || issue.web_fix || '';
    // Strip HTML tags for plain text display
    const cleanFix = fix.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').trim();
    return {
      question: `How do I fix: ${issue.title}?`,
      answer: cleanFix || 'See the issue details for resolution steps.',
    };
  });
}

const DynamicFAQ = ({ issues }: { issues: any[] }) => {
  const { isAIOffline, checkAIError } = useAIStatus();
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [usingDB, setUsingDB] = useState(false);

  useEffect(() => {
    if (!issues?.length || loaded) return;
    setLoaded(true);
    setLoading(true);

    if (isAIOffline) {
      // Use local DB-based FAQ generation
      const localFaqs = generateLocalFAQs(issues);
      setFaqs(localFaqs);
      setUsingDB(true);
      setLoading(false);
      return;
    }

    const generateFAQ = async () => {
      try {
        const response = await supabase.functions.invoke('ai-analytics', {
          body: {
            mode: 'generate-faq',
            issues: issues.slice(0, 50).map(i => ({
              id: i.id, title: i.title, category: i.category,
              description: i.description, internal_fix: i.internal_fix,
              report_count: i.report_count, status: i.status,
            })),
          },
        });
        if (response.error) { console.error('FAQ invoke error:', response.error); }
        const result = response.data;
        if (result?.error) {
          if (checkAIError(result.error)) {
            // Fallback to local
            const localFaqs = generateLocalFAQs(issues);
            setFaqs(localFaqs);
            setUsingDB(true);
            return;
          }
          console.error('FAQ AI error:', result.error);
          return;
        }
        if (result?.faqs) setFaqs(result.faqs);
      } catch (err) {
        console.error('FAQ generation failed:', err);
        // Fallback to local
        const localFaqs = generateLocalFAQs(issues);
        setFaqs(localFaqs);
        setUsingDB(true);
      } finally {
        setLoading(false);
      }
    };

    generateFAQ();
  }, [issues, loaded, isAIOffline]);

  if (loading) {
    return (
      <Card className="shadow-none border-primary/15 bg-gradient-to-br from-primary/5 to-transparent rounded-xl mb-5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">Frequently Asked Questions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!faqs.length) return null;

  return (
    <Card className="shadow-none border-primary/15 bg-gradient-to-br from-primary/5 to-transparent rounded-xl mb-5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
            {usingDB ? <Database className="h-3.5 w-3.5 text-primary" /> : <HelpCircle className="h-3.5 w-3.5 text-primary" />}
          </div>
          <CardTitle className="text-sm font-semibold">
            Frequently Asked Questions
            {usingDB && <span className="text-xs font-normal text-muted-foreground ml-2">(from database)</span>}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border/40">
              <AccordionTrigger className="text-sm text-left hover:no-underline py-3 gap-2">
                <span className="text-foreground font-medium">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-3">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default DynamicFAQ;
