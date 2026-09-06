/**
 * WISE System - User Service
 * Handles user management operations including CRUD operations and validation.
 */

const UserService = {
  /**
   * Fetch users with pagination and filtering
   * @param {object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.page_size - Page size
   * @param {string} params.search - Search query
   * @param {string} params.role - Filter by role
   * @returns {Promise<object|null>} Paginated users or null on error
   */
  async fetchUsers(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        page_size: params.page_size || 10
      });

      if (params.search) queryParams.set('search', params.search);
      if (params.role) queryParams.set('role', params.role);

      const res = await apiRequest('/api/users/?' + queryParams.toString());
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Users fetch error:', error);
      return null;
    }
  },

  /**
   * Create a new user
   * @param {object} userData - User data
   * @param {string} userData.fullname - Full name
   * @param {string} userData.email - Email address
   * @param {string} userData.phone - Phone number (optional)
   * @param {string} userData.role - User role (admin/citizen)
   * @param {string} userData.password - Password
   * @returns {Promise<object|null>} Created user or null on error
   */
  async createUser(userData) {
    try {
      const res = await apiRequest('/api/users/', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      if (!res || !res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to create user');
      }

      return await res.json();
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },

  /**
   * Update an existing user
   * @param {number} userId - User ID
   * @param {object} userData - Updated user data
   * @returns {Promise<object|null>} Updated user or null on error
   */
  async updateUser(userId, userData) {
    try {
      const res = await apiRequest(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });

      if (!res || !res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to update user');
      }

      return await res.json();
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  },

  /**
   * Delete a user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser(userId) {
    try {
      const res = await apiRequest(`/api/users/${userId}`, {
        method: 'DELETE'
      });

      if (!res || !res.ok) {
        throw new Error('Failed to delete user');
      }

      return true;
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  },

  /**
   * Validate user data
   * @param {object} userData - User data to validate
   * @param {boolean} isEdit - Whether this is an edit operation
   * @returns {object} Validation result
   */
  validateUserData(userData, isEdit = false) {
    const errors = {};

    // Full name validation
    if (!userData.fullname || !userData.fullname.trim()) {
      errors.fullname = 'Full name is required';
    } else if (userData.fullname.length < 2) {
      errors.fullname = 'Full name must be at least 2 characters';
    } else if (userData.fullname.length > 100) {
      errors.fullname = 'Full name must not exceed 100 characters';
    }

    // Email validation
    if (!userData.email || !userData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!Validator.email(userData.email)) {
      errors.email = 'Invalid email format';
    } else if (userData.email.length > 255) {
      errors.email = 'Email must not exceed 255 characters';
    }

    // Phone validation (optional)
    if (userData.phone && userData.phone.trim()) {
      if (!Validator.phone(userData.phone)) {
        errors.phone = 'Invalid phone number format';
      }
    }

    // Role validation
    if (!userData.role) {
      errors.role = 'Role is required';
    } else if (!['admin', 'citizen'].includes(userData.role)) {
      errors.role = 'Invalid role';
    }

    // Password validation (only for new users)
    if (!isEdit) {
      if (!userData.password) {
        errors.password = 'Password is required';
      } else if (userData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Format user data for display
   * @param {object} user - Raw user data
   * @returns {object} Formatted user data
   */
  formatUserForDisplay(user) {
    if (!user) return null;

    return {
      id: user.id,
      fullname: user.fullname || 'Unknown',
      email: user.email || '',
      phone: user.phone || '—',
      role: user.role || 'citizen',
      isActive: user.is_active !== false,
      initials: getInitials(user.fullname),
      roleClass: getRoleClass(user.role),
      createdAt: formatDisplayDate(user.created_at),
      profileImage: user.profile_image || null
    };
  },

  /**
   * Format users list for table display
   * @param {Array} users - Array of user objects
   * @returns {Array} Formatted user objects
   */
  formatUsersList(users) {
    if (!Array.isArray(users)) return [];
    return users.map(user => this.formatUserForDisplay(user));
  },

  /**
   * Calculate user statistics
   * @param {Array} users - Array of user objects
   * @returns {object} User statistics
   */
  calculateStats(users) {
    if (!Array.isArray(users)) {
      return {
        total: 0,
        admins: 0,
        citizens: 0,
        active: 0,
        inactive: 0
      };
    }

    return {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      citizens: users.filter(u => u.role === 'citizen').length,
      active: users.filter(u => u.is_active !== false).length,
      inactive: users.filter(u => u.is_active === false).length
    };
  },

  /**
   * Get available roles
   * @returns {Array<object>} Available user roles
   */
  getAvailableRoles() {
    return [
      { value: 'admin', label: 'Administrator', description: 'Full system access' },
      { value: 'citizen', label: 'Citizen', description: 'Mobile app access only' }
    ];
  },

  /**
   * Search users by name, email, or phone
   * @param {Array} users - Array of users to search
   * @param {string} query - Search query
   * @returns {Array} Filtered users
   */
  searchUsers(users, query) {
    if (!query || !query.trim()) return users;
    
    const lowerQuery = query.toLowerCase().trim();
    
    return users.filter(user => {
      return (
        (user.fullname && user.fullname.toLowerCase().includes(lowerQuery)) ||
        (user.email && user.email.toLowerCase().includes(lowerQuery)) ||
        (user.phone && user.phone.includes(lowerQuery))
      );
    });
  }
};
