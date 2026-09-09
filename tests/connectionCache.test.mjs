import test from "node:test";
import assert from "node:assert/strict";
import { connectWithCache } from "../src/lib/db/connectionCache.mjs";

test("clears a rejected connection so the next request can retry", async () => {
  const state = { conn: null, promise: null };
  let attempts = 0;

  await assert.rejects(
    connectWithCache({
      state,
      connect: async () => {
        attempts += 1;
        throw new Error("temporary database outage");
      },
    }),
    /temporary database outage/,
  );
  assert.equal(state.promise, null);

  const connection = { ready: true };
  const result = await connectWithCache({
    state,
    connect: async () => {
      attempts += 1;
      return connection;
    },
  });

  assert.equal(result, connection);
  assert.equal(attempts, 2);
  assert.equal(state.conn, connection);
});

test("shares one in-flight connection attempt between concurrent callers", async () => {
  const state = { conn: null, promise: null };
  let attempts = 0;
  let resolveConnection;
  const connectionReady = new Promise((resolve) => {
    resolveConnection = resolve;
  });
  const connection = { ready: true };

  const connect = async () => {
    attempts += 1;
    await connectionReady;
    return connection;
  };

  const first = connectWithCache({ state, connect });
  const second = connectWithCache({ state, connect });
  resolveConnection();

  const results = await Promise.all([first, second]);
  assert.deepEqual(results, [connection, connection]);
  assert.equal(attempts, 1);
});

test("does not clear a newer retry when an older promise rejects", async () => {
  const state = { conn: null, promise: null };
  let rejectFirst;
  const firstPromise = new Promise((_, reject) => {
    rejectFirst = reject;
  });
  state.promise = firstPromise;

  const firstRequest = connectWithCache({
    state,
    connect: async () => ({ unexpected: true }),
  });
  const newerPromise = Promise.resolve({ ready: "retry" });
  state.promise = newerPromise;
  rejectFirst(new Error("stale attempt failed"));

  await assert.rejects(firstRequest, /stale attempt failed/);
  assert.equal(state.promise, newerPromise);
});
