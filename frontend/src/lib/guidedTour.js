/**
 * Guided Tour SDK — ITER154
 * Frontend client for `/api/onboarding/tour`.
 */
import api from './api';

const KEY = 'studio_first_login';

export async function fetchTour(tourKey = KEY) {
  const { data } = await api.get(`/api/onboarding/tour`, { params: { key: tourKey } });
  return data;
}

export async function persistState({ tourKey = KEY, status, currentStep }) {
  const { data } = await api.post(`/api/onboarding/tour/state`, {
    tour_key: tourKey,
    status,
    current_step: currentStep,
  });
  return data;
}

export async function resetTour(tourKey = KEY) {
  const { data } = await api.post(`/api/onboarding/tour/reset`, null, {
    params: { key: tourKey },
  });
  return data;
}
