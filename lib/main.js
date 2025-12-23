"use strict";

const { CompositeDisposable } = require("atom");
const auth = require("./auth");
const ui = require("./ui");
const openai = require("./openai");

const VERBOSITIES = ["minimal", "medium", "verbose"];

/**
 * Create a small status bar element (spinner + text).
 * We keep it dependency-free and very lightweight.
 */
function createStatusElement() {
  const el = document.createElement("div");
  el.className = "chatgpt-autocomment-status";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.gap = "6px";
  el.style.padding = "0 6px";
  el.style.whiteSpace = "nowrap";

  // Simple CSS spinner
  const spinner = document.createElement("span");
  spinner.style.width = "10px";
  spinner.style.height = "10px";
  spinner.style.border = "2px solid currentColor";
  spinner.style.borderTopColor = "transparent";
  spinner.style.borderRadius = "50%";
  spinner.style.display = "inline-block";
  spinner.style.animation = "chatgpt-autocomment-spin 0.8s linear infinite";

  const text = document.createElement("span");
  text.textContent = "ChatGPT: idle";

  // Inject keyframes once
  if (!document.getElementById("chatgpt-autocomment-style")) {
    const style = document.createElement("style");
    style.id = "chatgpt-autocomment-style";
    style.textContent = `
      @keyframes chatgpt-autocomment-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  el.appendChild(spinner);
  el.appendChild(text);

  return { el, spinner, text };
}

module.exports = {
  subscriptions: null,
  menuDisposable: null,
  contextMenuDisposable: null,

  // Status bar integration
  statusBar: null,
  statusTile: null,
  statusUi: null,
  statusTimer: null,
  statusStartMs: 0,

  /**
   * Pulsar will call this if the status-bar service is available.
   * We declare this in package.json "consumedServices".
   */
  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;

    // Create UI and add it as a right-side tile.
    this.statusUi = createStatusElement();
    this.statusUi.el.style.display = "none"; // hidden until active
    this.statusTile = statusBar.addRightTile({
      item: this.statusUi.el,
      priority: 1000
    });
  },

  activate() {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "chatgpt-autocomment:comment-selection-minimal": () => this.commentSelection("minimal"),
        "chatgpt-autocomment:comment-selection-medium":  () => this.commentSelection("medium"),
        "chatgpt-autocomment:comment-selection-verbose": () => this.commentSelection("verbose"),
        "chatgpt-autocomment:set-api-key": () => this.setApiKey(),
        "chatgpt-autocomment:clear-api-key": () => this.clearApiKey()
      })
    );

    this.contextMenuDisposable = atom.contextMenu.add({
      "atom-text-editor": [
        {
          label: "ChatGPT: Auto-comment selection",
          submenu: [
            { label: "Minimal", command: "chatgpt-autocomment:comment-selection-minimal" },
            { label: "Medium",  command: "chatgpt-autocomment:comment-selection-medium" },
            { label: "Verbose", command: "chatgpt-autocomment:comment-selection-verbose" }
          ],
          shouldDisplay: () => {
            const editor = atom.workspace.getActiveTextEditor();
            if (!editor) return false;
            return editor.getSelectedText().trim().length > 0;
          }
        }
      ]
    });

    this.menuDisposable = atom.menu.add([
      {
        label: "Packages",
        submenu: [
          {
            label: "ChatGPT Auto-comment",
            submenu: [
              { label: "Set API Key…", command: "chatgpt-autocomment:set-api-key" },
              { label: "Clear API Key", command: "chatgpt-autocomment:clear-api-key" },
              { type: "separator" },
              { label: "Comment Selection (Minimal)", command: "chatgpt-autocomment:comment-selection-minimal" },
              { label: "Comment Selection (Medium)",  command: "chatgpt-autocomment:comment-selection-medium" },
              { label: "Comment Selection (Verbose)", command: "chatgpt-autocomment:comment-selection-verbose" }
            ]
          }
        ]
      }
    ]);
  },

  deactivate() {
    this._stopStatusProgress();

    try { if (this.contextMenuDisposable) this.contextMenuDisposable.dispose(); } catch (_) {}
    this.contextMenuDisposable = null;

    try { if (this.menuDisposable) this.menuDisposable.dispose(); } catch (_) {}
    this.menuDisposable = null;

    try { if (this.subscriptions) this.subscriptions.dispose(); } catch (_) {}
    this.subscriptions = null;

    try { if (this.statusTile) this.statusTile.destroy(); } catch (_) {}
    this.statusTile = null;
    this.statusUi = null;
    this.statusBar = null;
  },

  async setApiKey() {
    try {
      const key = await ui.promptModal({
        title: "Paste your OpenAI API key (stored in OS keychain):",
        placeholder: "sk-...",
        isPassword: true,
        okLabel: "Save",
        cancelLabel: "Cancel"
      });
      if (!key) return;
      await auth.setApiKey(key);
      atom.notifications.addSuccess("ChatGPT Auto-comment: API key saved.");
    } catch (err) {
      atom.notifications.addError("ChatGPT Auto-comment: Failed to save API key.", {
        detail: String(err && err.stack ? err.stack : err),
        dismissable: true
      });
    }
  },

  async clearApiKey() {
    try {
      await auth.clearApiKey();
      atom.notifications.addSuccess("ChatGPT Auto-comment: API key removed.");
    } catch (err) {
      atom.notifications.addError("ChatGPT Auto-comment: Failed to clear API key.", {
        detail: String(err && err.stack ? err.stack : err),
        dismissable: true
      });
    }
  },

  _startStatusProgress(label) {
    const enabled = atom.config.get("chatgpt-autocomment.showStatusBarProgress");
    if (!enabled) return;
    if (!this.statusUi || !this.statusUi.el) return;

    this.statusStartMs = Date.now();
    this.statusUi.el.style.display = "flex";
    this.statusUi.text.textContent = label;

    this._stopStatusProgress(); // stop any existing timer first

    this.statusTimer = setInterval(() => {
      const elapsedMs = Date.now() - this.statusStartMs;
      const secs = Math.floor(elapsedMs / 1000);
      this.statusUi.text.textContent = `${label} (${secs}s)`;
    }, 250);
  },

  _stopStatusProgress() {
    if (this.statusTimer) {
      try { clearInterval(this.statusTimer); } catch (_) {}
    }
    this.statusTimer = null;

    // Hide element when idle
    if (this.statusUi && this.statusUi.el) {
      this.statusUi.el.style.display = "none";
      this.statusUi.text.textContent = "ChatGPT: idle";
    }
  },

  async commentSelection(verbosity) {
    if (!VERBOSITIES.includes(verbosity)) verbosity = "medium";

    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      atom.notifications.addInfo("ChatGPT Auto-comment: No active editor.");
      return;
    }

    const selected = editor.getSelectedText();
    if (!selected || selected.trim().length === 0) {
      atom.notifications.addInfo("ChatGPT Auto-comment: Select some code first.");
      return;
    }

    const maxChars = atom.config.get("chatgpt-autocomment.maxSelectionChars");
    if (selected.length > maxChars) {
      atom.notifications.addWarning("ChatGPT Auto-comment: Selection too large.", {
        detail: `Your selection is ${selected.length} characters. Limit is ${maxChars}.`,
        dismissable: true
      });
      return;
    }

    let apiKey = null;
    try {
      apiKey = await auth.getApiKey();
    } catch (err) {
      atom.notifications.addError("ChatGPT Auto-comment: Could not access OS keychain.", {
        detail: String(err && err.stack ? err.stack : err),
        dismissable: true
      });
      return;
    }

    if (!apiKey) {
      await this.setApiKey();
      apiKey = await auth.getApiKey();
      if (!apiKey) {
        atom.notifications.addInfo("ChatGPT Auto-comment: No API key set.");
        return;
      }
    }

    const model = atom.config.get("chatgpt-autocomment.model");
    const apiBaseUrl = atom.config.get("chatgpt-autocomment.apiBaseUrl");
    const timeoutMs = atom.config.get("chatgpt-autocomment.requestTimeoutMs");
    const grammarName = editor.getGrammar && editor.getGrammar() ? editor.getGrammar().name : "unknown";

    const prompt = openai.buildPrompt({ code: selected, grammarName, verbosity });

    // Progress indication:
    // 1) Status bar live timer (best UX, doesn't spam notifications)
    // 2) A single "working" notification the user can dismiss
    this._startStatusProgress(`ChatGPT: commenting (${verbosity})`);
    const working = atom.notifications.addInfo(`ChatGPT Auto-comment: Generating comments (${verbosity})…`, {
      dismissable: true,
      detail: "Watch the status bar timer for live progress."
    });

    try {
      const commented = await openai.generateCommentedCode({
        apiKey,
        apiBaseUrl,
        model,
        prompt,
        timeoutMs
      });

      // Apply to *only the selected text* in a single undo step.
      // This preserves surrounding formatting, cursor/undo works cleanly.
      editor.transact(() => {
        editor.insertText(commented);
      });

      working.dismiss();
      this._stopStatusProgress();

      atom.notifications.addSuccess("ChatGPT Auto-comment: Done.");
    } catch (err) {
      working.dismiss();
      this._stopStatusProgress();

      atom.notifications.addError("ChatGPT Auto-comment: Failed.", {
        detail: String(err && err.stack ? err.stack : err),
        dismissable: true
      });
    }
  }
};
