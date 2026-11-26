const AQI_BANDS = [
  {min: 301, label: 'Hazardous', color: '#df584c'},
  {min: 201, label: 'Very unhealthy', color: '#df584c'},
  {min: 151, label: 'Unhealthy', color: '#d47742'},
  {min: 101, label: 'Unhealthy for sensitive groups', color: '#c39432'},
  {min: 51, label: 'Moderate', color: '#b28b35'},
  {min: 0, label: 'Good', color: '#168b78'},
];

const KG_CO2E_PER_KM = Object.freeze({
  'average gasoline car': 0.249,
  bus: 0.10151,
  metro: 0.02444,
  walking: 0,
  cycling: 0,
  carpool: 0.1245,
});

/** Return a human-readable category and color for US AQI, preserving missing data. */
export function classifyAqi(aqi) {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi) || aqi < 0 || aqi > 500) {
    return {label: 'Data unavailable', color: '#73808c'};
  }
  const band = AQI_BANDS.find(({min}) => aqi >= min);
  return band ? {label: band.label, color: band.color} : {label: 'Data unavailable', color: '#73808c'};
}

/** Estimate round-trip and weekly transport emissions avoided from reference factors. */
export function estimateTransportImpact(distanceKm, vehicle, alternative, workdays = 5) {
  const distance = Number(distanceKm);
  const days = Number(workdays);
  if (!Number.isFinite(distance) || distance < 0 || distance > 500) {
    throw new RangeError('Distance must be between 0 and 500 km.');
  }
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new RangeError('Workdays must be an integer from 1 to 7.');
  }
  const baseline = KG_CO2E_PER_KM[vehicle];
  const alternativeFactor = KG_CO2E_PER_KM[alternative.toLowerCase()];
  if (baseline === undefined || alternativeFactor === undefined || alternative === vehicle) {
    throw new RangeError('Choose a supported alternative mode.');
  }
  const roundTrip = Math.max(0, distance * 2 * (baseline - alternativeFactor));
  return {day: roundTrip, week: roundTrip * days};
}
