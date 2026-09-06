/**
 * WISE System - Weather Service
 * Handles weather data fetching and processing for the dashboard.
 */

const WeatherService = {
  /**
   * Fetch current weather data for Muntinlupa City
   * @returns {Promise<object|null>} Weather data or null on error
   */
  async fetchWeather() {
    try {
      // Using Open-Meteo API (free, no API key required)
      // Muntinlupa coordinates: 14.4°N, 121.0°E
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=14.4&longitude=121.0&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila';
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data = await response.json();
      return this._parseWeatherData(data);
      
    } catch (error) {
      console.error('Weather service error:', error);
      return null;
    }
  },

  /**
   * Parse weather API response into consistent format
   * @param {object} apiData - Raw API response data
   * @returns {object} Parsed weather data
   */
  _parseWeatherData(apiData) {
    const current = apiData.current || {};
    const daily = apiData.daily || {};

    return {
      temperature: Math.round(current.temperature_2m || 0),
      humidity: current.relative_humidity_2m || 0,
      windSpeed: Math.round(current.wind_speed_10m || 0),
      weatherCode: current.weather_code || 0,
      maxTemp: Math.round(daily.temperature_2m_max?.[0] || 0),
      condition: this._getWeatherCondition(current.weather_code || 0),
      icon: this._getWeatherIcon(current.weather_code || 0),
      lastUpdated: new Date().toISOString()
    };
  },

  /**
   * Get weather condition description from WMO code
   * @param {number} code - WMO weather code
   * @returns {string} Weather condition description
   */
  _getWeatherCondition(code) {
    const conditions = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Thunderstorm with heavy hail'
    };
    return conditions[code] || 'Unknown';
  },

  /**
   * Get weather emoji icon from WMO code
   * @param {number} code - WMO weather code
   * @returns {string} Weather emoji
   */
  _getWeatherIcon(code) {
    const icons = {
      0: '☀️',
      1: '🌤️',
      2: '⛅',
      3: '☁️',
      45: '🌫️',
      48: '🌫️',
      51: '🌦️',
      53: '🌦️',
      55: '🌧️',
      61: '🌧️',
      63: '🌧️',
      65: '🌧️',
      71: '🌨️',
      73: '🌨️',
      75: '🌨️',
      77: '🌨️',
      80: '🌦️',
      81: '🌦️',
      82: '⛈️',
      85: '🌨️',
      86: '🌨️',
      95: '⛈️',
      96: '⛈️',
      99: '⛈️'
    };
    return icons[code] || '🌡️';
  },

  /**
   * Format weather data for display
   * @param {object} weatherData - Parsed weather data
   * @returns {object} Formatted weather data
   */
  formatForDisplay(weatherData) {
    if (!weatherData) return null;

    return {
      temp: `${weatherData.temperature}°C`,
      humidity: `${weatherData.humidity}%`,
      wind: `${weatherData.windSpeed} km/h`,
      maxTemp: `${weatherData.maxTemp}°C`,
      condition: weatherData.condition,
      icon: weatherData.icon,
      updated: this._formatUpdateTime(weatherData.lastUpdated)
    };
  },

  /**
   * Format update time for display
   * @param {string} isoString - ISO timestamp
   * @returns {string} Formatted time
   */
  _formatUpdateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
};
