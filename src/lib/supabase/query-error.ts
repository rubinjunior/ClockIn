type QueryError = {
  code?: string;
  message?: string;
};

type QueryResult = {
  error?: QueryError | null;
};

export function requireSuccessfulQueries(scope: string, results: QueryResult[]) {
  const error = results.find((result) => result.error)?.error;
  if (!error) return;

  console.error(`[${scope}] data query failed`, {
    code: error.code ?? "unknown",
    message: error.message ?? "unknown",
  });
  throw new Error(`${scope}_data_load_failed`);
}
