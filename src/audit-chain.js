/**
 * HCL DevKit — Audit Chain Library
 *
 * Create, extend, and verify SHA-256 hash-chained audit logs.
 * Each entry's hash incorporates the previous entry's hash,
 * forming a tamper-evident chain per INV-TE.
 *
 * Zero external dependencies. Node.js 18+ (uses native crypto).
 *
 * @license Apache-2.0
 * @copyright Opnli Corporation
 */

'use strict';

const crypto = require('crypto');

/**
 * Compute SHA-256 hex digest of a string.
 * @param {string} input
 * @returns {string} 64-character hex hash
 */
function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

class AuditChain {
  constructor() {
    this.entries = [];
  }

  /**
   * Append a consent decision to the chain.
   *
   * The hash is computed over: previous_hash + timestamp + JSON(data).
   * The first entry uses a genesis hash of 64 zeros.
   *
   * @param {object} data - The consent decision record (action, decision, agent, etc.)
   * @returns {object} The complete entry with hash, index, and timestamp
   */
  append(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('append() requires a data object');
    }

    const index = this.entries.length;
    const previousHash = index === 0
      ? '0'.repeat(64)
      : this.entries[index - 1].hash;
    const timestamp = new Date().toISOString();
    const serialized = JSON.stringify(data);
    const hash = sha256(previousHash + timestamp + serialized);

    const entry = {
      index,
      timestamp,
      data,
      previous_hash: previousHash,
      hash
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Verify the integrity of the entire chain.
   *
   * Walks every entry and recomputes its hash from its inputs.
   * Returns the first point of corruption if any.
   *
   * @returns {{ valid: boolean, length: number, error: string|null, broken_at: number|null }}
   */
  verify() {
    if (this.entries.length === 0) {
      return { valid: true, length: 0, error: null, broken_at: null };
    }

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Check previous_hash linkage
      const expectedPrev = i === 0
        ? '0'.repeat(64)
        : this.entries[i - 1].hash;

      if (entry.previous_hash !== expectedPrev) {
        return {
          valid: false,
          length: this.entries.length,
          error: 'previous_hash mismatch at index ' + i,
          broken_at: i
        };
      }

      // Recompute hash
      const recomputed = sha256(
        entry.previous_hash + entry.timestamp + JSON.stringify(entry.data)
      );

      if (entry.hash !== recomputed) {
        return {
          valid: false,
          length: this.entries.length,
          error: 'hash mismatch at index ' + i,
          broken_at: i
        };
      }
    }

    return { valid: true, length: this.entries.length, error: null, broken_at: null };
  }

  /**
   * Export the chain as a JSON-serializable array.
   * @returns {object[]} The complete chain
   */
  export() {
    return JSON.parse(JSON.stringify(this.entries));
  }

  /**
   * Import a previously exported chain and verify its integrity.
   *
   * @param {object[]} entries - A chain exported via export()
   * @returns {{ valid: boolean, length: number, error: string|null, broken_at: number|null }}
   */
  importChain(entries) {
    if (!Array.isArray(entries)) {
      throw new Error('importChain() requires an array');
    }

    this.entries = JSON.parse(JSON.stringify(entries));
    return this.verify();
  }

  /**
   * Get the number of entries in the chain.
   * @returns {number}
   */
  get length() {
    return this.entries.length;
  }

  /**
   * Get the most recent entry.
   * @returns {object|null}
   */
  get latest() {
    return this.entries.length > 0
      ? this.entries[this.entries.length - 1]
      : null;
  }
}

module.exports = { AuditChain, sha256 };
