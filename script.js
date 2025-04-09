/* // Import CSS file (your existing import statement)
import './styles.css';

// Import all CSS colors from the root element into a JS object.
const computedStyle = getComputedStyle(document.documentElement);
const colors = {
  navy: computedStyle.getPropertyValue('--color-navy').trim(),
  dark: computedStyle.getPropertyValue('--color-dark').trim(),
  green: computedStyle.getPropertyValue('--color-green').trim(),
  teal: computedStyle.getPropertyValue('--color-teal').trim(),
  blue: computedStyle.getPropertyValue('--color-blue').trim(),
  lime: computedStyle.getPropertyValue('--color-lime').trim(),
  gray: computedStyle.getPropertyValue('--color-gray').trim(),
  offwhite: computedStyle.getPropertyValue('--color-offwhite').trim(),
  pink: computedStyle.getPropertyValue('--color-pink').trim(),
  red: computedStyle.getPropertyValue('--color-red').trim(),
  peach: computedStyle.getPropertyValue('--color-peach').trim(),
};
*/

// =============== Custom CodeMirror Mode ===============
CodeMirror.defineMode("urlmode", function (config, parserConfig) {
    return {
      startState: function () {
        return {
          inQuery: false,
          paramPhase: null,
          isAppsflyer: false,
        };
      },
      token: function (stream, state) {
        if (!state.isAppsflyer) {
          if (stream.string.indexOf("appsflyer") !== -1) {
            state.isAppsflyer = true;
          }
        }
        if (!state.inQuery) {
          if (stream.peek() === "?") {
            stream.next();
            state.inQuery = true;
            state.paramPhase = "key";
            return "punctuation";
          }
          if (state.isAppsflyer && stream.match(/id\d+/, true)) {
            return "appsflyer-id";
          }
          stream.next();
          return null;
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
              return "query-key";
            }
          }
          if (state.paramPhase === "operator") {
            if (stream.match("=", true)) {
              state.paramPhase = "value";
              return "operator";
            }
          }
          if (state.paramPhase === "value") {
            if (stream.match(/[^&]+/, true)) {
              return "query-value";
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
    const baseUrl = original.slice(0, questionIndex + 1);
    const query = original.slice(questionIndex + 1);
    
    let baseColored = colorizeSegmentWithDeletions(baseUrl, 0, deletedMask);
    
    // Choose the appropriate color for appsflyer id:
    // If "appsflyer" is present in the URL use green (#18c6af), otherwise use dark (#2B2E4A).
    const idColor = original.includes("appsflyer") ? "#18c6af" : "#2B2E4A";
    
    baseColored = baseColored.replace(
      /(id\d+)/,
      `<span style="color: ${idColor};">$1</span>`
    );
    
    const queryChunks = query.split("&");
    let queryHTML = "";
    let offset = baseUrl.length;
    for (let i = 0; i < queryChunks.length; i++) {
      const chunk = queryChunks[i];
      const chunkHTML = colorizeQueryParamWithDeletions(chunk, offset, deletedMask);
      if (i > 0) {
        queryHTML += `<span style="#333: black;">&amp;</span>`;
      }
      queryHTML += chunkHTML;
      offset += chunk.length + (i < queryChunks.length - 1 ? 1 : 0);
    }
    return baseColored + queryHTML;
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
      let redPart = colorizeSegmentWithDeletions(param, baseOffset, deletedMask);
      return `<span style="color: #F95A49;">${redPart}</span>`;
    } else {
      const key = param.slice(0, eqIndex);
      const val = param.slice(eqIndex + 1);
      const keyHTML = colorizeSegmentWithDeletions(key, baseOffset, deletedMask);
      const eqHTML =
        deletedMask[baseOffset + eqIndex]
          ? `<span class="deleted">=</span>`
          : "=";
      const valHTML = colorizeSegmentWithDeletions(
        val,
        baseOffset + eqIndex + 1,
        deletedMask
      );
      return `<span style="color: #F35ADC;">${keyHTML}${eqHTML}</span>` +
             `<span style="color: #5A6CF3;">${valHTML}</span>`;
    }
  }
    
  // Updated function to display URL status in one message area.
  function checkUrlMatch(original, outputDiv, messageElement) {
    const plain = outputDiv.textContent;
    // If the input doesn't start with a valid URL protocol, indicate an error.
    if (!original.startsWith("http://") && !original.startsWith("https://")) {
      messageElement.textContent = "not a URL";
      messageElement.style.color = " #F95A49";
    } else if (original === plain) {
      messageElement.textContent = "URLs match";
      messageElement.style.color = " #2DB182";
    } else {
      messageElement.textContent = "URLs mismatch";
      messageElement.style.color = " #F95A49";
    }
  }
    
  // =============== End Utilities ===============
    
  // DOM elements
  const clicksInput = document.getElementById("clicksInput");
  const clicksOutput = document.getElementById("clicksOutput");
  const clicksMessage = document.getElementById("clicksMessage");
  const sectionTitle = document.getElementById("sectionTitle");
    
  let originalInputValue = "";
    
  // Instantiate CodeMirror on the "Edit URL" textarea.
  const editor = CodeMirror.fromTextArea(document.getElementById("clicksEditor"), {
    lineNumbers: false,
    mode: "urlmode",
    lineWrapping: true,
  });
    
  // When the user types/pastes in the Input area...
  clicksInput.addEventListener("input", function () {
    originalInputValue = this.value.trim();
    const noDeletions = new Array(originalInputValue.length).fill(false);
    clicksOutput.innerHTML = colorizeWithDeletions(originalInputValue, noDeletions);
    checkUrlMatch(originalInputValue, clicksOutput, clicksMessage);
    
    // Sync CodeMirror with the Input value.
    editor.setValue(originalInputValue);
    editor.refresh();
    
    // Update Title
    updateSectionTitle(originalInputValue);
  });
    
  // In the CodeMirror editor, highlight insertions in yellow and update the Output to show deletions in red.
  editor.on("change", function (cm, change) {
    if (window.diffMarkers) {
      window.diffMarkers.forEach((m) => m.clear());
    }
    window.diffMarkers = [];
    
    const newValue = cm.getValue();
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
      // For deletions (op === -1), no action in the editor.
    });
    
    const deletedMask = createDeletedMask(originalInputValue, newValue);
    clicksOutput.innerHTML = colorizeWithDeletions(originalInputValue, deletedMask);
    checkUrlMatch(originalInputValue, clicksOutput, clicksMessage);
    editor.refresh();
  });
    
  function updateSectionTitle(raw) {
    if (raw.includes("appsflyer")) {
      if (raw.includes("impression")) {
        sectionTitle.textContent = "Impressions";
      } else {
        sectionTitle.textContent = "Clicks";
      }
    } else if (raw.includes("imp")) {
      sectionTitle.textContent = "Impressions";
    } else {
      sectionTitle.textContent = "Clicks";
    }
  }
    
  // =============== COPY BUTTON LOGIC (ADDED) ===============
    
  // 1) Copy from Input textarea
  const copyButtonInput = document.getElementById("copyButtonInput");
  const copyPopupInput = document.getElementById("copyPopupInput");
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
    
  // 3) Copy from CodeMirror Editor
  const copyButtonEditor = document.getElementById("copyButtonEditor");
  const copyPopupEditor = document.getElementById("copyPopupEditor");
  if (copyButtonEditor) {
    copyButtonEditor.addEventListener("click", () => {
      const textToCopy = editor.getValue();
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