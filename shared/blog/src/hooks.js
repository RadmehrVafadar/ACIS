import { useEffect, useState } from "react";
import { api } from "./api";

export function useResource(path, revision = 0) {
  const [result, setResult] = useState({ value: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ value: null, error: "" });
    api(path, { signal: controller.signal })
      .then((value) => setResult({ value, error: "" }))
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ value: null, error: error.message });
      });
    return () => controller.abort();
  }, [path, revision]);
  return result;
}
