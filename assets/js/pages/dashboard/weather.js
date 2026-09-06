/**
 * WISE System - Dashboard Weather Component
 * Weather widget for Muntinlupa City.
 */

const DashboardWeather = {
  /**
   * Load and display weather data
   */
  async loadWeather() {
    try {
      const weatherData = await WeatherService.fetchWeather();
      if (weatherData) {
        this.renderWeather(weatherData);
      } else {
        this.renderError();
      }
    } catch (error) {
      console.error('Weather load error:', error);
      this.renderError();
    }
  },

  /**
   * Render weather data to DOM
   * @param {object} weatherData - Weather data from service
   */
  renderWeather: function(weatherData) {
    const formatted = WeatherService.formatForDisplay(weatherData);
    
    const iconEl = $id('db-weather-icon');
    if (iconEl) iconEl.textContent = formatted.icon;
    
    const conditionEl = $id('db-weather-condition');
    if (conditionEl) conditionEl.textContent = formatted.condition;
    
    const tempEl = $id('db-weather-temp');
    if (tempEl) tempEl.textContent = formatted.temp;
    
    const humidityEl = $id('db-weather-humidity');
    if (humidityEl) humidityEl.textContent = formatted.humidity;
    
    const windEl = $id('db-weather-wind');
    if (windEl) windEl.textContent = formatted.wind;
    
    const maxEl = $id('db-weather-max');
    if (maxEl) maxEl.textContent = formatted.maxTemp;
    
    const updatedEl = $id('db-weather-updated');
    if (updatedEl) updatedEl.textContent = 'Updated ' + formatted.updated;
  },

  /**
   * Render error state for weather widget
   */
  renderError: function() {
    const iconEl = $id('db-weather-icon');
    if (iconEl) iconEl.textContent = '🌡️';
    
    const conditionEl = $id('db-weather-condition');
    if (conditionEl) conditionEl.textContent = 'Unavailable';
    
    const tempEl = $id('db-weather-temp');
    if (tempEl) tempEl.textContent = '--°';
    
    const humidityEl = $id('db-weather-humidity');
    if (humidityEl) humidityEl.textContent = '--';
    
    const windEl = $id('db-weather-wind');
    if (windEl) windEl.textContent = '--';
    
    const maxEl = $id('db-weather-max');
    if (maxEl) maxEl.textContent = '--';
    
    const updatedEl = $id('db-weather-updated');
    if (updatedEl) updatedEl.textContent = 'Weather unavailable';
  }
};
