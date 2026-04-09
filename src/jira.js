export async function getJiraIssue(issueKey) {
  const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  const url = `https://${JIRA_DOMAIN}/rest/api/3/issue/${issueKey}?fields=summary`;
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Jira ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function addWorklog(issueKey, timeSpentSeconds) {
  const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  const url = `https://${JIRA_DOMAIN}/rest/api/3/issue/${issueKey}/worklog`;
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ timeSpentSeconds }),
  });

  if (!res.ok) {
    throw new Error(`Jira worklog ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
