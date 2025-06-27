import Joi from 'joi';

export const validateJob = (data) => {
  const schema = Joi.object({
    name: Joi.string().required().min(1).max(100),
    data: Joi.object({
      recipient: Joi.string().email().required(),
      subject: Joi.string().required().min(1).max(200),
    }).required(),
  });

  return schema.validate(data, { abortEarly: false });
};