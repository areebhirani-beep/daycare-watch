// The map is a quiet base for our pins, drawn in the app's own paper and ink.
// OpenFreeMap vector tiles (no key), OpenMapTiles schema. No buildings, no POIs, no shields:
// only water, parks, roads by weight, and town names, so the daycares are the only marks that speak.

import type { CircleLayerSpecification, FilterSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';

import type { Colors } from './tokens';

type Base = {
  land: string;
  water: string;
  park: string;
  minor: string;
  major: string;
  casing: string;
  motorway: string;
  label: string;
  halo: string;
};

const LIGHT: Base = {
  land: '#EEECE6',
  water: '#D5DCDD',
  park: '#E3E5DA',
  minor: '#FBFAF7',
  major: '#FFFFFF',
  casing: '#DAD6CC',
  motorway: '#F4F2EC',
  label: '#6E6A61',
  halo: '#EEECE6',
};

const DARK: Base = {
  land: '#161614',
  water: '#1F2628',
  park: '#1A1C17',
  minor: '#23221F',
  major: '#2C2B27',
  casing: '#0F0F0E',
  motorway: '#34322D',
  label: '#969288',
  halo: '#121210',
};

const road = (classes: string[]): FilterSpecification => ['match', ['get', 'class'], classes, true, false];

export function mapStyle(isDark: boolean): StyleSpecification {
  const b = isDark ? DARK : LIGHT;
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': b.land } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': b.park } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': b.water } },
      {
        id: 'waterway',
        type: 'line',
        source: 'omt',
        'source-layer': 'waterway',
        paint: { 'line-color': b.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 2] },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        minzoom: 12,
        filter: road(['minor', 'service']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': b.minor, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.5, 16, 5] },
      },
      {
        id: 'road-major-casing',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        filter: road(['trunk', 'primary', 'secondary', 'tertiary']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': b.casing, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 1, 16, 10] },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        filter: road(['trunk', 'primary', 'secondary', 'tertiary']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': b.major, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.5, 16, 8] },
      },
      {
        id: 'road-motorway',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        filter: road(['motorway']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': b.motorway, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 1, 16, 12] },
      },
      {
        id: 'road-label',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'transportation_name',
        minzoom: 14,
        filter: road(['primary', 'secondary', 'tertiary']),
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: { 'text-color': b.label, 'text-halo-color': b.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'place',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['match', ['get', 'class'], 'city', 14, 'town', 13, 12],
          'text-letter-spacing': 0.04,
          'text-allow-overlap': false,
          // Town names sit above a pin, never under one.
          'text-variable-anchor': ['bottom', 'top'],
          'text-radial-offset': 0.8,
        },
        paint: { 'text-color': b.label, 'text-halo-color': b.halo, 'text-halo-width': 2 },
      },
    ],
  };
}

/**
 * Paint for the daycare pins: ink squares-in-spirit, drawn as small circles with a paper ring.
 * Every daycare gets the same pin. A watched daycare gets the accent and a larger ring.
 * Pins never encode findings, so the map can't be read as a grade.
 */
export function pinPaint(c: Colors): NonNullable<CircleLayerSpecification['paint']> {
  return {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ['case', ['get', 'watched'], 4.5, 3], 14, ['case', ['get', 'watched'], 9, 6.5]],
    'circle-color': ['case', ['get', 'watched'], c.mapPinWatched, c.mapPin],
    'circle-stroke-color': c.bg,
    'circle-stroke-width': ['case', ['get', 'watched'], 2.5, 1.5],
  };
}
