# chatgpt-autocomment (Pulsar)

Right-click selected code → **ChatGPT: Auto-comment selection → (Minimal / Medium / Verbose)**

> Note: This uses the **OpenAI API** (API key), not chatgpt.com login.

## Install (from ZIP)

1. Extract into:
   - Linux/macOS: `~/.pulsar/packages/chatgpt-autocomment`
   - Windows: `%USERPROFILE%\\.pulsar\\packages\\chatgpt-autocomment`
2. In that folder:
   ```bash
   npm install
   ```
3. Restart Pulsar.

## First-time setup

Command Palette:
- **ChatGPT Autocomment: Set API Key**

The key is stored in your OS keychain via `keytar`.

## Usage

1. Select code
2. Right-click → **ChatGPT: Auto-comment selection** → choose verbosity level
3. A live timer appears in the status bar while the request runs
4. The selection is replaced with the commented version (undoable)

## Formatting safety

The prompt strictly asks the model to preserve formatting and only add comments. Because this is an LLM, it's still possible
for it to change formatting in edge cases—if you notice that, report the prompt/model you used and we can tighten the guard rails.
