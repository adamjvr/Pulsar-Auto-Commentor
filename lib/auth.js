"use strict";

const keytar = require("keytar");
const SERVICE_NAME = "pulsar-chatgpt-autocomment";
const ACCOUNT_NAME = "openai_api_key";

async function setApiKey(apiKey) {
  if (typeof apiKey !== "string") throw new Error("API key must be a string.");
  const trimmed = apiKey.trim();
  if (trimmed.length < 20) throw new Error("API key looks too short—double-check you pasted the full key.");
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, trimmed);
}

async function getApiKey() {
  const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  return key || null;
}

async function clearApiKey() {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}

module.exports = { setApiKey, getApiKey, clearApiKey };
