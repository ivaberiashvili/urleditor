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

// function createDeletedMask(original, edited) {
//     const mask = new Array(original.length).fill(false);
//     const dmp = new diff_match_patch();
//     const diffs = dmp.diff_main(original, edited);
//     dmp.diff_cleanupSemantic(diffs);
    
//     let originalPos = 0;
//     diffs.forEach(([op, text]) => {
//         if (op === 0) {
//             originalPos += text.length;
//         } else if (op === -1) {
//             for (let i = 0; i < text.length; i++) {
//                 mask[originalPos + i] = true;
//             }
//             originalPos += text.length;
//         }
//     });
//     return mask;
// }

// function colorizeWithDeletions(original, deletedMask) {
//     const questionIndex = original.indexOf("?");
//     if (questionIndex === -1) {
//         return colorizeSegmentWithDeletions(original, 0, deletedMask);
//     }
    
//     const domain = original.slice(0, questionIndex + 1);
//     const query = original.slice(questionIndex + 1);
    
//     let domainColored = colorizeSegmentWithDeletions(domain, 0, deletedMask);
    
//     const queryChunks = query.split("&");
//     let queryHTML = "";
//     let offset = domain.length;
    
//     for (let i = 0; i < queryChunks.length; i++) {
//         const chunk = queryChunks[i];
//         const chunkHTML = colorizeQueryParamWithDeletions(chunk, offset, deletedMask);
//         if (i > 0) {
//             queryHTML += `<span class="punctuation">&amp;</span>`;
//         }
//         queryHTML += chunkHTML;
//         offset += chunk.length + (i < queryChunks.length - 1 ? 1 : 0);
//     }
    
//     return domainColored + queryHTML;
// }

// function colorizeSegmentWithDeletions(segment, baseOffset, deletedMask) {
//     let result = "";
//     for (let i = 0; i < segment.length; i++) {
//         const charIndex = baseOffset + i;
//         const c = segment[i];
//         const escaped = escapeHtml(c);
//         if (deletedMask[charIndex]) {
//             result += `<span class="deleted">${escaped}</span>`;
//         } else {
//             result += escaped;
//         }
//     }
//     return result;
// }

// function colorizeQueryParamWithDeletions(param, baseOffset, deletedMask) {
//     const eqIndex = param.indexOf("=");
//     if (eqIndex === -1) {
//         let paramPart = colorizeSegmentWithDeletions(param, baseOffset, deletedMask);
//         return `<span class="parameter">${paramPart}</span>`;
//     } else {
//         const key = param.slice(0, eqIndex);
//         const val = param.slice(eqIndex + 1);
//         const keyHTML = colorizeSegmentWithDeletions(key, baseOffset, deletedMask);
//         const eqHTML = deletedMask[baseOffset + eqIndex] ? `<span class="deleted">=</span>` : "=";
//         const valHTML = colorizeSegmentWithDeletions(val, baseOffset + eqIndex + 1, deletedMask);
//         return `<span class="parameter">${keyHTML}${eqHTML}</span><span class="value">${valHTML}</span>`;
//     }
// }

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
                if (pos.line === 0) {
                    // Insert a new blank line below (no &)
                    cm.replaceRange("\n", { line: pos.line, ch: lineText.length });
                    cm.setCursor({ line: pos.line + 1, ch: 0 });
                    // If there is a third line, ensure it starts with '&'
                    setTimeout(() => {
                        if (cm.lineCount() > 2) {
                            const thirdLine = cm.getLine(2);
                            if (thirdLine && !thirdLine.startsWith('&')) {
                                cm.replaceRange('&', { line: 2, ch: 0 });
                            }
                        }
                    }, 0);
                } else {
                    // For second line and onward, insert a new line with '&' at the start
                    cm.replaceRange("\n&", { line: pos.line, ch: lineText.length });
                    cm.setCursor({ line: pos.line + 1, ch: 1 });
                }
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

// make clicks in the bottom padding insert a real new line
const wrapper = editor.getWrapperElement();
wrapper.addEventListener("click", (e) => {
  const { top } = wrapper.getBoundingClientRect();
  const clickY = e.clientY - top;
  const lineHeight = editor.defaultTextHeight();
  const contentHeight = editor.lineCount() * lineHeight;
  // 8px = the CodeMirror .lines top padding you've set in CSS
  if (clickY > contentHeight + 8) {
    // insert a new param line at the end
    const lastLine = editor.lineCount() - 1;
    const lastCh  = editor.getLine(lastLine).length;
    editor.replaceRange("\n&", { line: lastLine, ch: lastCh });
    editor.focus();
    addLineDeleteButtons();
  }
});

// Auto-split pasted URL params into separate lines
editor.on("beforeChange", (cm, change) => {
  // only intercept real paste events
  if (change.origin === "paste") {
    // the full pasted text
    const pasted = change.text.join("\n");
    // make sure it looks like a chunk of params (has & and =)
    if (pasted.includes("&") && pasted.includes("=")) {
      // split on &, strip any leading "?" and empties
      const pairs = pasted
        .split("&")
        .map(s => s.trim().replace(/^\?/, ""))
        .filter(Boolean);
      // re-prefix "&" on each one
      const lines = pairs.map(pair => "&" + pair);
      // replace the paste with our lines
      change.update(null, null, lines);
      // re-draw the delete buttons
      setTimeout(addLineDeleteButtons, 0);
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
    // if (window.diffMarkers) {
    //     window.diffMarkers.forEach((m) => m.clear());
    // }
    // window.diffMarkers = [];
    // const newValue = cm.getValue().split("\n").join("");
    // const dmp = new diff_match_patch();
    // const diffs = dmp.diff_main(originalInputValue, newValue);
    // dmp.diff_cleanupSemantic(diffs);
    // let pos = 0;
    // diffs.forEach(([op, text]) => {
    //     if (op === 0) {
    //         pos += text.length;
    //     } else if (op === 1) {
    //         const startPos = cm.posFromIndex(pos);
    //         const endPos = cm.posFromIndex(pos + text.length);
    //         window.diffMarkers.push(
    //             cm.markText(startPos, endPos, { className: "diff-highlight" })
    //         );
    //         pos += text.length;
    //     }
    // });
    // const deletedMask = createDeletedMask(originalInputValue, newValue);
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
        // if (window.diffMarkers) {
        //     window.diffMarkers.forEach((m) => m.clear());
        //     window.diffMarkers = [];
        // }
        
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
  // remove old delete-buttons
  document.querySelectorAll('.line-delete-btn').forEach(b => b.remove());

  const wrapper     = editor.getWrapperElement();
  const lineHeight  = editor.defaultTextHeight();  // e.g. 24px
  const topPadding  = parseInt(
    getComputedStyle(wrapper.querySelector('.CodeMirror-lines')).paddingTop,
    10
  );
  const iconHeight    = 16;
  const verticalNudge = (lineHeight - iconHeight) / 2;

  // track last non-empty line index
  let lastLineIndex = -1;

  for (let i = 0; i < editor.lineCount(); i++) {
    const text = editor.getLine(i).trim();
    if (!text) continue;  // skip empty lines

    lastLineIndex = i;
    // Create delete button
    const btn = document.createElement('button');
    btn.className = 'line-delete-btn';
    btn.style.top = `${topPadding + i * lineHeight + verticalNudge}px`;
    btn.addEventListener('click', () => {
      editor.replaceRange('', { line: i, ch: 0 }, { line: i + 1, ch: 0 });
      editor.refresh();
    });
    wrapper.appendChild(btn);
  }

  // Show the + button only if there's at least one non-empty line
  const addBtn = document.getElementById('addLineButton');
  if (lastLineIndex >= 0) {
    const nextLine = lastLineIndex + 1;
    addBtn.style.display = 'flex';
    addBtn.style.top = `${topPadding + nextLine * lineHeight + verticalNudge}px`;
    wrapper.appendChild(addBtn);
    // Add extra bottom padding to wrapper so + button is always visible
    wrapper.style.paddingBottom = `${lineHeight + 16}px`;
  } else {
    addBtn.style.display = 'none';
    // Remove extra bottom padding
    wrapper.style.paddingBottom = '';
  }
}
editor.on("change", addLineDeleteButtons);
editor.on("refresh", addLineDeleteButtons);
addLineDeleteButtons();

const addLineButton = document.getElementById("addLineButton");
if (addLineButton) {
    addLineButton.addEventListener("click", () => {
        const lineCount = editor.lineCount();
        if (lineCount === 1) {
            // Only domain line exists, add a blank line (no &)
            editor.replaceRange("\n", { line: 0, ch: editor.getLine(0).length });
            editor.setCursor({ line: 1, ch: 0 });
        } else {
            // Add a new line at the end, starting with &
            editor.replaceRange("\n&", { line: lineCount - 1, ch: editor.getLine(lineCount - 1).length });
            editor.setCursor({ line: lineCount, ch: 1 });
        }
        addLineDeleteButtons();
        editor.focus();
    });
}

const notesInput = document.getElementById("notesInput");
if (notesInput) {
    const autoResize = () => {
        notesInput.style.height = 'auto';
        notesInput.style.height = notesInput.scrollHeight + 'px';
    };
    notesInput.addEventListener('input', autoResize);
    // Initial resize in case of pre-filled content
    autoResize();
}