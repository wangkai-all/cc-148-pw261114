import App, { type AppState } from '../App';
import { sampleDataset } from '../data/sample';
import { DEFAULT_PRIORITY } from '../lib/types';

export function createMockAppState(): AppState {
  return {
    dataset: JSON.parse(JSON.stringify(sampleDataset)),
    config: {
      priority: DEFAULT_PRIORITY,
      maxUpgradeCostPerNight: null,
      simulation: { cancelRate: 0.15, seed: 42, trials: 60 },
    },
    asOf: '2026-11-14T08:00',
    mode: 'demand',
  };
}

void App;
