import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AiConfigurationError,
  AiUsageLimitError,
  parseQuery,
} from "./xai.js";

function configureEnvironment(t) {
  const keys = [
    "XAI_API_KEY",
    "XAI_MODEL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "AI_MONTHLY_TOKEN_BUDGET",
    "AI_DAILY_REQUEST_LIMIT",
    "AI_MAX_OUTPUT_TOKENS",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;

  Object.assign(process.env, {
    XAI_API_KEY: "test-xai-key",
    XAI_MODEL: "test-grok-non-reasoning",
    UPSTASH_REDIS_REST_URL: "https://redis.example",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
    AI_MONTHLY_TOKEN_BUDGET: "50000",
    AI_DAILY_REQUEST_LIMIT: "7",
    AI_MAX_OUTPUT_TOKENS: "256",
  });

  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    globalThis.fetch = previousFetch;
  });
}

test("sends Grok Responses requests with output limits and records usage", async (t) => {
  configureEnvironment(t);
  const redisCommands = [];
  let grokRequest;
  globalThis.fetch = async (url, options) => {
    if (url === "https://redis.example") {
      const command = JSON.parse(options.body);
      redisCommands.push(command);
      const isReservation = command[1].includes("daily_limit");
      return Response.json({ result: isReservation ? [1, 500] : 1 });
    }

    grokRequest = { url, options };
    return Response.json({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: '{"ingredients":["rice","chicken"],"notes":null}',
            },
          ],
        },
      ],
      usage: { total_tokens: 42 },
    });
  };

  const intent = await parseQuery("rice and chicken", "192.0.2.10");

  assert.deepEqual(intent, { ingredients: ["rice", "chicken"], notes: null });
  assert.equal(grokRequest.url, "https://api.x.ai/v1/responses");
  assert.equal(grokRequest.options.headers.Authorization, "Bearer test-xai-key");
  const requestBody = JSON.parse(grokRequest.options.body);
  assert.equal(requestBody.model, "test-grok-non-reasoning");
  assert.equal(requestBody.max_output_tokens, 256);
  assert.deepEqual(requestBody.text, { format: { type: "json_object" } });
  assert.equal(redisCommands.length, 2);
  assert.equal(redisCommands[0][0], "EVAL");
  assert.ok(redisCommands[0].includes("7"));
  assert.ok(redisCommands[0].includes("50000"));
  assert.equal(redisCommands[1][0], "EVAL");
});

test("does not call Grok when the shared monthly token budget is exhausted", async (t) => {
  configureEnvironment(t);
  let grokCalls = 0;
  globalThis.fetch = async (url) => {
    if (url === "https://redis.example") {
      return Response.json({ result: [0, "monthly_limit"] });
    }
    grokCalls += 1;
    throw new Error("Grok should not be called");
  };

  await assert.rejects(
    parseQuery("rice and chicken", "192.0.2.10"),
    AiUsageLimitError
  );
  assert.equal(grokCalls, 0);
});

test("does not call Grok after a visitor reaches the daily request limit", async (t) => {
  configureEnvironment(t);
  let grokCalls = 0;
  globalThis.fetch = async (url) => {
    if (url === "https://redis.example") {
      return Response.json({ result: [0, "visitor_limit"] });
    }
    grokCalls += 1;
    throw new Error("Grok should not be called");
  };

  await assert.rejects(
    parseQuery("rice and chicken", "192.0.2.10"),
    AiUsageLimitError
  );
  assert.equal(grokCalls, 0);
});

test("rejects reasoning models before making provider or quota calls", async (t) => {
  configureEnvironment(t);
  process.env.XAI_MODEL = "grok-4.7";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("No external calls should be made");
  };

  await assert.rejects(
    parseQuery("rice and chicken", "192.0.2.10"),
    AiConfigurationError
  );
  assert.equal(fetchCalls, 0);
});
