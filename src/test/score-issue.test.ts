import { describe, it, expect } from 'vitest';

// Extracted scoreIssue logic for testing
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function scoreIssue(issue: any, query: string): { score: number; maxScore: number } {
  const lower = query.toLowerCase().trim();
  const titleLower = issue.title.toLowerCase();

  if (titleLower === lower || titleLower.includes(lower) || lower.includes(titleLower)) {
    return { score: 99, maxScore: 100 };
  }

  const words = lower.split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return { score: 0, maxScore: 1 };

  const text = `${issue.title} ${issue.description || ''} ${issue.category} ${stripHtml(issue.internal_fix || '')} ${issue.ai_suggested_fix || ''} ${issue.solution_steps || ''}`.toLowerCase();
  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);

  const matchedWords = words.filter(w => text.includes(w)).length;
  const wordMatchRatio = matchedWords / words.length;

  const titleMatchedWords = words.filter(w => titleWords.some((tw: string) => tw.includes(w) || w.includes(tw))).length;
  const titleMatchRatio = titleMatchedWords / words.length;

  const score = (wordMatchRatio * 40) + (titleMatchRatio * 50) + (issue.status === 'Resolved' ? 10 : 0);
  return { score, maxScore: 100 };
}

function getConfidence(issue: any, query: string): number {
  const { score, maxScore } = scoreIssue(issue, query);
  return maxScore > 0 ? Math.min(Math.round((score / maxScore) * 100), 99) : 0;
}

const resolvedIssue = {
  title: 'Dashboard is not loading - Blank screen',
  description: 'Most likely the user role was not set properly.',
  category: 'Bug',
  status: 'Resolved',
  internal_fix: '<p>Check if roles are set properly.</p>',
  ai_suggested_fix: '',
  solution_steps: '',
};

const unresolvedIssue = {
  title: 'GoClass Video Connectivity Issue: Users Cannot See Each Other',
  description: 'Blank video feeds despite being connected.',
  category: 'Bug',
  status: 'Unresolved',
  internal_fix: '',
  ai_suggested_fix: '',
  solution_steps: '',
};

describe('scoreIssue - Confidence Scoring', () => {
  it('gives 99% for exact title match', () => {
    const conf = getConfidence(resolvedIssue, 'Dashboard is not loading - Blank screen');
    expect(conf).toBe(99);
  });

  it('gives 99% for query that contains the full title', () => {
    const conf = getConfidence(resolvedIssue, 'Dashboard is not loading - Blank screen issue');
    expect(conf).toBe(99);
  });

  it('gives 99% when title contains the full query', () => {
    const conf = getConfidence(resolvedIssue, 'Dashboard is not loading');
    expect(conf).toBe(99);
  });

  it('gives high confidence for most title words matching', () => {
    const conf = getConfidence(resolvedIssue, 'dashboard blank screen');
    expect(conf).toBeGreaterThanOrEqual(80);
  });

  it('gives low confidence for unrelated queries', () => {
    const conf = getConfidence(resolvedIssue, 'payment refund billing');
    expect(conf).toBeLessThan(30);
  });

  it('gives 0 for completely unmatched query', () => {
    const conf = getConfidence(resolvedIssue, 'xyz abc qwerty');
    expect(conf).toBe(0);
  });

  it('adds resolved bonus to score', () => {
    const resolvedConf = getConfidence(resolvedIssue, 'blank screen bug');
    const unresolvedConf = getConfidence({ ...resolvedIssue, status: 'Unresolved' }, 'blank screen bug');
    expect(resolvedConf).toBeGreaterThan(unresolvedConf);
  });

  it('handles short queries gracefully', () => {
    const conf = getConfidence(resolvedIssue, 'hi');
    expect(conf).toBe(0); // all words filtered (length <= 2)
  });

  it('handles HTML in internal_fix', () => {
    const issue = { ...resolvedIssue, internal_fix: '<p>Check <strong>roles</strong> in admin</p>' };
    const conf = getConfidence(issue, 'check roles admin');
    expect(conf).toBeGreaterThan(0);
  });
});
