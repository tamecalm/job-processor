import Joi from 'joi';

export const validateJob = Joi.object({
  name: Joi.string().valid('send-email').required(),
  data: Joi.object({
    email: Joi.string().email().required(),
    content: Joi.string().required(),
  }).required(),
});