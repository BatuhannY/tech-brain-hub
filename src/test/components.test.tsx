import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '@/components/StatusBadge';
import CategoryBadge from '@/components/CategoryBadge';

describe('StatusBadge', () => {
  it('renders Resolved status', () => {
    render(<StatusBadge status="Resolved" />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders Unresolved status', () => {
    render(<StatusBadge status="Unresolved" />);
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
  });
});

describe('CategoryBadge', () => {
  it('renders category text', () => {
    render(<CategoryBadge category="Bug" />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('renders custom category', () => {
    render(<CategoryBadge category="Network" />);
    expect(screen.getByText('Network')).toBeInTheDocument();
  });
});
