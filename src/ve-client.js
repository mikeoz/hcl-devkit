/**
 * HCL DevKit — Verification Endpoint Client
 *
 * Lightweight client for querying the HCL Verification Endpoint.
 * Implements fail-closed semantics per INV-FC: any error, timeout,
 * or non-success response is treated as a denial.
 *
 * Zero external dependencies. Node.js 18+ (uses native fetch).
 *
 * @license Apache-2.0
 * @copyright Opnli Corporation
 */

'use strict';

class VEClient {
  /**
   * @param {string} baseUrl - VE base URL (e.g., 'https://consent.opn.li/v1')
   * @param {object} [options]
   * @param {number} [options.timeout=3000] - Request timeout in milliseconds
   */
  constructor(baseUrl, options = {}) {
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error('VEClient requires a baseUrl string');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeout = options.timeout || 3000;
  }

  /**
   * Verify an agent's trust status and active CARD state.
   *
   * Fail-closed: any error condition returns { verified: false }.
   *
   * @param {string} agentId - The agent's Entity CARD identifier
   * @param {string} [cardId] - Optional CARD Set ID to verify
   * @returns {Promise<{verified: boolean, reason: string|null, response: object|null}>}
   */
  async verify(agentId, cardId) {
    try {
      if (!agentId || typeof agentId !== 'string') {
        return { verified: false, reason: 'missing or invalid agent_id', response: null };
      }

      let url = this.baseUrl + '/verify?agent_id=' + encodeURIComponent(agentId);
      if (cardId) {
        url += '&card_id=' + encodeURIComponent(cardId);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timer);

      let body = null;
      try {
        body = await res.json();
      } catch (_) {
        return { verified: false, reason: 'VE returned non-JSON response', response: null };
      }

      if (!res.ok) {
        return {
          verified: false,
          reason: body.error || ('VE returned HTTP ' + res.status),
          response: body
        };
      }

      // Evaluate trust_summary.overall_status per the HCL spec
      const status = body.trust_summary && body.trust_summary.overall_status;
      if (status === 'trusted' || status === 'trusted_with_restrictions') {
        return { verified: true, reason: null, response: body };
      }

      return {
        verified: false,
        reason: 'VE status: ' + (status || 'unknown'),
        response: body
      };
    } catch (err) {
      // INV-FC: fail-closed on any error
      return {
        verified: false,
        reason: err.name === 'AbortError' ? 'VE timeout' : 'VE unreachable: ' + err.message,
        response: null
      };
    }
  }

  /**
   * Check whether an agent's Entity CARD has been revoked.
   *
   * @param {string} agentId - The agent's Entity CARD identifier
   * @returns {Promise<{revoked: boolean, reason: string|null}>}
   */
  async checkRevocation(agentId) {
    const result = await this.verify(agentId);
    if (result.response && result.response.entity_status === 'revoked') {
      return { revoked: true, reason: 'Entity CARD revoked' };
    }
    if (!result.verified) {
      // Fail-closed: if we can't confirm status, treat as potentially revoked
      return { revoked: true, reason: result.reason || 'unable to confirm status' };
    }
    return { revoked: false, reason: null };
  }
}

module.exports = { VEClient };
