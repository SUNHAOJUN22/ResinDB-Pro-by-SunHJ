import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScientificMath } from '@/components/ui/ScientificMath';
afterEach(cleanup);
describe('local scientific math rendering', () => {
  it('renders accessible MathML and local KaTeX layout', () => {
    const { container } = render(<ScientificMath tex={String.raw`E_s=\frac{E}{\rho}`} />);
    expect(container.querySelector('math')).not.toBeNull();
    expect(container.querySelector('[data-math-status="ready"]')).not.toBeNull();
  });
  it('keeps invalid commands visible as safe text', () => {
    const { container } = render(<ScientificMath tex={String.raw`\unknown{x}`} />);
    expect(container.textContent).toBe(String.raw`\unknown{x}`);
    expect(container.querySelector('[data-math-status="unavailable"]')).not.toBeNull();
  });
  it('does not trust executable links', () => {
    const { container } = render(<ScientificMath tex={String.raw`\href{javascript:alert(1)}{click}`} />);
    expect(container.querySelector('[href^="javascript:"]')).toBeNull();
  });
});
