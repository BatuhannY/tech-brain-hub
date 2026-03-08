import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, HelpCircle } from 'lucide-react';

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

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-analytics', {
          body: {
            mode: 'generate-faq',
            issues: issues.slice(0, 50).map(i => ({
              id: i.id, title: i.title, category: i.category,
              description: i.description, internal_fix: i.internal_fix,
              report_count: i.report_count, status: i.status,
            })),
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setFaqs(data.faqs || []);
      } catch (err) {
        console.error('FAQ generation failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [issues]);

  if (loading) {
    return (
      <Card className="shadow-none border-primary/15 bg-gradient-to-br from-primary/5 to-transparent mb-5">
        <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Generating FAQs…
        </CardContent>
      </Card>
    );
  }

  if (!faqs.length) return null;

  return (
    <Card className="shadow-none border-primary/15 bg-gradient-to-br from-primary/5 to-transparent mb-5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Frequently Asked Questions</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
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
