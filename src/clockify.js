const BASE_URL = "https://api.clockify.me/api/v1";

function headers() {
  return { "X-Api-Key": process.env.CLOCKIFY_API_KEY, "Content-Type": "application/json" };
}

export async function getUserInfo() {
  const res = await fetch(`${BASE_URL}/user`, { headers: headers() });
  if (!res.ok) throw new Error(`Clockify ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function startTimer(description, workspaceId) {
  const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/time-entries`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ start: new Date().toISOString(), description }),
  });
  if (!res.ok) throw new Error(`Clockify ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function stopTimer(workspaceId, userId) {
  const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/user/${userId}/time-entries`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ end: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Clockify ${res.status}: ${await res.text()}`);
  return res.json();
}
