/**
 * WISE System - Muntinlupa Reference Data
 * Barangays, streets/zones, and per-barangay color themes.
 */

// Barangays of Muntinlupa City
const BARANGAYS = [
  'Alabang', 'Bayanan', 'Buli', 'Cupang',
  'New Alabang Village', 'Poblacion', 'Putatan', 'Sucat', 'Tunasan'
];

// Barangay streets/zones
const BARANGAY_STREETS = {
  'Alabang': [
    'Alabang Public Market', 'Muntinlupa City Public Market', 'Filinvest Covered Court',
    'Festival Mall', 'Asian Hospital and Medical Center', 'Alabang Town Center',
    'Filinvest City Central Park', 'Northgate Cyberzone', 'South Station',
    'St. Jerome Emiliani and Sta. Susana Parish'
  ],
  'New Alabang Village': [
    'New Alabang Village (Ayala Alabang)', 'Ayala Alabang Barangay Hall',
    'Alabang Country Club', 'The Palms Country Club', 'San James the Great Parish',
    'Molito Lifestyle Center', 'Madrigal Avenue', 'Acacia Avenue',
    'Molave Street', 'Narra Street', 'Yakal Street'
  ],
  'Bayanan': [
    'Bayanan Barangay Hall', 'Bayanan Public Market', 'Bayanan Covered Court',
    'Bayanan Health Center', 'Bayanan Elementary School', 'Bayanan National High School',
    'National Road', 'Bayanan Road', 'San Guillermo Chapel', 'Bayanan Multi-Purpose Hall'
  ],
  'Buli': [
    'Buli Barangay Hall', 'Buli Covered Court', 'Buli Health Center',
    'Buli Elementary School', 'Marina Road', 'Buli Road', 'East Service Road',
    'Lakefront Area', 'Buli Multi-Purpose Hall', 'Buli Concepcion Road'
  ],
  'Cupang': [
    'Barangay Cupang Hall (NEW)', 'Old Barangay Cupang Hall',
    'Barangay Cupang Multi-Purpose Hall', 'Cupang Covered Court',
    'Cupang Elementary School', 'Cupang Health Center', 'Soldiers Hills Road',
    'Daang Hari Road', 'East Service Road', 'Posadas Open Area'
  ],
  'Poblacion': [
    'Barangay Poblacion Hall', 'Muntinlupa Central Market',
    'Southville 3 Covered Court', 'KVHAI Covered Court', 'Covered Court',
    'Muntinlupa City Hall', 'Medical Center Muntinlupa', 'National Road',
    'Rizal Street', 'Katarungan Road'
  ],
  'Putatan': [
    'Barangay Putatan Barangay Hall', 'Mutual Homes 1&2 Covered Court',
    'SMB Hills Covered Court', 'Puregold Putatan', 'Savemore Putatan',
    'Pedro Diaz Street', 'Country Homes Avenue', 'Putatan Health Center',
    'Putatan Elementary School', 'National Road'
  ],
  'Sucat': [
    'Sucat Barangay Hall', 'Sucat Multi-Purpose Covered Court',
    'Bagong Silang Plaza Covered Court', 'Sitio Pagkakaisa Covered Court',
    'Lakefront Open Area', 'Dr. A. Santos Avenue', 'East Service Road',
    'West Service Road', 'Sucat Health Center', 'Sucat Elementary School'
  ],
  'Tunasan': [
    'Tunasan Barangay Hall', 'Tunasan Covered Court', 'Covered Court',
    "Tunasan People's Market", 'Tunasan Health Center', 'Tunasan Elementary School',
    'National Road', 'Rodriguez Street', 'Buendia Street', 'Golden Gate Park Homes'
  ]
};

// Colors per barangay
const BARANGAY_COLORS = {
  'Alabang':              { bg: '#16A34A', gradient: 'linear-gradient(135deg, #16A34A, #15803D)' },
  'Bayanan':              { bg: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  'Buli':                 { bg: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
  'Cupang':               { bg: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899, #DB2777)' },
  'New Alabang Village':  { bg: '#0EA5E9', gradient: 'linear-gradient(135deg, #0EA5E9, #0284C7)' },
  'Poblacion':            { bg: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  'Putatan':              { bg: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
  'Sucat':                { bg: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  'Tunasan':              { bg: '#14B8A6', gradient: 'linear-gradient(135deg, #14B8A6, #0D9488)' },
  default:                { bg: '#6B7280', gradient: 'linear-gradient(135deg, #6B7280, #4B5563)' }
};
