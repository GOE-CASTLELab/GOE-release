// GOE Platform — © 2022–2026 Leah M Wilson
// Per-card hook: Astrology Intelligence data — self-contained
// Interface unchanged — swap internals without touching card code.

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  Chiron: '⚷', 'North Node': '☊', 'South Node': '☋', Rising: 'AC', Midheaven: 'MC',
};

export function useAstrologyData() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [astrologyData, setAstrologyData] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Load birth chart on mount
    apiRequest('GET', '/api/birth-chart').then(async (res) => {
      if (!res.ok && res.status !== 304) return;
      if (res.status === 304) return;
      const data = await res.json();
      if (data.success) {
        setAstrologyData((prev: any) => ({
          ...prev,
          currentChartData: data.birthChart,
          interpretations: data.interpretations,
          fromCache: data.fromCache,
        }));
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  const updateAstrologyData = (data: any) => {
    setAstrologyData((prev: any) => ({ ...prev, ...data }));
  };

  const refreshSkyData = async (retryCount = 0) => {
    if (!isAuthenticated) return;
    const maxRetries = 3;
    try {
      const res = await apiRequest('GET', '/api/current-sky');
      if (res.ok || res.status === 304) {
        const skyData = await res.json();
        const withSymbols = (skyData.currentSky || skyData).map((p: any) => ({
          ...p,
          symbol: PLANET_SYMBOLS[p.planet] || p.symbol || '⭐',
        }));
        setAstrologyData((prev: any) => ({
          ...prev,
          currentSkyData: withSymbols,
          currentSkyInterpretations: skyData.skyInsights || prev?.currentSkyInterpretations,
        }));
        return;
      }
      if (res.status === 502 && retryCount < maxRetries) {
        setTimeout(() => refreshSkyData(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      if (retryCount < maxRetries && (err.message?.includes('502') || err.message?.includes('authentication'))) {
        setTimeout(() => refreshSkyData(retryCount + 1), 1000 * (retryCount + 1));
      }
    }
  };

  const refreshCurrentTransits = async (retryCount = 0) => {
    if (!isAuthenticated) return;
    const maxRetries = 3;
    try {
      const res = await apiRequest('GET', '/api/current-transits');
      if (res.ok || res.status === 304) {
        const data = await res.json();
        setAstrologyData((prev: any) => ({
          ...prev,
          currentTransits: data.currentTransits || data,
          currentTransitsInterpretations: data.claudeInterpretations || prev?.currentTransitsInterpretations,
        }));
        return;
      }
      if (res.status === 502 && retryCount < maxRetries) {
        setTimeout(() => refreshCurrentTransits(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      if (retryCount < maxRetries && (err.message?.includes('502') || err.message?.includes('authentication'))) {
        setTimeout(() => refreshCurrentTransits(retryCount + 1), 1000 * (retryCount + 1));
      }
    }
  };

  const processChartUpload = async (file: File) => {
    if (!isAuthenticated) return;
    try {
      const formData = new FormData();
      formData.append('chart', file);
      const res = await fetch('/api/charts/upload', { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      toast({ title: 'Chart processed', description: 'Your chart has been analyzed and processed.' });
      return result;
    } catch {
      toast({ title: 'Upload failed', description: 'Failed to process chart. Please try again.', variant: 'destructive' });
    }
  };

  return {
    astrologyData,
    updateAstrologyData,
    refreshSkyData,
    refreshCurrentTransits,
    processChartUpload,
  };
}
