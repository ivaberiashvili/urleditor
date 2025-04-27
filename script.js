// =============== Custom CodeMirror Mode ===============
CodeMirror.defineMode("urlmode", function (config, parserConfig) {
    return {
        startState: function () {
            return {
                inQuery: false,
                paramPhase: null,
            };
        },
        token: function (stream, state) {
            if (!state.inQuery) {
                if (stream.peek() === "?") {
                    stream.next();
                    state.inQuery = true;
                    state.paramPhase = "key";
                    return "punctuation";
                }
                stream.next();
                return "domain";
            } else {
                if (stream.peek() === "&") {
                    stream.next();
                    state.paramPhase = "key";
                    return "punctuation";
                }
                if (state.paramPhase === "key") {
                    if (stream.match(/[^=&]+/, true)) {
                        if (stream.peek() === "=") {
                            state.paramPhase = "operator";
                        }
                        return "parameter";
                    }
                }
                if (state.paramPhase === "operator") {
                    if (stream.match("=", true)) {
                        state.paramPhase = "value";
                        return "punctuation";
                    }
                }
                if (state.paramPhase === "value") {
                    if (stream.match(/[^&]+/, true)) {
                        return "value";
                    }
                }
                stream.next();
                return null;
            }
        },
    };
});

// =============== Utility Functions ===============
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function parseUrl(url) {
    const trimmedUrl = url.trim();
    const questionIndex = trimmedUrl.indexOf("?");
    if (questionIndex === -1) {
        return [trimmedUrl];
    }

    const domain = trimmedUrl.slice(0, questionIndex + 1);
    const query = trimmedUrl.slice(questionIndex + 1);
    const pairs = query.split("&");
    
    return [domain, ...pairs.map((pair, index) => index === 0 ? pair : `&${pair}`)];
}

function createDeletedMask(original, edited) {
    const mask = new Array(original.length).fill(false);
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(original, edited);
    dmp.diff_cleanupSemantic(diffs);
    
    let originalPos = 0;
    diffs.forEach(([op, text]) => {
        if (op === 0) {
            originalPos += text.length;
        } else if (op === -1) {
            for (let i = 0; i < text.length; i++) {
                mask[originalPos + i] = true;
            }
            originalPos += text.length;
        }
    });
    return mask;
}

function colorizeWithDeletions(original, deletedMask) {
    const questionIndex = original.indexOf("?");
    if (questionIndex === -1) {
        return colorizeSegmentWithDeletions(original, 0, deletedMask);
    }
    
    const domain = original.slice(0, questionIndex + 1);
    const query = original.slice(questionIndex + 1);
    
    let domainColored = colorizeSegmentWithDeletions(domain, 0, deletedMask);
    
    const queryChunks = query.split("&");
    let queryHTML = "";
    let offset = domain.length;
    
    for (let i = 0; i < queryChunks.length; i++) {
        const chunk = queryChunks[i];
        const chunkHTML = colorizeQueryParamWithDeletions(chunk, offset, deletedMask);
        if (i > 0) {
            queryHTML += `<span class="punctuation">&amp;</span>`;
        }
        queryHTML += chunkHTML;
        offset += chunk.length + (i < queryChunks.length - 1 ? 1 : 0);
    }
    
    return domainColored + queryHTML;
}

function colorizeSegmentWithDeletions(segment, baseOffset, deletedMask) {
    let result = "";
    for (let i = 0; i < segment.length; i++) {
        const charIndex = baseOffset + i;
        const c = segment[i];
        const escaped = escapeHtml(c);
        if (deletedMask[charIndex]) {
            result += `<span class="deleted">${escaped}</span>`;
        } else {
            result += escaped;
        }
    }
    return result;
}

function colorizeQueryParamWithDeletions(param, baseOffset, deletedMask) {
    const eqIndex = param.indexOf("=");
    if (eqIndex === -1) {
        let paramPart = colorizeSegmentWithDeletions(param, baseOffset, deletedMask);
        return `<span class="parameter">${paramPart}</span>`;
    } else {
        const key = param.slice(0, eqIndex);
        const val = param.slice(eqIndex + 1);
        const keyHTML = colorizeSegmentWithDeletions(key, baseOffset, deletedMask);
        const eqHTML = deletedMask[baseOffset + eqIndex] ? `<span class="deleted">=</span>` : "=";
        const valHTML = colorizeSegmentWithDeletions(val, baseOffset + eqIndex + 1, deletedMask);
        return `<span class="parameter">${keyHTML}${eqHTML}</span><span class="value">${valHTML}</span>`;
    }
}

function checkUrlMatch(original, outputDiv, messageElement) {
    const plain = outputDiv.textContent;
    if (!original.startsWith("http://") && !original.startsWith("https://")) {
        messageElement.textContent = "not a URL";
        messageElement.style.color = "var(--color-red)";
    } else if (original === plain) {
        messageElement.textContent = "URLs match";
        messageElement.style.color = "var(--color-green)";
    } else {
        messageElement.textContent = "URLs mismatch";
        messageElement.style.color = "var(--color-red)";
    }
}

// =============== DOM Elements and Event Handlers ===============
const clicksInput = document.getElementById("clicksInput");
const clicksOutput = document.getElementById("clicksOutput");
const clicksMessage = document.getElementById("clicksMessage");
let originalInputValue = "";

// Instantiate CodeMirror on the "Edit URL" textarea
const editor = CodeMirror.fromTextArea(document.getElementById("clicksEditor"), {
    lineNumbers: false,
    mode: "urlmode",
    lineWrapping: true,
    viewportMargin: Infinity,
    extraKeys: {
        "Enter": function(cm) {
            const pos = cm.getCursor();
            const lineText = cm.getLine(pos.line);

            if (pos.ch === lineText.length) {
                // cursor at end-of-line → insert a new line with '&'
                cm.replaceRange("\n&", { line: pos.line, ch: lineText.length });
                cm.setCursor({ line: pos.line + 1, ch: 1 });
            } else {
                // default newline + auto-indent
                cm.execCommand("newlineAndIndent");
            }

            // refresh your little buttons
            addLineDeleteButtons();
            cm.focus();
        }
    }
});

// Helper: Colorize and explode URL into lines for Styled URL
function colorizeExplodedUrlLines(url) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return '';
    const questionIndex = trimmedUrl.indexOf("?");
    if (questionIndex === -1) {
        // No query string
        return `<span class='cm-domain'>${escapeHtml(trimmedUrl)}</span>`;
    }
    const domain = trimmedUrl.slice(0, questionIndex);
    const qmark = '?';
    const query = trimmedUrl.slice(questionIndex + 1);
    const pairs = query.split("&");
    let lines = [];
    // First line: domain (teal) + ? (default)
    lines.push(`<span class='cm-domain'>${escapeHtml(domain)}</span><span class='punctuation'>${qmark}</span>`);
    // Each pair on its own line
    pairs.forEach((pair, idx) => {
        let prefix = idx === 0 ? '' : `<span class='punctuation'>&amp;</span>`;
        const eqIndex = pair.indexOf('=');
        if (eqIndex === -1) {
            // Only parameter, no value
            lines.push(`${prefix}<span class='cm-parameter'>${escapeHtml(pair)}</span>`);
        } else {
            const param = pair.slice(0, eqIndex);
            const value = pair.slice(eqIndex + 1);
            lines.push(`${prefix}<span class='cm-parameter'>${escapeHtml(param)}</span><span class='punctuation'>=</span><span class='cm-value'>${escapeHtml(value)}</span>`);
        }
    });
    return lines.join('<br>');
}

// When the user types/pastes in the Input area
clicksInput.addEventListener("input", function () {
    originalInputValue = this.value.trim();
    const lines = parseUrl(originalInputValue);
    // Update Output (Styled URL)
    clicksOutput.innerHTML = colorizeExplodedUrlLines(originalInputValue);
    checkUrlMatch(originalInputValue, clicksOutput, clicksMessage);
    // Update Editor
    editor.setValue(lines.join("\n"));
    editor.refresh();
});

// In the CodeMirror editor, highlight changes
editor.on("change", function (cm, change) {
    if (window.diffMarkers) {
        window.diffMarkers.forEach((m) => m.clear());
    }
    window.diffMarkers = [];
    const newValue = cm.getValue().split("\n").join("");
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(originalInputValue, newValue);
    dmp.diff_cleanupSemantic(diffs);
    let pos = 0;
    diffs.forEach(([op, text]) => {
        if (op === 0) {
            pos += text.length;
        } else if (op === 1) {
            const startPos = cm.posFromIndex(pos);
            const endPos = cm.posFromIndex(pos + text.length);
            window.diffMarkers.push(
                cm.markText(startPos, endPos, { className: "diff-highlight" })
            );
            pos += text.length;
        }
    });
    const deletedMask = createDeletedMask(originalInputValue, newValue);
    // Update Output (Styled URL)
    clicksOutput.innerHTML = colorizeExplodedUrlLines(originalInputValue);
    checkUrlMatch(originalInputValue, clicksOutput, clicksMessage);
    editor.refresh();
});

// =============== Copy Button Logic ===============
const copyButtonInput = document.getElementById("copyButtonInput");
const copyPopupInput = document.getElementById("copyPopupInput");
const refreshButtonInput = document.getElementById("refreshButtonInput");

if (refreshButtonInput) {
    refreshButtonInput.addEventListener("click", () => {
        // Keep the input value but reset everything else
        const currentInput = clicksInput.value;
        
        // Clear the editor
        editor.setValue("");
        
        // Clear the output
        clicksOutput.innerHTML = "";
        clicksMessage.textContent = "";
        
        // Clear any diff markers
        if (window.diffMarkers) {
            window.diffMarkers.forEach((m) => m.clear());
            window.diffMarkers = [];
        }
        
        // Refresh the editor
        editor.refresh();
        
        // Trigger the input event to reprocess the URL
        clicksInput.dispatchEvent(new Event('input'));
        
        // Focus back on the input
        clicksInput.focus();
    });
}

if (copyButtonInput) {
    copyButtonInput.addEventListener("click", () => {
        navigator.clipboard
            .writeText(clicksInput.value)
            .then(() => {
                copyPopupInput.style.opacity = 1;
                setTimeout(() => {
                    copyPopupInput.style.opacity = 0;
                }, 700);
            })
            .catch((err) => {
                console.error("Copy (Input) failed: ", err);
            });
    });
}

const copyButtonEditor = document.getElementById("copyButtonEditor");
const copyPopupEditor = document.getElementById("copyPopupEditor");
if (copyButtonEditor) {
    copyButtonEditor.addEventListener("click", () => {
        const textToCopy = editor.getValue().split("\n").join("");
        navigator.clipboard
            .writeText(textToCopy)
            .then(() => {
                copyPopupEditor.style.opacity = 1;
                setTimeout(() => {
                    copyPopupEditor.style.opacity = 0;
                }, 700);
            })
            .catch((err) => {
                console.error("Copy (Editor) failed: ", err);
            });
    });
}

// Add line deletion buttons
function addLineDeleteButtons() {
  // remove old buttons
  document.querySelectorAll('.line-delete-btn').forEach(b => b.remove());

  const wrapper    = editor.getWrapperElement();
  const lineHeight = editor.defaultTextHeight();  // e.g. 24px
  // Grab the top padding you set on .CodeMirror-lines (e.g. 8px)
  const topPadding = parseInt(
    getComputedStyle(wrapper.querySelector('.CodeMirror-lines')).paddingTop,
    10
  );

  for (let i = 0; i < editor.lineCount(); i++) {
    const text = editor.getLine(i).trim();
    if (!text) continue;  // skip empty lines

    // Create the button
    const btn = document.createElement('button');
    btn.className = 'line-delete-btn';

    // Center a 16px-tall icon inside a lineHeight-tall row
    const iconHeight   = 16;                              // your button height
    const verticalNudge = (lineHeight - iconHeight) / 2;  // e.g. (24–16)/2 = 4

    // Set its Y position relative to the CodeMirror wrapper
    btn.style.top = `${topPadding + i * lineHeight + verticalNudge}px`;

    // Delete the corresponding line on click
    btn.addEventListener('click', () => {
      editor.replaceRange('', { line: i, ch: 0 }, { line: i + 1, ch: 0 });
      editor.refresh();
    });

    // Append into the wrapper (which is position: relative)
    wrapper.appendChild(btn);
  }
}
editor.on("change", addLineDeleteButtons);
editor.on("refresh", addLineDeleteButtons);
addLineDeleteButtons();