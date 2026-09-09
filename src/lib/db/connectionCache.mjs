/**
 * Resolve one shared database connection at a time.
 *
 * A rejected connection attempt must not poison the shared state forever. The
 * identity check in the catch block is important: it prevents an older
 * rejected attempt from clearing a newer concurrent retry.
 */
export async function connectWithCache({ state, connect }) {
  if (state.conn) {
    return state.conn;
  }

  const pending =
    state.promise ||
    (state.promise = Promise.resolve().then(() => connect()));

  try {
    const connection = await pending;
    state.conn = connection;
    return connection;
  } catch (error) {
    if (state.promise === pending) {
      state.promise = null;
      state.conn = null;
    }
    throw error;
  }
}
