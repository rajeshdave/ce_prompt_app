// --- DOM ELEMENTS ---
const docSelectContainer = document.getElementById("docSelectContainer");
const docSelect = document.getElementById("docSelect");
const roleSelect = document.getElementById("roleSelect");
const promptSearch = document.getElementById("promptSearch");
const searchSpinner = document.getElementById("searchSpinner");
const promptDropdown = document.getElementById("promptDropdown");
const dynamicInputsContainer = document.getElementById("dynamicInputs");
const promptBox = document.getElementById("promptBox");
const copyBtn = document.getElementById("copyBtn");
const copyBtnText = document.getElementById("copyBtnText");
const clearBtn = document.getElementById("clearBtn");
const loadingSkeleton = document.getElementById("loadingSkeleton");

// --- APPLICATION STATE ---
let allPrompts = [];
let allFiles = [];
let selectedPromptText = "";
let selectedDocId = localStorage.getItem("ce_selected_doc_id") || "all";
const folderCache = {};
const docTextCache = {};

// --- UTILITY FUNCTIONS ---

// Safely escape special characters for regex matching
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Safely escape HTML characters for safe DOM insertion
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

// Transform Google Drive viewer link or Google Docs link to direct download/export link
function getDownloadUrl(url) {
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  } else if (url.includes('docs.google.com/document/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
    }
  }
  return url;
}

// Extract Google Drive Folder ID from various URL formats
function extractFolderId(url) {
  const match = url.match(/(?:folders\/|id=)([a-zA-Z0-9_-]{25,})/);
  return match ? match[1] : null;
}

// Extract Google Docs Document ID from various URL formats
function extractDocId(url) {
  const match = url.match(/document\/d\/([a-zA-Z0-9_-]{25,})/);
  return match ? match[1] : null;
}

// --- LOADING INDICATOR HELPERS ---

function showLoading(message = "Loading prompts...") {
  if (loadingSkeleton) loadingSkeleton.style.display = 'flex';
  if (searchSpinner) searchSpinner.style.display = 'block';
  if (promptSearch) {
    promptSearch.placeholder = message;
    promptSearch.disabled = true;
  }
}

function hideLoading() {
  if (loadingSkeleton) loadingSkeleton.style.display = 'none';
  if (searchSpinner) searchSpinner.style.display = 'none';
  if (promptSearch) {
    promptSearch.placeholder = "Search prompt by title across docs...";
    promptSearch.disabled = false;
  }
}

// --- DRIVE & DOCS FETCHING ---

// Fetch list of Google Doc files from a public Google Drive folder
async function listFilesInFolder(folderId) {
  if (folderCache[folderId]) {
    return folderCache[folderId];
  }
  
  const apiUrl = window.ENV ? window.ENV.API_URL : null;
  
  if (apiUrl) {
    const url = `${apiUrl}?action=list&folderId=${folderId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch folder, status: ${response.status}`);
        return [];
      }
      const files = await response.json();
      if (files.error) {
        console.error("API returned error:", files.error);
        return [];
      }
      folderCache[folderId] = files;
      return files;
    } catch (error) {
      console.error("Error listing files in folder via API:", error);
      return [];
    }
  } else {
    const url = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch folder, status: ${response.status}`);
        return [];
      }
      const htmlText = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const aTags = doc.querySelectorAll('a');
      
      const files = [];
      const seenIds = new Set();
      
      aTags.forEach(a => {
        const href = a.getAttribute('href') || '';
        const text = a.textContent.trim();
        
        const match = href.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{25,})/);
        if (match) {
          const id = match[1];
          if (!seenIds.has(id) && text) {
            seenIds.add(id);
            files.push({ id: id, name: text });
          }
        }
      });
      
      folderCache[folderId] = files;
      return files;
    } catch (error) {
      console.error("Error listing files in folder directly:", error);
      return [];
    }
  }
}

// Fetch raw text of a single Google Doc by ID
async function fetchDocText(docId) {
  if (docTextCache[docId]) {
    return docTextCache[docId];
  }
  
  const apiUrl = window.ENV ? window.ENV.API_URL : null;
  let text = "";
  
  try {
    if (apiUrl) {
      const response = await fetch(`${apiUrl}?action=get&docId=${docId}`);
      if (response.ok) {
        text = await response.text();
      }
    } else {
      const response = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`);
      if (response.ok) {
        text = await response.text();
      }
    }
  } catch (error) {
    console.error(`Failed to fetch doc content for ID ${docId}:`, error);
  }
  
  if (text) {
    docTextCache[docId] = text;
  }
  return text;
}

// Parse text of a document into individual prompt items
function parseDocPrompts(text, docInfo = {}) {
  const prompts = [];
  let current = null;
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('###')) {
      if (current && current.prompt.trim()) {
        prompts.push(current);
      }
      current = {
        title: line.replace(/^###\s*/, '').trim(),
        prompt: '',
        docId: docInfo.id || null,
        docName: docInfo.name || null
      };
    } else if (current) {
      current.prompt += line + '\n';
    }
  }
  if (current && current.prompt.trim()) {
    prompts.push(current);
  }

  return prompts.map(p => ({ ...p, prompt: p.prompt.trim() }));
}

// --- DYNAMIC PLACEHOLDERS PARSING ---

// Parses placeholders with support for default values (e.g. {weeks:4}, {days:15}, {context:This is default context}, {project})
function parsePlaceholders(text) {
  const rawMatches = text.match(/{[^{}]+}/g) || [];
  const placeholderMap = new Map();
  
  rawMatches.forEach(match => {
    const inner = match.slice(1, -1);
    const colonIdx = inner.indexOf(':');
    const key = (colonIdx !== -1 ? inner.substring(0, colonIdx) : inner).trim();
    const defaultVal = colonIdx !== -1 ? inner.substring(colonIdx + 1).trim() : "";
    
    const keyLower = key.toLowerCase();
    if (!placeholderMap.has(keyLower)) {
      placeholderMap.set(keyLower, { key, defaultVal });
    } else if (defaultVal && !placeholderMap.get(keyLower).defaultVal) {
      // If a later placeholder specifies a default value, record it
      placeholderMap.set(keyLower, { key, defaultVal });
    }
  });
  
  return placeholderMap;
}

function updateDynamicInputs() {
  const text = selectedPromptText || "";
  const placeholderMap = parsePlaceholders(text);

  dynamicInputsContainer.innerHTML = "";
  
  if (placeholderMap.size === 0) {
    dynamicInputsContainer.style.display = "none";
    return;
  }
  
  dynamicInputsContainer.style.display = "block";

  placeholderMap.forEach(({ key, defaultVal }, keyLower) => {
    const row = document.createElement("div");
    row.className = "dynamic-input-row";

    const label = document.createElement("label");
    label.textContent = key.charAt(0).toUpperCase() + key.slice(1) + ":";
    label.title = key;

    const input = document.createElement("input");
    input.type = "text";
    input.dataset.key = key;
    input.dataset.defaultVal = defaultVal;
    
    // Check cached value vs default value
    const cachedVal = localStorage.getItem(`ce_val_${keyLower}`);
    if (cachedVal !== null) {
      input.value = cachedVal;
    } else if (defaultVal !== "") {
      input.value = defaultVal;
    } else if (keyLower === "weeks") {
      input.value = "1";
    }

    if (defaultVal) {
      input.placeholder = `Default: ${defaultVal}`;
    } else {
      input.placeholder = `Enter ${key}...`;
    }

    input.addEventListener('input', () => {
      localStorage.setItem(`ce_val_${keyLower}`, input.value);
      updateCombinedPrompt();
    });

    row.appendChild(label);
    row.appendChild(input);
    dynamicInputsContainer.appendChild(row);
  });
}

// Compute base compiled prompt before manual extra notes
function getBaseCombinedWithoutManual() {
  const selectedRole = roleSelect.value.trim();
  const selectedPrompt = selectedPromptText.trim();
  let lines = [];
  if (selectedRole) lines.push(`Act as ${selectedRole}`);
  if (selectedPrompt) lines.push(selectedPrompt);
  let combined = lines.join('\n');
  
  const inputs = dynamicInputsContainer.querySelectorAll("input");
  inputs.forEach(input => {
    const key = input.dataset.key || "";
    const defaultVal = input.dataset.defaultVal || "";
    let value = input.value.trim();

    if (key.toLowerCase() === "weeks") {
      const v = parseInt(value || defaultVal || "1", 10) || 1;
      value = v === 1 ? '1 week' : `${v} weeks`;
    } else if (value === "") {
      value = defaultVal ? defaultVal : `{${key}}`;
    }

    if (key) {
      const regex = new RegExp('\\{' + escapeRegex(key) + '(?::[^{}]*)?\\}', 'gi');
      combined = combined.replace(regex, value);
    }
  });
  
  return combined;
}

function updateCombinedPrompt() {
  const baseCombined = getBaseCombinedWithoutManual();
  const typedPrompt = promptBox.dataset.customText || "";

  let combined = baseCombined;
  if (typedPrompt) {
    combined = combined ? `${combined}\n${typedPrompt}` : typedPrompt;
  }

  promptBox.value = combined;
}

// --- COMBOBOX RENDERING & SEARCH (HEADER-ONLY & MULTI-DOC) ---

function filterAndRenderPrompts(query = "") {
  const currentDocFilter = (docSelectContainer.style.display !== 'none') ? docSelect.value : 'all';
  let pool = allPrompts;
  
  if (currentDocFilter && currentDocFilter !== 'all') {
    pool = allPrompts.filter(p => p.docId === currentDocFilter);
  }
  
  const cleanQuery = query.toLowerCase().trim();
  
  // Search against JUST prompt title (header) - fast & lightweight
  const filtered = cleanQuery
    ? pool.filter(p => p.title.toLowerCase().includes(cleanQuery))
    : pool;
    
  renderComboboxOptions(filtered, cleanQuery);
}

function renderComboboxOptions(promptsToRender, query = "") {
  promptDropdown.innerHTML = '';

  // Add "-- None --" option when no search query
  if (!query) {
    const noneDiv = document.createElement('div');
    noneDiv.className = 'combobox-item';
    noneDiv.innerHTML = '<span class="combobox-item-title">-- None --</span>';
    noneDiv.addEventListener('click', () => selectPrompt("", ""));
    promptDropdown.appendChild(noneDiv);
  }

  if (promptsToRender.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'combobox-empty';
    emptyDiv.textContent = query ? `No prompt headers match "${query}"` : 'No prompts available';
    promptDropdown.appendChild(emptyDiv);
    return;
  }

  const showDocBadge = docSelectContainer.style.display !== 'none' && (docSelect.value === 'all' || !docSelect.value);

  for (const item of promptsToRender) {
    const div = document.createElement('div');
    div.className = 'combobox-item';
    if (selectedPromptText && item.prompt === selectedPromptText && item.title === promptSearch.value) {
      div.classList.add('selected');
    }

    // Highlight matching query text in prompt header
    let titleHtml = escapeHtml(item.title);
    if (query) {
      const reg = new RegExp(`(${escapeRegex(query)})`, 'gi');
      titleHtml = titleHtml.replace(reg, '<mark class="search-highlight">$1</mark>');
    }

    let badgeHtml = '';
    if (showDocBadge && item.docName) {
      badgeHtml = `<span class="combobox-item-badge" title="Source Doc: ${escapeHtml(item.docName)}">📄 ${escapeHtml(item.docName)}</span>`;
    }

    div.innerHTML = `<span class="combobox-item-title">${titleHtml}</span>${badgeHtml}`;
    div.title = item.prompt; // Show full prompt on desktop hover

    div.addEventListener('click', () => selectPrompt(item.title, item.prompt, item.docId));
    promptDropdown.appendChild(div);
  }
}

function selectPrompt(title, prompt, docId = null) {
  promptSearch.value = title;
  selectedPromptText = prompt;
  promptDropdown.style.display = 'none';
  
  updateDynamicInputs();
  updateCombinedPrompt();
  
  // Persist selections
  localStorage.setItem("ce_selected_prompt_title", title);
  localStorage.setItem("ce_selected_prompt_text", prompt);
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
  showLoading("Loading prompts from Google Drive...");

  // 1. Load roles from Roles.txt
  try {
    const res = await fetch('Roles.txt');
    if (res.ok) {
      const text = await res.text();
      const roles = text.split('\n').map(l => l.trim()).filter(l => l);
      roles.forEach(role => {
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = role;
        roleSelect.appendChild(opt);
      });
      
      // Restore cached role selection
      const cachedRole = localStorage.getItem("ce_selected_role");
      if (cachedRole && roles.includes(cachedRole)) {
        roleSelect.value = cachedRole;
      }
    }
  } catch (err) {
    console.error("Error loading Roles.txt", err);
  }

  // 2. Load prompts from Google Drive Folder URL (or single doc URL)
  const folderUrl = window.ENV ? window.ENV.FOLDER_URL : null;
  if (folderUrl) {
    try {
      const folderId = extractFolderId(folderUrl);
      
      if (folderId && (folderUrl.includes('drive.google.com/drive/folders/') || folderUrl.includes('drive.google.com/drive/u/') || folderUrl.includes('embeddedfolderview'))) {
        // Multi-doc folder
        allFiles = await listFilesInFolder(folderId);
        
        if (allFiles && allFiles.length > 0) {
          // Setup Doc Source selector
          docSelectContainer.style.display = 'flex';
          docSelect.innerHTML = '';
          
          const allOpt = document.createElement('option');
          allOpt.value = 'all';
          allOpt.textContent = `📁 All Documents (${allFiles.length} files)`;
          docSelect.appendChild(allOpt);
          
          allFiles.forEach(file => {
            const opt = document.createElement('option');
            opt.value = file.id;
            opt.textContent = `📄 ${file.name}`;
            docSelect.appendChild(opt);
          });
          
          // Restore selected doc if valid
          if (selectedDocId && (selectedDocId === 'all' || allFiles.some(f => f.id === selectedDocId))) {
            docSelect.value = selectedDocId;
          } else {
            docSelect.value = 'all';
            selectedDocId = 'all';
            localStorage.setItem("ce_selected_doc_id", 'all');
          }
          
          // Fetch all docs in parallel for instant cross-file search
          const docPromises = allFiles.map(async (file) => {
            const docText = await fetchDocText(file.id);
            return parseDocPrompts(docText, file);
          });
          
          const parsedResults = await Promise.all(docPromises);
          allPrompts = parsedResults.flat();
        } else {
          console.warn(`No Google Doc files found in the folder: ${folderUrl}`);
        }
      } else {
        // Single Document URL fallback
        const docId = extractDocId(folderUrl);
        let singleText = "";
        if (docId) {
          singleText = await fetchDocText(docId);
        } else {
          const fetchUrl = getDownloadUrl(folderUrl);
          const res = await fetch(fetchUrl);
          if (res.ok) singleText = await res.text();
        }
        if (singleText) {
          allPrompts = parseDocPrompts(singleText, { id: docId || "single", name: "Main Document" });
        }
      }
      
      filterAndRenderPrompts();
      
      // Restore cached prompt selection if available
      const cachedTitle = localStorage.getItem("ce_selected_prompt_title");
      const cachedText = localStorage.getItem("ce_selected_prompt_text");
      if (cachedTitle && cachedText && allPrompts.some(p => p.title === cachedTitle)) {
        const found = allPrompts.find(p => p.title === cachedTitle);
        selectPrompt(found.title, found.prompt, found.docId);
      }
    } catch (err) {
      console.error("Error fetching prompts from Google Drive:", err);
    } finally {
      hideLoading();
    }
  } else {
    hideLoading();
    console.error("No Google Drive folder URL found in window.ENV. Make sure env.js is properly created or loaded.");
  }
});

// --- UI EVENT LISTENERS ---

roleSelect.addEventListener('change', () => {
  localStorage.setItem("ce_selected_role", roleSelect.value);
  updateCombinedPrompt();
});

docSelect.addEventListener('change', () => {
  selectedDocId = docSelect.value;
  localStorage.setItem("ce_selected_doc_id", selectedDocId);
  filterAndRenderPrompts(promptSearch.value);
});

promptSearch.addEventListener('input', () => {
  filterAndRenderPrompts(promptSearch.value);
  promptDropdown.style.display = 'block';
});

promptSearch.addEventListener('focus', () => {
  if (allPrompts.length > 0) {
    filterAndRenderPrompts(promptSearch.value);
    promptDropdown.style.display = 'block';
  }
});

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.combobox-container')) {
    promptDropdown.style.display = 'none';
  }
});

// Manual text area edits should be preserved
promptBox.addEventListener('input', () => {
  const baseCombined = getBaseCombinedWithoutManual();
  const currentVal = promptBox.value;
  
  if (currentVal.startsWith(baseCombined)) {
    // Save any manual text appended at the end
    const manualAppended = currentVal.substring(baseCombined.length).trim();
    promptBox.dataset.customText = manualAppended;
  } else {
    // Save full manual modification
    promptBox.dataset.customText = currentVal;
  }
});

// Copy Action
copyBtn.addEventListener("click", async () => {
  const promptText = promptBox.value.trim();
  if (!promptText) {
    alert("Please select or compose a prompt first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(promptText);
    
    // Visual success transition
    copyBtn.classList.add("copied");
    const originalText = copyBtnText.textContent;
    copyBtnText.textContent = "Copied! ✓";
    
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtnText.textContent = originalText;
    }, 1500);
  } catch (err) {
    console.error("Failed to copy text: ", err);
    alert("Could not copy to clipboard automatically. Please select the text and copy manually.");
  }
});

// Clear Action
clearBtn.addEventListener("click", () => {
  promptSearch.value = "";
  selectedPromptText = "";
  promptBox.value = "";
  promptBox.dataset.customText = "";
  
  // Clear placeholder values in localStorage
  const inputs = dynamicInputsContainer.querySelectorAll("input");
  inputs.forEach(input => {
    const key = input.dataset.key || "";
    if (key) {
      localStorage.removeItem(`ce_val_${key.toLowerCase()}`);
    }
  });
  
  localStorage.removeItem("ce_selected_prompt_title");
  localStorage.removeItem("ce_selected_prompt_text");
  
  filterAndRenderPrompts();
  updateDynamicInputs();
  updateCombinedPrompt();
});
