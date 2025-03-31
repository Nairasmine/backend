const validateRequest = (rules) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      let value = req.body[field];

      // Check required fields
      if (rule.required && !value) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip validation if field is optional and not provided
      if (!rule.required && value === undefined) {
        continue;
      }

      // Validate type
      switch (rule.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          } else {
            value = value.trim(); // Trim value for cleaner validation
            if (rule.min && value.length < rule.min) {
              errors.push(`${field} must be at least ${rule.min} characters`);
            }
            if (rule.max && value.length > rule.max) {
              errors.push(`${field} must be at most ${rule.max} characters`);
            }
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push(`${field} must be a valid email address`);
          }
          break;

        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${field} must be a valid number`);
          } else {
            if (rule.min !== undefined && value < rule.min) {
              errors.push(`${field} must be greater than or equal to ${rule.min}`);
            }
            if (rule.max !== undefined && value > rule.max) {
              errors.push(`${field} must be less than or equal to ${rule.max}`);
            }
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${field} must be a boolean`);
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`${field} must be an array`);
          } else {
            if (rule.minItems && value.length < rule.minItems) {
              errors.push(`${field} must have at least ${rule.minItems} items`);
            }
            if (rule.maxItems && value.length > rule.maxItems) {
              errors.push(`${field} must have at most ${rule.maxItems} items`);
            }
          }
          break;

        case 'enum':
          if (!rule.values.includes(value)) {
            errors.push(`${field} must be one of the following: ${rule.values.join(', ')}`);
          }
          break;

        default:
          errors.push(`${field} has an unsupported type`);
          break;
      }

      // Custom validation logic
      if (rule.validate && typeof rule.validate === 'function') {
        const customError = rule.validate(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        errors: errors.map((error) => ({ message: error }))
      });
    }

    next();
  };
};

module.exports = { validateRequest };
