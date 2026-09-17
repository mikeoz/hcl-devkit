/**
 * HCL DevKit — CARD Schema Validators
 *
 * Validate CARD credentials and CARD Sets against the HCL JSON schemas.
 * Zero external dependencies — implements structural validation directly.
 *
 * For full JSON Schema validation, use the schemas in the
 * human-consent-layer repo with a JSON Schema validator of your choice.
 * This module provides lightweight structural checks sufficient for
 * runtime validation without a schema library dependency.
 *
 * @license Apache-2.0
 * @copyright Opnli Corporation
 */

'use strict';

/**
 * Validate a CARD credential.
 *
 * Checks required fields, types, and enum values per
 * card-credential.schema.json v0.1.0.
 *
 * @param {object} card - A CARD credential object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCard(card) {
  const errors = [];

  if (!card || typeof card !== 'object') {
    return { valid: false, errors: ['card must be a non-null object'] };
  }

  // Required fields
  const required = ['card_version', 'agent_id', 'card_type', 'issued_at', 'issuer', 'trust_surface'];
  for (const field of required) {
    if (card[field] === undefined || card[field] === null) {
      errors.push('missing required field: ' + field);
    }
  }

  // card_version
  if (card.card_version !== undefined && card.card_version !== '0.1.0') {
    errors.push('card_version must be "0.1.0", got "' + card.card_version + '"');
  }

  // card_type
  const validTypes = ['yellow_shield', 'green_shield'];
  if (card.card_type !== undefined && !validTypes.includes(card.card_type)) {
    errors.push('card_type must be one of: ' + validTypes.join(', '));
  }

  // issuer
  if (card.issuer !== undefined && card.issuer !== null) {
    if (typeof card.issuer !== 'object') {
      errors.push('issuer must be an object');
    } else {
      if (!card.issuer.id) errors.push('issuer.id is required');
      if (!card.issuer.name) errors.push('issuer.name is required');
    }
  }

  // trust_surface
  if (card.trust_surface !== undefined && card.trust_surface !== null) {
    if (typeof card.trust_surface !== 'object') {
      errors.push('trust_surface must be an object');
    } else {
      if (!card.trust_surface.tools_hash) errors.push('trust_surface.tools_hash is required');
      if (card.trust_surface.tools_hash && !/^[a-f0-9]{64}$/.test(card.trust_surface.tools_hash)) {
        errors.push('trust_surface.tools_hash must be a 64-character hex string');
      }
      if (card.trust_surface.tool_count === undefined) errors.push('trust_surface.tool_count is required');
    }
  }

  // consent_model
  if (card.consent_model !== undefined && card.consent_model !== null) {
    if (typeof card.consent_model !== 'object') {
      errors.push('consent_model must be an object');
    } else {
      const validModes = ['cbd', 'cbe'];
      if (card.consent_model.mode && !validModes.includes(card.consent_model.mode)) {
        errors.push('consent_model.mode must be one of: ' + validModes.join(', '));
      }
      if (card.consent_model.fail_closed !== undefined && card.consent_model.fail_closed !== true) {
        errors.push('consent_model.fail_closed must be true (HCL invariant)');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a CARD Set.
 *
 * Checks required fields and structural integrity of all four CARDs
 * per card-set.schema.json v0.1.0.
 *
 * @param {object} cardSet - A CARD Set object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCardSet(cardSet) {
  const errors = [];

  if (!cardSet || typeof cardSet !== 'object') {
    return { valid: false, errors: ['cardSet must be a non-null object'] };
  }

  // Required top-level fields
  const required = [
    'set_version', 'set_id', 'entity_card', 'data_card',
    'use_card', 'boundary_card', 'principal', 'presented_at'
  ];
  for (const field of required) {
    if (cardSet[field] === undefined || cardSet[field] === null) {
      errors.push('missing required field: ' + field);
    }
  }

  // set_version
  if (cardSet.set_version !== undefined && cardSet.set_version !== '0.1.0') {
    errors.push('set_version must be "0.1.0"');
  }

  // principal
  if (cardSet.principal && typeof cardSet.principal === 'object') {
    if (!cardSet.principal.id) errors.push('principal.id is required');
    if (cardSet.principal.type !== 'nhb') {
      errors.push('principal.type must be "nhb" — only a human can authorize a CARD Set');
    }
  }

  // entity_card
  if (cardSet.entity_card && typeof cardSet.entity_card === 'object') {
    const ec = cardSet.entity_card;
    if (ec.card_type !== 'entity') errors.push('entity_card.card_type must be "entity"');
    const ecRequired = ['agent_id', 'agent_name', 'platform', 'shield_level', 'tno_id', 've_endpoint'];
    for (const field of ecRequired) {
      if (!ec[field]) errors.push('entity_card.' + field + ' is required');
    }
    if (ec.shield_level && !['green', 'yellow'].includes(ec.shield_level)) {
      errors.push('entity_card.shield_level must be "green" or "yellow"');
    }
  }

  // data_card
  if (cardSet.data_card && typeof cardSet.data_card === 'object') {
    if (cardSet.data_card.card_type !== 'data') errors.push('data_card.card_type must be "data"');
    if (!Array.isArray(cardSet.data_card.data_resources)) {
      errors.push('data_card.data_resources must be an array');
    } else {
      for (let i = 0; i < cardSet.data_card.data_resources.length; i++) {
        const r = cardSet.data_card.data_resources[i];
        if (!r.resource) errors.push('data_card.data_resources[' + i + '].resource is required');
        if (!r.access) errors.push('data_card.data_resources[' + i + '].access is required');
        if (r.access && !['read', 'write', 'read-write'].includes(r.access)) {
          errors.push('data_card.data_resources[' + i + '].access must be read, write, or read-write');
        }
      }
    }
  }

  // use_card
  if (cardSet.use_card && typeof cardSet.use_card === 'object') {
    if (cardSet.use_card.card_type !== 'use') errors.push('use_card.card_type must be "use"');
    if (!Array.isArray(cardSet.use_card.permitted_actions)) {
      errors.push('use_card.permitted_actions must be an array');
    }
  }

  // boundary_card
  if (cardSet.boundary_card && typeof cardSet.boundary_card === 'object') {
    if (cardSet.boundary_card.card_type !== 'boundary') errors.push('boundary_card.card_type must be "boundary"');
    if (!cardSet.boundary_card.constraint_domain) errors.push('boundary_card.constraint_domain is required');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateCard, validateCardSet };
