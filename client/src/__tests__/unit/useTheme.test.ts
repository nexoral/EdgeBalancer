import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to dark theme when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('does not set data-theme attribute for dark (relies on :root defaults)', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('reads light theme from localStorage on mount', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('sets data-theme="light" on html element when theme is light', () => {
    localStorage.setItem('theme', 'light');
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggleTheme switches from dark to light', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => { result.current.toggleTheme(); });

    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme switches from light to dark', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });

    expect(result.current.theme).toBe('dark');
  });

  it('toggleTheme persists the new value to localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });

    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('toggling to light sets data-theme="light" on html element', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggling back to dark removes data-theme attribute from html element', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('double toggle returns to the original theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => { result.current.toggleTheme(); });
    act(() => { result.current.toggleTheme(); });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('ignores invalid localStorage values and defaults to dark', () => {
    localStorage.setItem('theme', 'invalid-value');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });
});
