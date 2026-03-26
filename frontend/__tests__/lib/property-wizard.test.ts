import { describe, expect, it } from 'vitest';
import {
  defaultPropertyData,
  getCompletenessScore,
  getPricingSuggestion,
  validateStep,
} from '@/lib/property-wizard';

describe('property wizard', () => {
  it('fails validation for incomplete basic info', () => {
    const errors = validateStep(0, defaultPropertyData);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toContain('Address');
  });

  it('calculates completeness score with complete data', () => {
    const data = {
      ...defaultPropertyData,
      basicInfo: {
        ...defaultPropertyData.basicInfo,
        title: 'Executive Apartment',
        address: '12 Admiralty Way, Lekki, Lagos',
        bedrooms: 2,
        bathrooms: 2,
        squareFootage: 1100,
      },
      pricing: {
        ...defaultPropertyData.pricing,
        monthlyRent: 2500,
        securityDeposit: 1500,
        leaseTermMonths: 12,
        moveInDate: '2026-05-01',
      },
      photos: [
        {
          id: '1',
          name: 'a.jpg',
          url: 'https://example.com/a.jpg',
          caption: '',
          order: 0,
          size: 100,
          width: 1400,
          height: 1000,
          qualityIssues: [],
        },
        {
          id: '2',
          name: 'b.jpg',
          url: 'https://example.com/b.jpg',
          caption: '',
          order: 1,
          size: 100,
          width: 1400,
          height: 1000,
          qualityIssues: [],
        },
        {
          id: '3',
          name: 'c.jpg',
          url: 'https://example.com/c.jpg',
          caption: '',
          order: 2,
          size: 100,
          width: 1400,
          height: 1000,
          qualityIssues: [],
        },
      ],
      description: {
        ...defaultPropertyData.description,
        propertyDescription:
          'This is a high-quality listing description that exceeds one hundred and twenty characters to satisfy quality and publication requirements.',
      },
      availability: {
        ...defaultPropertyData.availability,
        availableFrom: '2026-04-01',
      },
    };

    expect(getCompletenessScore(data)).toBe(100);
  });

  it('returns a sensible pricing suggestion range', () => {
    const data = {
      ...defaultPropertyData,
      basicInfo: {
        ...defaultPropertyData.basicInfo,
        propertyType: 'apartment' as const,
        bedrooms: 2,
        squareFootage: 1000,
      },
    };

    const suggestion = getPricingSuggestion(data);
    expect(suggestion.min).toBeLessThan(suggestion.max);
    expect(suggestion.median).toBeGreaterThan(0);
  });
});
