export type AirQualityStatus = {label: string; color: string};
export type TransportImpact = {day: number; week: number};
export function classifyAqi(aqi: number | null): AirQualityStatus;
export function estimateTransportImpact(distanceKm: number, vehicle: string, alternative: string, workdays?: number): TransportImpact;
