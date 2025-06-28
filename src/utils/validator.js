import Joi from 'joi';

/**
 * Enhanced job validation with security considerations
 */
export const validateJob = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/) // Security: Only allow safe characters
      .messages({
        'string.pattern.base': 'Job name can only contain letters, numbers, underscores, and hyphens'
      }),
    data: Joi.object({
      recipient: Joi.string()
        .email({ tlds: { allow: false } }) // Allow all TLDs but validate format
        .required()
        .max(254) // RFC 5321 email length limit
        .messages({
          'string.email': 'Recipient must be a valid email address'
        }),
      subject: Joi.string()
        .required()
        .min(1)
        .max(200)
        .pattern(/^[^<>]*$/) // Security: Prevent HTML/script injection
        .messages({
          'string.pattern.base': 'Subject cannot contain < or > characters'
        }),
      // Security: Prevent additional unexpected fields
    }).required().options({ stripUnknown: true })
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true, // Security: Remove unknown fields
    convert: true
  });
};

/**
 * Validate MongoDB ObjectId format
 */
export const validateObjectId = (id) => {
  const schema = Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid ID format'
    });
    
  return schema.validate(id);
};

/**
 * Validate login credentials
 */
export const validateLogin = (data) => {
  const schema = Joi.object({
    username: Joi.string()
      .required()
      .min(1)
      .max(50)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .messages({
        'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens'
      }),
    password: Joi.string()
      .required()
      .min(1)
      .max(200) // Reasonable password length limit
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
};