"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  ADDRESS_ATTEMPT_TIMEOUT_MS,
  configureNetworkDefaults,
} = require("../src/lib/network");

describe("network defaults", () => {
  it("keeps address-family fallback and replaces Node's 250 ms connection window", () => {
    const state = { autoSelectFamily: false, attemptTimeoutMs: 250 };
    const network = {
      setDefaultAutoSelectFamily(value) {
        state.autoSelectFamily = value;
      },
      getDefaultAutoSelectFamily() {
        return state.autoSelectFamily;
      },
      setDefaultAutoSelectFamilyAttemptTimeout(value) {
        state.attemptTimeoutMs = value;
      },
      getDefaultAutoSelectFamilyAttemptTimeout() {
        return state.attemptTimeoutMs;
      },
    };

    assert.deepEqual(configureNetworkDefaults(network), {
      autoSelectFamily: true,
      attemptTimeoutMs: ADDRESS_ATTEMPT_TIMEOUT_MS,
    });
    assert.equal(ADDRESS_ATTEMPT_TIMEOUT_MS, 5_000);
  });
});
