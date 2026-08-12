"use strict";

const net = require("node:net");

// Node's 250 ms default is too short for otherwise healthy TCP paths and can
// exhaust every resolved address before TLS has a chance to start. Keep
// dual-stack address fallback, but give each connection attempt a realistic
// window.
const ADDRESS_ATTEMPT_TIMEOUT_MS = 5_000;

function configureNetworkDefaults(network = net) {
  if (typeof network.setDefaultAutoSelectFamily === "function") {
    network.setDefaultAutoSelectFamily(true);
  }
  if (typeof network.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
    network.setDefaultAutoSelectFamilyAttemptTimeout(ADDRESS_ATTEMPT_TIMEOUT_MS);
  }
  return {
    autoSelectFamily:
      typeof network.getDefaultAutoSelectFamily === "function"
        ? network.getDefaultAutoSelectFamily()
        : null,
    attemptTimeoutMs:
      typeof network.getDefaultAutoSelectFamilyAttemptTimeout === "function"
        ? network.getDefaultAutoSelectFamilyAttemptTimeout()
        : null,
  };
}

module.exports = { ADDRESS_ATTEMPT_TIMEOUT_MS, configureNetworkDefaults };
