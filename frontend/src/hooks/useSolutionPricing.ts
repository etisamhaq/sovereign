import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface SolutionPrices {
  automation: { starter: number; growth: number; pro: number };
  agents: { starter: number; growth: number; pro: number };
  optimization: { starter: number; growth: number; pro: number };
}

const FALLBACK_PRICES: SolutionPrices = {
  automation: { starter: 299, growth: 799, pro: 1999 },
  agents: { starter: 499, growth: 1299, pro: 2999 },
  optimization: { starter: 199, growth: 599, pro: 1499 },
};

export function useSolutionPricing(serviceType: keyof SolutionPrices) {
  const { data } = useQuery<SolutionPrices>({
    queryKey: ['solution-pricing'],
    queryFn: () => apiClient.get('/solutions/pricing/'),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const prices = data?.[serviceType] ?? FALLBACK_PRICES[serviceType];
  return prices;
}
