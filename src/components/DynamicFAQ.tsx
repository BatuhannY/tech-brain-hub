import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpCircle } from 'lucide-react';

interface FAQEntry {
  question: string;
  answer: string;
}

const DynamicFAQ = ({ issues }: { issues: any[] }) => {
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!issues?.length || loaded) return;
    setLoaded(true);
    setLoading(true);

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
        console.log('FAQ response:', JSON.stringify(response.data));
        if (response.error) { console.error('FAQ invoke error:', response.error); return; }
        const result = response.data;
        if (result?.error) { console.error('FAQ AI error:', result.error); return; }
        if (result?.faqs) setFaqs(result.faqs);
      } catch (err) {
        console.error('FAQ generation failed:', err);
      } finally {
        setLoading(false);
      }
    };

    generateFAQ();
  }, [issues, loaded]);

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
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">Frequently Asked Questions</CardTitle>
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
