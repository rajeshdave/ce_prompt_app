// --- DOM ELEMENTS ---
const docSelectContainer = document.getElementById("docSelectContainer");
const docCheckboxes = document.getElementById("docCheckboxes");
const roleSelect = document.getElementById("roleSelect");
const promptSearch = document.getElementById("promptSearch");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchSpinner = document.getElementById("searchSpinner");
const promptDropdown = document.getElementById("promptDropdown");
const dynamicInputsContainer = document.getElementById("dynamicInputs");
const promptBox = document.getElementById("promptBox");
const copyBtn = document.getElementById("copyBtn");
const copyBtnText = document.getElementById("copyBtnText");
const clearBtn = document.getElementById("clearBtn");
const loadingSkeleton = document.getElementById("loadingSkeleton");
const keyBtn = document.getElementById("keyBtn");
const keyBtnText = document.getElementById("keyBtnText");
const refreshBtn = document.getElementById("refreshBtn");
const refreshBtnText = document.getElementById("refreshBtnText");
const syncStatus = document.getElementById("syncStatus");

// --- APPLICATION STATE ---
let allPrompts = [];
let allFiles = [];
let selectedDocIds = new Set();
let selectedPromptText = "";
let highlightedIndex = -1;
let isRefreshing = false;
const folderCache = {};
const docTextCache = {};

// --- LOCAL STORAGE HELPERS (CROSS-PLATFORM SAFE) ---
function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[Storage] Failed to read ${key}:`, err);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[Storage] Failed to write ${key}:`, err);
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[Storage] Failed to remove ${key}:`, err);
  }
}

// --- ACCESS PASSCODE HELPERS ---
function getAccessKey() {
  return safeStorageGet("ce_access_key") || "";
}

function setAccessKey(key) {
  if (key && key.trim()) {
    safeStorageSet("ce_access_key", key.trim());
    updateKeyBtnDisplay(true);
    return true;
  } else {
    safeStorageRemove("ce_access_key");
    updateKeyBtnDisplay(false);
    return false;
  }
}

function updateKeyBtnDisplay(isSet) {
  if (!keyBtn) return;
  const hasKey = isSet !== undefined ? isSet : !!getAccessKey();
  if (hasKey) {
    keyBtn.classList.add("configured");
    keyBtn.title = "Passcode configured (click to change or clear)";
    if (keyBtnText) keyBtnText.textContent = "Passcode ✓";
  } else {
    keyBtn.classList.remove("configured");
    keyBtn.title = "Configure Secret Access Passcode";
    if (keyBtnText) keyBtnText.textContent = "Set Passcode";
  }
}

function promptForAccessKey(message = "Enter your secret Access Passcode to load private Google Docs:") {
  const current = getAccessKey();
  const input = window.prompt(message, current);
  if (input !== null) {
    setAccessKey(input.trim());
    return input.trim();
  }
  return null;
}

// Format relative sync time for status display
function formatSyncTime(timestamp) {
  if (!timestamp) return "";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Synced just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Synced ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Synced ${diffHr}h ago`;
  const d = new Date(timestamp);
  return `Synced on ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

// Update the sync status text in header
function updateSyncStatusDisplay(timestamp = null) {
  if (!syncStatus) return;
  const ts = timestamp || Number(safeStorageGet("ce_cache_timestamp")) || null;
  if (!ts) {
    syncStatus.textContent = "";
    syncStatus.title = "";
    return;
  }
  syncStatus.textContent = formatSyncTime(ts);
  const fullDate = new Date(ts).toLocaleString();
  syncStatus.title = `Last synced with Google Drive: ${fullDate}`;
}

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
  if (clearSearchBtn) clearSearchBtn.style.display = 'none';
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
    updateClearSearchBtnVisibility();
  }
}

function updateClearSearchBtnVisibility() {
  if (!clearSearchBtn || !promptSearch) return;
  if (searchSpinner && searchSpinner.style.display !== 'none') {
    clearSearchBtn.style.display = 'none';
  } else {
    clearSearchBtn.style.display = promptSearch.value.trim() ? 'flex' : 'none';
  }
}

// --- DRIVE & DOCS FETCHING ---

// Fetch list of Google Doc files from a Google Drive folder
async function listFilesInFolder(folderId) {
  if (folderCache[folderId]) {
    return folderCache[folderId];
  }
  
  const apiUrl = window.ENV ? window.ENV.API_URL : null;
  
  if (apiUrl) {
    let accessKey = getAccessKey();
    let url = `${apiUrl}?action=list&folderId=${folderId}${accessKey ? `&key=${encodeURIComponent(accessKey)}` : ''}`;
    try {
      let response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch folder, status: ${response.status}`);
        return [];
      }
      let files = await response.json();
      
      // If unauthorized, prompt for access key and retry once
      if (files && files.error && files.error.toLowerCase().includes("unauthorized")) {
        console.warn("Access key missing or invalid, prompting user...");
        const newKey = promptForAccessKey("Unauthorized: Please enter your Secret Access Passcode to load prompts:");
        if (newKey) {
          url = `${apiUrl}?action=list&folderId=${folderId}&key=${encodeURIComponent(newKey)}`;
          response = await fetch(url);
          if (response.ok) {
            files = await response.json();
          }
        }
      }

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
      const accessKey = getAccessKey();
      const url = `${apiUrl}?action=get&docId=${docId}${accessKey ? `&key=${encodeURIComponent(accessKey)}` : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        text = await response.text();
        if (text.startsWith("{") && text.includes('"error"') && text.toLowerCase().includes("unauthorized")) {
          console.warn(`Doc ${docId} returned unauthorized error.`);
          text = "";
        }
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

// --- DOC SOURCE CHECKBOXES RENDERING ---

function renderDocCheckboxes() {
  if (!docCheckboxes) return;
  docCheckboxes.innerHTML = '';
  
  if (allFiles.length <= 1) {
    if (docSelectContainer) docSelectContainer.style.display = 'none';
    return;
  }
  
  if (docSelectContainer) docSelectContainer.style.display = 'flex';

  // 1. "All Documents" Checkbox Chip
  const allChip = document.createElement('label');
  allChip.className = `doc-chip ${selectedDocIds.has('all') ? 'active' : ''}`;
  allChip.innerHTML = `
    <input type="checkbox" value="all" ${selectedDocIds.has('all') ? 'checked' : ''}>
    <span>📁 All (${allFiles.length})</span>
  `;
  
  allChip.querySelector('input').addEventListener('change', (e) => {
    if (e.target.checked) {
      allFiles.forEach(f => selectedDocIds.add(f.id));
      selectedDocIds.add('all');
    } else {
      selectedDocIds.clear();
    }
    persistAndRefreshDocSelection();
  });
  docCheckboxes.appendChild(allChip);

  // 2. Individual Document Checkbox Chips
  allFiles.forEach(file => {
    const isChecked = selectedDocIds.has(file.id);
    const chip = document.createElement('label');
    chip.className = `doc-chip ${isChecked ? 'active' : ''}`;
    chip.title = file.name;
    chip.innerHTML = `
      <input type="checkbox" value="${escapeHtml(file.id)}" ${isChecked ? 'checked' : ''}>
      <span>📄 ${escapeHtml(file.name)}</span>
    `;

    chip.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedDocIds.add(file.id);
        const allIndividualSelected = allFiles.every(f => selectedDocIds.has(f.id));
        if (allIndividualSelected) selectedDocIds.add('all');
      } else {
        selectedDocIds.delete(file.id);
        selectedDocIds.delete('all');
      }
      persistAndRefreshDocSelection();
    });
    docCheckboxes.appendChild(chip);
  });
}

function persistAndRefreshDocSelection() {
  safeStorageSet("ce_selected_doc_ids", JSON.stringify(Array.from(selectedDocIds)));
  renderDocCheckboxes();
  filterAndRenderPrompts(promptSearch.value);
}

// --- DYNAMIC PLACEHOLDERS PARSING ---

// Parses placeholders with support for default values (e.g. {{weeks:4}}, {{days:15}}, {{context:This is default context}}, {{project}})
function parsePlaceholders(text) {
  const rawMatches = text.match(/{{[^{}]+}}/g) || [];
  const placeholderMap = new Map();
  
  rawMatches.forEach(match => {
    const inner = match.slice(2, -2);
    const colonIdx = inner.indexOf(':');
    const key = (colonIdx !== -1 ? inner.substring(0, colonIdx) : inner).trim();
    const defaultVal = colonIdx !== -1 ? inner.substring(colonIdx + 1).trim() : "";
    
    if (!key) return;
    const keyLower = key.toLowerCase();
    if (!placeholderMap.has(keyLower)) {
      placeholderMap.set(keyLower, { key, defaultVal });
    } else if (defaultVal && !placeholderMap.get(keyLower).defaultVal) {
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
    const cachedVal = safeStorageGet(`ce_val_${keyLower}`);
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
      safeStorageSet(`ce_val_${keyLower}`, input.value);
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
      value = defaultVal ? defaultVal : `{{${key}}}`;
    }

    if (key) {
      const regex = new RegExp('\\{\\{\\s*' + escapeRegex(key) + '(?:\\s*:[^{}]*)?\\s*\\}\\}', 'gi');
      combined = combined.replace(regex, () => value);
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
  let pool = allPrompts;
  
  // Filter by selected document checkboxes
  if (allFiles.length > 1 && selectedDocIds.size > 0 && !selectedDocIds.has('all')) {
    pool = allPrompts.filter(p => selectedDocIds.has(p.docId));
  } else if (allFiles.length > 1 && selectedDocIds.size === 0) {
    pool = []; // No docs selected
  }
  
  const cleanQuery = query.toLowerCase().trim();
  
  // Search against JUST prompt title (header) - fast & lightweight
  const filtered = cleanQuery
    ? pool.filter(p => p.title.toLowerCase().includes(cleanQuery))
    : pool;
    
  highlightedIndex = -1;
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
    if (selectedDocIds.size === 0 && allFiles.length > 1) {
      emptyDiv.textContent = 'Please check at least one Doc Source above';
    } else {
      emptyDiv.textContent = query ? `No prompt headers match "${query}"` : 'No prompts available';
    }
    promptDropdown.appendChild(emptyDiv);
    return;
  }

  const showDocBadge = allFiles.length > 1;

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
  highlightedIndex = -1;
  updateClearSearchBtnVisibility();
  
  updateDynamicInputs();
  updateCombinedPrompt();
  
  // Persist selections
  safeStorageSet("ce_selected_prompt_title", title);
  safeStorageSet("ce_selected_prompt_text", prompt);
}

function updateHighlightedItem(items) {
  items.forEach((item, idx) => {
    if (idx === highlightedIndex) {
      item.classList.add('highlighted');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('highlighted');
    }
  });
}

// --- ROLES LOADING & CACHING ---

function populateRoles(roles) {
  if (!roleSelect) return;
  roleSelect.innerHTML = '<option value="">-- None --</option>';
  roles.forEach(role => {
    const opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role;
    roleSelect.appendChild(opt);
  });
  
  // Restore cached role selection
  const cachedRole = safeStorageGet("ce_selected_role");
  if (cachedRole && roles.includes(cachedRole)) {
    roleSelect.value = cachedRole;
  }
}

async function loadRoles(forceRefresh = false) {
  if (!forceRefresh) {
    const cachedRolesJson = safeStorageGet("ce_cached_roles");
    if (cachedRolesJson) {
      try {
        const roles = JSON.parse(cachedRolesJson);
        if (Array.isArray(roles) && roles.length > 0) {
          populateRoles(roles);
          return;
        }
      } catch (e) {
        console.warn("Error parsing cached roles:", e);
      }
    }
  }

  try {
    const res = await fetch('Roles.txt');
    if (res.ok) {
      const text = await res.text();
      const roles = text.split('\n').map(l => l.trim()).filter(l => l);
      safeStorageSet("ce_cached_roles", JSON.stringify(roles));
      populateRoles(roles);
    }
  } catch (err) {
    console.error("Error loading Roles.txt", err);
  }
}

// --- PROMPTS LOADING & CACHING ---

async function loadPrompts(forceRefresh = false) {
  const folderUrl = window.ENV ? window.ENV.FOLDER_URL : null;
  if (!folderUrl) {
    hideLoading();
    console.error("No Google Drive folder URL found in window.ENV. Make sure env.js is properly created or loaded.");
    return false;
  }

  const folderId = extractFolderId(folderUrl);

  // 1. Try restoring from local cache (instant offline load across iOS/Android/Laptops)
  if (!forceRefresh) {
    const cachedPromptsJson = safeStorageGet("ce_cached_prompts");
    const cachedFilesJson = safeStorageGet("ce_cached_files");
    const cachedFolderId = safeStorageGet("ce_cache_folder_id");
    const cachedTimestamp = safeStorageGet("ce_cache_timestamp");

    if (cachedPromptsJson && cachedFilesJson && cachedFolderId === folderId) {
      try {
        const parsedPrompts = JSON.parse(cachedPromptsJson);
        const parsedFiles = JSON.parse(cachedFilesJson);

        if (Array.isArray(parsedPrompts) && parsedPrompts.length > 0) {
          allFiles = parsedFiles;
          allPrompts = parsedPrompts;

          // Restore saved checkbox preferences or default ALL to selected
          const savedDocsJson = safeStorageGet("ce_selected_doc_ids");
          if (savedDocsJson) {
            try {
              const parsed = JSON.parse(savedDocsJson);
              selectedDocIds = new Set(parsed.filter(id => id === 'all' || allFiles.some(f => f.id === id)));
            } catch (e) {
              selectedDocIds = new Set();
            }
          }
          if (selectedDocIds.size === 0) {
            selectedDocIds = new Set(allFiles.map(f => f.id));
            selectedDocIds.add('all');
          }

          renderDocCheckboxes();
          filterAndRenderPrompts(promptSearch ? promptSearch.value : "");

          // Restore cached prompt selection if available
          const cachedTitle = safeStorageGet("ce_selected_prompt_title");
          const cachedText = safeStorageGet("ce_selected_prompt_text");
          if (cachedTitle && cachedText && allPrompts.some(p => p.title === cachedTitle)) {
            const found = allPrompts.find(p => p.title === cachedTitle);
            selectPrompt(found.title, found.prompt, found.docId);
          }

          updateSyncStatusDisplay(Number(cachedTimestamp));
          return true;
        }
      } catch (err) {
        console.warn("Failed to parse cached prompts, falling back to network fetch:", err);
      }
    }
  }

  // 2. Fetch fresh prompts from Google Drive (first load or explicit refresh)
  if (!forceRefresh) {
    showLoading("Loading prompts from Google Drive...");
  } else {
    // Clear in-memory caches to guarantee fresh response
    for (const k in folderCache) delete folderCache[k];
    for (const k in docTextCache) delete docTextCache[k];
  }

  try {
    let freshFiles = [];
    let freshPrompts = [];

    if (folderId && (folderUrl.includes('drive.google.com/drive/folders/') || folderUrl.includes('drive.google.com/drive/u/') || folderUrl.includes('embeddedfolderview'))) {
      freshFiles = await listFilesInFolder(folderId);

      if (freshFiles && freshFiles.length > 0) {
        // Fetch all docs in parallel for instant cross-file search
        const docPromises = freshFiles.map(async (file) => {
          const docText = await fetchDocText(file.id);
          return parseDocPrompts(docText, file);
        });

        const parsedResults = await Promise.all(docPromises);
        freshPrompts = parsedResults.flat();
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
        freshFiles = [{ id: docId || "single", name: "Main Document" }];
        freshPrompts = parseDocPrompts(singleText, freshFiles[0]);
      }
    }

    if (freshPrompts && freshPrompts.length > 0) {
      allFiles = freshFiles;
      allPrompts = freshPrompts;

      // Save to persistent storage for iOS/Android/Laptop caching
      const now = Date.now();
      safeStorageSet("ce_cached_files", JSON.stringify(allFiles));
      safeStorageSet("ce_cached_prompts", JSON.stringify(allPrompts));
      safeStorageSet("ce_cache_folder_id", folderId);
      safeStorageSet("ce_cache_timestamp", now.toString());

      // Restore saved checkbox preferences or default ALL to selected
      const savedDocsJson = safeStorageGet("ce_selected_doc_ids");
      if (savedDocsJson) {
        try {
          const parsed = JSON.parse(savedDocsJson);
          selectedDocIds = new Set(parsed.filter(id => id === 'all' || allFiles.some(f => f.id === id)));
        } catch (e) {
          selectedDocIds = new Set();
        }
      }
      if (selectedDocIds.size === 0) {
        selectedDocIds = new Set(allFiles.map(f => f.id));
        selectedDocIds.add('all');
      }

      renderDocCheckboxes();
      filterAndRenderPrompts(promptSearch ? promptSearch.value : "");

      // Restore cached prompt selection if available
      const cachedTitle = safeStorageGet("ce_selected_prompt_title");
      const cachedText = safeStorageGet("ce_selected_prompt_text");
      if (cachedTitle && cachedText && allPrompts.some(p => p.title === cachedTitle)) {
        const found = allPrompts.find(p => p.title === cachedTitle);
        selectPrompt(found.title, found.prompt, found.docId);
      }

      updateSyncStatusDisplay(now);
      return true;
    } else {
      console.warn("No prompts parsed from Google Drive.");
      return false;
    }
  } catch (err) {
    console.error("Error fetching prompts from Google Drive:", err);
    return false;
  } finally {
    hideLoading();
  }
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
  updateKeyBtnDisplay();
  await loadRoles(false);
  await loadPrompts(false);
});

// Update the relative sync timestamp when switching back to tab
window.addEventListener('focus', () => {
  updateSyncStatusDisplay();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateSyncStatusDisplay();
  }
});

// --- UI EVENT LISTENERS ---

// Secret Access Passcode Button Action
if (keyBtn) {
  keyBtn.addEventListener('click', async () => {
    const entered = promptForAccessKey("Enter your Secret Access Passcode (leave blank to clear):");
    if (entered !== null) {
      if (refreshBtn) refreshBtn.click();
    }
  });
}

// Manual Refresh Button Action
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    if (isRefreshing) return;
    isRefreshing = true;

    refreshBtn.classList.add('loading');
    if (refreshBtnText) refreshBtnText.textContent = "Syncing...";

    try {
      await loadRoles(true);
      const success = await loadPrompts(true);

      refreshBtn.classList.remove('loading');
      if (success) {
        refreshBtn.classList.add('success');
        if (refreshBtnText) refreshBtnText.textContent = "Synced! ✓";
        setTimeout(() => {
          refreshBtn.classList.remove('success');
          if (refreshBtnText) refreshBtnText.textContent = "Refresh";
        }, 1500);
      } else {
        if (refreshBtnText) refreshBtnText.textContent = "Refresh";
        alert("Unable to reach Google Drive. Using existing cached prompts.");
      }
    } catch (err) {
      console.error("Error refreshing prompts:", err);
      refreshBtn.classList.remove('loading');
      if (refreshBtnText) refreshBtnText.textContent = "Refresh";
      alert("Error refreshing prompts from Google Drive. Your cached prompts were kept.");
    } finally {
      isRefreshing = false;
    }
  });
}

roleSelect.addEventListener('change', () => {
  safeStorageSet("ce_selected_role", roleSelect.value);
  updateCombinedPrompt();
});

promptSearch.addEventListener('input', () => {
  updateClearSearchBtnVisibility();
  filterAndRenderPrompts(promptSearch.value);
  promptDropdown.style.display = 'block';
});

promptSearch.addEventListener('focus', () => {
  if (allPrompts.length > 0) {
    filterAndRenderPrompts(promptSearch.value);
    promptDropdown.style.display = 'block';
  }
});

// Arrow Keys & Enter Navigation for Combobox
promptSearch.addEventListener('keydown', (e) => {
  const items = promptDropdown.querySelectorAll('.combobox-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (promptDropdown.style.display === 'none') {
      promptDropdown.style.display = 'block';
      highlightedIndex = 0;
    } else {
      highlightedIndex = (highlightedIndex + 1) % items.length;
    }
    updateHighlightedItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (promptDropdown.style.display === 'none') {
      promptDropdown.style.display = 'block';
      highlightedIndex = items.length - 1;
    } else {
      highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
    }
    updateHighlightedItem(items);
  } else if (e.key === 'Enter') {
    if (promptDropdown.style.display !== 'none' && highlightedIndex >= 0 && highlightedIndex < items.length) {
      e.preventDefault();
      items[highlightedIndex].click();
    }
  } else if (e.key === 'Escape') {
    promptDropdown.style.display = 'none';
    highlightedIndex = -1;
  }
});

// Clear Search '✕' Button
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    promptSearch.value = "";
    selectedPromptText = "";
    promptBox.value = "";
    promptBox.dataset.customText = "";
    
    // Clear placeholder values
    const inputs = dynamicInputsContainer.querySelectorAll("input");
    inputs.forEach(input => {
      const key = input.dataset.key || "";
      if (key) {
        safeStorageRemove(`ce_val_${key.toLowerCase()}`);
      }
    });
    
    safeStorageRemove("ce_selected_prompt_title");
    safeStorageRemove("ce_selected_prompt_text");
    
    updateClearSearchBtnVisibility();
    filterAndRenderPrompts("");
    updateDynamicInputs();
    updateCombinedPrompt();
    promptSearch.focus();
    promptDropdown.style.display = 'block';
  });
}

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.combobox-container')) {
    promptDropdown.style.display = 'none';
    highlightedIndex = -1;
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

// Clear All Action
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
      safeStorageRemove(`ce_val_${key.toLowerCase()}`);
    }
  });
  
  safeStorageRemove("ce_selected_prompt_title");
  safeStorageRemove("ce_selected_prompt_text");
  
  updateClearSearchBtnVisibility();
  filterAndRenderPrompts();
  updateDynamicInputs();
  updateCombinedPrompt();
});
