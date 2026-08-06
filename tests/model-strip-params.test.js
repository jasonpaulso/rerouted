"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const {
  createRouter,
  stripSamplingParams,
  modelStripsSamplingParams,
} = require("../src/lib/router");
const { createStore } = require("../src/lib/store");
const { createGateway } = require("../src/lib/gateway");

function tmpConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-strip-"));
  return path.join(dir, "config.json");
}

function claudeSuccessResponse(content = "ok") {
  return new Response(
    JSON.stringify({
      id: "msg-test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: content }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function silentLogger() {
  const noop = () => {};
  return { info: noop, warn: noop, error: noop, debug: noop };
}

describe("stripSamplingParams", () => {
  it("removes the sampling knobs without mutating the input", () => {
    const body = {
      model: "m",
      messages: [],
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      min_p: 0.1,
      top_a: 0.2,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      repetition_penalty: 1.1,
      max_tokens: 256,
    };
    const out = stripSamplingParams(body);
    for (const key of [
      "temperature",
      "top_p",
      "top_k",
      "min_p",
      "top_a",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
    ]) {
      assert.equal(out[key], undefined, `${key} should be stripped`);
    }
    // Non-sampling fields survive.
    assert.equal(out.model, "m");
    assert.equal(out.max_tokens, 256);
    // Input untouched.
    assert.equal(body.temperature, 0.7);
    assert.equal(body.top_p, 0.9);
  });

  it("tolerates non-object input", () => {
    assert.equal(stripSamplingParams(null), null);
    assert.equal(stripSamplingParams(undefined), undefined);
  });
});

describe("modelStripsSamplingParams", () => {
  it("reads the per-model flag by upstream id", () => {
    const provider = {
      models: [
        { id: "a", stripSamplingParams: true },
        { id: "b", stripSamplingParams: false },
        "c",
      ],
    };
    assert.equal(modelStripsSamplingParams(provider, "a"), true);
    assert.equal(modelStripsSamplingParams(provider, "b"), false);
    assert.equal(modelStripsSamplingParams(provider, "c"), false);
    assert.equal(modelStripsSamplingParams(provider, "missing"), false);
  });
});

describe("router strips sampling params before forwarding", () => {
  function seedStore(stripSampling) {
    const store = createStore(tmpConfig());
    store.seed({
      providers: [
        {
          id: "prov_claude",
          type: "claude",
          name: "prov_claude",
          accessToken: "claude-token",
          enabled: true,
          createdAt: 100,
          models: [
            {
              id: "claude-fable-5",
              name: "Claude Fable 5",
              enabled: true,
              stripSamplingParams: stripSampling,
            },
          ],
        },
      ],
    });
    return store;
  }

  async function run(stripSampling) {
    const store = seedStore(stripSampling);
    let captured = null;
    const router = createRouter({
      store,
      logger: silentLogger(),
      fetchImpl: async (_url, options) => {
        captured = JSON.parse(options.body);
        return claudeSuccessResponse("ok");
      },
    });
    const modelId = router
      .listModels()
      .data.find((m) => m.id.endsWith("claude-fable-5")).id;
    const result = await router.chatCompletions({
      body: {
        model: modelId,
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        stream: false,
      },
    });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    return captured;
  }

  it("drops temperature/top_p/top_k when the model opts out", async () => {
    const captured = await run(true);
    assert.equal(captured.temperature, undefined);
    assert.equal(captured.top_p, undefined);
    assert.equal(captured.top_k, undefined);
  });

  it("forwards sampling params when the model does not opt out", async () => {
    const captured = await run(false);
    assert.equal(captured.temperature, 0.7);
    assert.equal(captured.top_p, 0.9);
    assert.equal(captured.top_k, 40);
  });
});

describe("anthropic /v1/messages through a named route", () => {
  // Anthropic requests stash top_k on a metadata symbol that the Claude adapter
  // replays onto the upstream body — stripping plain keys alone let it through.
  async function captureUpstream(stripSampling) {
    const store = createStore(tmpConfig());
    store.seed({
      providers: [
        {
          id: "prov_claude",
          type: "claude",
          name: "Claude",
          accountAlias: "oauth1",
          accessToken: "claude-token",
          enabled: true,
          createdAt: 100,
          models: [
            {
              id: "claude-sonnet-50",
              name: "Sonnet 50",
              enabled: true,
              stripSamplingParams: stripSampling,
            },
          ],
        },
      ],
      combos: [
        {
          id: "combo_tier1",
          name: "tier-1",
          strategy: "fallback",
          members: [{ providerType: "claude", model: "claude-sonnet-50" }],
        },
      ],
    });

    let captured = null;
    const router = createRouter({
      store,
      logger: silentLogger(),
      fetchImpl: async (_url, options) => {
        captured = JSON.parse(options.body);
        return claudeSuccessResponse();
      },
    });
    const gateway = createGateway({ store, router, port: 0 });
    const server = http.createServer((req, res) => gateway.handle(req, res));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${store.load().apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tier-1",
          max_tokens: 16,
          messages: [{ role: "user", content: "hi" }],
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
        }),
      });
      assert.equal(res.status, 200, await res.text());
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    assert.ok(captured, "no upstream request captured");
    return captured;
  }

  it("strips temperature, top_p and metadata-carried top_k when flagged", async () => {
    const captured = await captureUpstream(true);
    assert.equal(captured.temperature, undefined, "temperature leaked");
    assert.equal(captured.top_p, undefined, "top_p leaked");
    assert.equal(captured.top_k, undefined, "top_k leaked via metadata symbol");
  });

  it("leaves them intact when not flagged", async () => {
    const captured = await captureUpstream(false);
    assert.equal(captured.temperature, 0.7);
    assert.equal(captured.top_p, 0.9);
    assert.equal(captured.top_k, 40);
  });
});
