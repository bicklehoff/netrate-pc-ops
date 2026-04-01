// Google Geocoding — server-side address validation and enrichment
// Uses Google Geocoding API to validate addresses and extract:
// street, city, state, zip, county, lat, lng, formatted address, place_id
//
// Usage:
//   const result = await geocodeAddress({ street: '553 Gallegos Cir', city: 'Erie', state: 'CO' });
//   result = { validated: true, address: { street, city, state, zip, county, formatted, lat, lng, placeId }, raw: {...} }

const API_KEY = process.env.GOOGLE_GEOCODING_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Validate and enrich a property address via Google Geocoding API
 * @param {Object} addr - { street, city, state, zip? }
 * @returns {Object} { validated: boolean, address: { street, city, state, zip, county, formatted, lat, lng, placeId }, raw }
 */
export async function geocodeAddress(addr) {
  if (!API_KEY) {
    console.warn('geocodeAddress: No Google API key configured');
    return { validated: false, error: 'No API key' };
  }

  if (!addr || !addr.street) {
    return { validated: false, error: 'No street address provided' };
  }

  // Build query string from parts
  const parts = [addr.street, addr.city, addr.state, addr.zip || addr.zipCode].filter(Boolean);
  const query = parts.join(', ');

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:US&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { validated: false, error: `Google API error: ${res.status}` };
    }

    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return { validated: false, error: data.status, raw: data };
    }

    const result = data.results[0];
    const components = result.address_components || [];
    const geo = result.geometry?.location || {};

    // Extract address components
    const get = (type, form = 'long_name') => {
      const c = components.find(c => c.types.includes(type));
      return c ? c[form] : null;
    };

    const streetNumber = get('street_number') || '';
    const route = get('route') || '';
    const street = [streetNumber, route].filter(Boolean).join(' ') || addr.street;

    const address = {
      street,
      city: get('locality') || get('sublocality_level_1') || get('neighborhood') || addr.city || '',
      state: get('administrative_area_level_1', 'short_name') || addr.state || '',
      zip: get('postal_code') || addr.zip || addr.zipCode || '',
      county: get('administrative_area_level_2')?.replace(/ County$/i, '') || '',
      formatted: result.formatted_address || '',
      lat: geo.lat || null,
      lng: geo.lng || null,
      placeId: result.place_id || null,
    };

    return {
      validated: true,
      address,
      raw: result,
    };
  } catch (err) {
    console.error('geocodeAddress error:', err);
    return { validated: false, error: err.message };
  }
}

/**
 * Enrich a loan's propertyAddress JSON with geocoded data
 * Returns the merged address object (original + geocoded fields)
 * Does NOT save to DB — caller handles that
 * @param {Object} currentAddr - Current propertyAddress JSON from loan
 * @returns {Object} { enriched: true, address: {...}, googleAddress: {...} } or { enriched: false }
 */
export async function enrichPropertyAddress(currentAddr) {
  if (!currentAddr?.street) return { enriched: false };

  const result = await geocodeAddress(currentAddr);
  if (!result.validated) return { enriched: false, error: result.error };

  // Merge: keep original street if Google's differs significantly (user may have unit/apt)
  const enriched = {
    ...currentAddr,
    // Fill in missing fields from Google
    city: currentAddr.city || result.address.city,
    state: currentAddr.state || result.address.state,
    zip: currentAddr.zip || currentAddr.zipCode || result.address.zip,
    county: result.address.county, // Always take county from Google
    lat: result.address.lat,
    lng: result.address.lng,
    placeId: result.address.placeId,
    formatted: result.address.formatted,
    googleValidated: true,
    validatedAt: new Date().toISOString(),
  };

  return {
    enriched: true,
    address: enriched,
    googleAddress: result.address, // The full Google-suggested address for comparison
  };
}
