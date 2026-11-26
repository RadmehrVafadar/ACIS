export const categories = [
  "Technology",
  "Lifestyle",
  "Travel",
  "Food",
  "Business",
  "Health",
  "Education",
  "Entertainment",
];

export function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export async function api(path, options = {}) {
  const user = storedUser();
  const response = await fetch("/api" + path, {
    method: options.method || "GET",
    headers: {
      ...(options.body && { "Content-Type": "application/json" }),
      ...(user && { "x-user-id": user._id }),
    },
    ...(options.body && { body: JSON.stringify(options.body) }),
    signal: options.signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.message || body.detail || "Request failed (" + response.status + ")");
  return body;
}

export function dateLabel(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}
