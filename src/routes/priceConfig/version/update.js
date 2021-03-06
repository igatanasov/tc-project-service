/* eslint-disable no-trailing-spaces */
/**
 * API to add a project type
 */
import config from 'config';
import validate from 'express-validation';
import _ from 'lodash';
import Joi from 'joi';
import { middleware as tcMiddleware } from 'tc-core-library-js';
import { EVENT, RESOURCES } from '../../../constants';
import util from '../../../util';
import models from '../../../models';

const permissions = tcMiddleware.permissions;

const schema = {
  params: {
    version: Joi.number().integer().positive().required(),
    key: Joi.string().max(45).required(),
  },

  body: Joi.object().keys({
    config: Joi.object().required(),

    createdAt: Joi.any().strip(),
    updatedAt: Joi.any().strip(),
    deletedAt: Joi.any().strip(),
    createdBy: Joi.any().strip(),
    updatedBy: Joi.any().strip(),
    deletedBy: Joi.any().strip(),
  }).required(),

};

module.exports = [
  validate(schema),
  permissions('priceConfig.create'),
  (req, res, next) => {
    models.sequelize.transaction(() => models.PriceConfig.findAll({
      where: {
        key: req.params.key,
        version: req.params.version,
      },
      order: [['revision', 'DESC']],
    }).then((priceConfigs) => {
      if (priceConfigs.length >= config.get('MAX_REVISION_NUMBER')) {
        return models.PriceConfig.deleteOldestRevision(req.authUser.userId, req.params.key, req.params.version)
          .then(() => Promise.resolve(priceConfigs[0]));
      } else if (priceConfigs.length === 0) {
        const apiErr = new Error(`PriceConfig not found for key ${req.params.key} version ${req.params.version}`);
        apiErr.status = 404;
        return Promise.reject(apiErr);
      }
      return Promise.resolve(priceConfigs[0]);
    })
    .then((priceConfig) => {
      const revision = priceConfig.revision + 1;
      const entity = {
        version: req.params.version,
        revision,
        createdBy: req.authUser.userId,
        updatedBy: req.authUser.userId,
        key: req.params.key,
        config: req.body.config,
      };
      return models.PriceConfig.create(entity);
    })
    .then((createdEntity) => {
      util.sendResourceToKafkaBus(req,
        EVENT.ROUTING_KEY.PROJECT_METADATA_CREATE,
        RESOURCES.PRICE_CONFIG_VERSION,
        createdEntity.toJSON());
      // Omit deletedAt, deletedBy
      res.status(201).json(_.omit(createdEntity.toJSON(), 'deletedAt', 'deletedBy'));
    })
    .catch(next));
  },
];
