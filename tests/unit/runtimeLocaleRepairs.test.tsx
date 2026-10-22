import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { PreferenceControls } from '@/components/ui/PreferenceControls';
import { OnboardingTour } from '@/components/features/Onboarding/OnboardingTour';
import DependencyMapD3 from '@/components/charts/DependencyMapD3';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { BetaSandboxView } from '@/components/views/BetaSandboxView';
import { QuickEditOverlay } from '@/components/features/DataGrid/QuickEditOverlay';

const switchLanguage = (language: 'zh' | 'en') => act(() => { window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: language })); });
beforeEach(() => { localStorage.clear(); localStorage.setItem('resindb-language', 'en'); });
afterEach(cleanup);

describe('runtime language and mathematical labels', () => {
  it('shares preference state with changes made through other app controls', () => {
    const OtherControls = () => {
      const { setLanguage } = useLanguage();
      const { toggleTheme, setColorTheme } = useTheme();
      return <button onClick={() => { setLanguage('zh'); toggleTheme(); setColorTheme('rose'); }}>External settings</button>;
    };
    localStorage.setItem('resindb-theme', 'light');
    render(<LanguageProvider><ThemeProvider><PreferenceControls /><OtherControls /></ThemeProvider></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'External settings' }));
    expect(screen.getByTestId('language-control').textContent).toContain('中/EN');
    expect(screen.getByTestId('theme-control').title).toBe('切换至浅色模式');
    fireEvent.click(screen.getByTestId('palette-control'));
    expect(screen.getByRole('button', { name: '玫红' }).className).toContain('font-semibold');
    fireEvent.click(screen.getByTestId('language-control'));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('theme-control').title).toBe('Switch to Light Mode');
    expect(screen.getByRole('button', { name: 'Rose' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('theme-control'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Emerald Bio' }));
    expect(localStorage.getItem('resindb-color-theme')).toBe('emerald');
  });
  it('changes first-login tour controls with the selected language', () => {
    const complete = vi.fn();
    render(<LanguageProvider><OnboardingTour onComplete={complete} /></LanguageProvider>);
    expect(screen.getByText('Welcome to ResinDB Pro')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    switchLanguage('zh');
    expect(screen.getByText('欢迎来到 ResinDB Pro')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '跳过介绍' }));
    expect(complete).toHaveBeenCalledOnce();
  });
  it('localizes dependency-map controls without renaming source nodes', () => {
    render(<LanguageProvider><DependencyMapD3 /></LanguageProvider>);
    expect(screen.getByRole('img', { name: 'Resin feedstock and polymer relationships' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeTruthy();
    const sourceTitles = [...document.querySelectorAll('svg title')].map(element => element.textContent);
    switchLanguage('zh');
    expect(screen.getByRole('img', { name: '树脂原料与聚合物关系图' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '导出 JSON' })).toBeTruthy();
    expect([...document.querySelectorAll('svg title')].map(element => element.textContent)).toEqual(sourceTitles);
  });
  it('translates feedback status reactively while retaining the local record', () => {
    render(<LanguageProvider><FeedbackModal isOpen onClose={vi.fn()} /></LanguageProvider>);
    fireEvent.change(screen.getByTestId('feedback-title'), { target: { value: 'Chart feedback' } });
    fireEvent.change(screen.getByTestId('feedback-description'), { target: { value: 'The selected dataset needs another chart.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save locally' }));
    expect(screen.getByText('Feedback saved to the local queue.')).toBeTruthy();
    const record = localStorage.getItem('resindb-feedback-queue');
    switchLanguage('zh');
    expect(screen.getByText('反馈已保存到本地待处理队列。')).toBeTruthy();
    expect(localStorage.getItem('resindb-feedback-queue')).toBe(record);
  });
  it('keeps Greek symbols case-sensitive and rejects an emptied model parameter', () => {
    render(<LanguageProvider><BetaSandboxView /></LanguageProvider>);
    expect(screen.getByText('η₀').className).toContain('normal-case');
    expect(screen.getByText('λ').className).not.toContain('uppercase');
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '' } });
    expect(screen.getByText('Invalid input or calculation')).toBeTruthy();
  });
  it('keeps scientific units unchanged and never slides a malformed value as zero', () => {
    render(<LanguageProvider><QuickEditOverlay colKey="density" colLabel="Density" initialValue={0.9} unit="g/cm³" onSave={vi.fn()} onClose={vi.fn()} /></LanguageProvider>);
    expect(screen.getByText('g/cm³').className).toContain('normal-case');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12oops' } });
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
