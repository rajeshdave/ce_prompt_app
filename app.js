// --- DOM ELEMENTS ---
const docSelectContainer = document.getElementById("docSelectContainer");
const docSelect = document.getElementById("docSelect");
const roleSelect = document.getElementById("roleSelect");
const promptSearch = document.getElementById("promptSearch");
const promptDropdown = document.getElementById("promptDropdown");
const dynamicInputsContainer = document.getElementById("dynamicInputs");
const promptBox = document.getElementById("promptBox");
const copyBtn = document.getElementById("copyBtn");
const copyBtnText = document.getElementById("copyBtnText");
const clearBtn = document.getElementById("clearBtn");

// --- APPLICATION STATE ---
let allPrompts = [];
let selectedPromptText = "";
let selectedDocId = localStorage.getItem("ce_selected_doc_id") || null;
let hasDocSelectListener = false;
const folderCache = {};

// --- UTILITY FUNCTIONS ---

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

// Fetch list of Google Doc files from a public Google Drive folder
async function listFilesInFolder(folderId) {
  if (folderCache[folderId]) {
    return folderCache[folderId];
  }
  
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
    console.error("Error listing files in folder:", error);
    return [];
  }
}

// Helper to reload all prompts when selected document changes
async function reloadAllPrompts() {
  try {
    // Hide doc select container temporarily during initial re-eval
    if (docSelectContainer) docSelectContainer.style.display = 'none';
    
    const folderUrl = window.ENV ? window.ENV.FOLDER_URL : null;
    if (folderUrl) {
      allPrompts = await parsePrompts(`##url## ${folderUrl}`);
      renderComboboxOptions(allPrompts);
    }
  } catch (err) {
    console.error("Failed to reload prompts:", err);
  }
}

// Robust prompt parsing function
async function parsePrompts(text) {
  const prompts = [];
  let current = null;
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('###')) {
      if (current && current.prompt.trim()) {
        prompts.push(current);
      }
      current = { title: line.replace(/^###\s*/, '').trim(), prompt: '' };
    } else if (line.startsWith('##url##')) {
      const url = line.replace(/^##url##\s*/, '').trim();
      if (url) {
        try {
          // If we had a current prompt, save it before fetching new ones
          if (current && current.prompt.trim()) {
            prompts.push(current);
            current = null;
          }
          
          // Check if it is a Google Drive folder link
          if (url.includes('drive.google.com/drive/folders/') || url.includes('drive.google.com/drive/u/') || url.includes('embeddedfolderview')) {
            const folderId = extractFolderId(url);
            if (folderId) {
              const files = await listFilesInFolder(folderId);
              if (files && files.length > 0) {
                if (docSelectContainer && docSelect) {
                  docSelectContainer.style.display = 'flex';
                  
                  // Clear existing options
                  docSelect.innerHTML = '';
                  
                  files.forEach((file) => {
                    const opt = document.createElement('option');
                    opt.value = file.id;
                    opt.textContent = file.name;
                    docSelect.appendChild(opt);
                  });
                  
                  // Determine which doc to fetch
                  let activeDocId = files[0].id;
                  if (selectedDocId && files.some(f => f.id === selectedDocId)) {
                    activeDocId = selectedDocId;
                  }
                  
                  docSelect.value = activeDocId;
                  localStorage.setItem("ce_selected_doc_id", activeDocId);
                  
                  const activeFileUrl = `https://docs.google.com/document/d/${activeDocId}/export?format=txt`;
                  const activeRes = await fetch(activeFileUrl);
                  if (activeRes.ok) {
                    const docText = await activeRes.text();
                    const docPrompts = await parsePrompts(docText);
                    prompts.push(...docPrompts);
                  }
                  
                  // Register listener for changes
                  if (!hasDocSelectListener) {
                    docSelect.addEventListener('change', async () => {
                      selectedDocId = docSelect.value;
                      localStorage.setItem("ce_selected_doc_id", selectedDocId);
                      await reloadAllPrompts();
                    });
                    hasDocSelectListener = true;
                  }
                }
              } else {
                console.warn(`No Google Doc files found in the folder: ${url}`);
              }
            }
          } else {
            // Standard single file URL
            const fetchUrl = getDownloadUrl(url);
            const response = await fetch(fetchUrl);
            if (response.ok) {
              const externalText = await response.text();
              const externalPrompts = await parsePrompts(externalText);
              prompts.push(...externalPrompts);
            } else {
              console.error(`Failed to fetch prompts from URL: ${url} - Status: ${response.status}`);
            }
          }
        } catch (error) {
          console.error(`Error fetching prompts from URL: ${url}`, error);
        }
      }
    } else if (current) {
      current.prompt += line + '\n';
    }
  }
  if (current && current.prompt.trim()) {
    prompts.push(current);
  }

  return prompts.map(p => ({ ...p, prompt: p.prompt.trim() }));
}

function renderComboboxOptions(promptsToRender) {
  promptDropdown.innerHTML = '';

  // Add "-- None --" option
  const noneDiv = document.createElement('div');
  noneDiv.className = 'combobox-item';
  noneDiv.textContent = '-- None --';
  noneDiv.addEventListener('click', () => selectPrompt("", ""));
  promptDropdown.appendChild(noneDiv);

  for (const { title, prompt } of promptsToRender) {
    const item = document.createElement('div');
    item.className = 'combobox-item';
    item.textContent = title;
    item.title = prompt; // Show full prompt on hover
    item.addEventListener('click', () => selectPrompt(title, prompt));
    promptDropdown.appendChild(item);
  }
}

function selectPrompt(title, prompt) {
  promptSearch.value = title;
  selectedPromptText = prompt;
  promptDropdown.style.display = 'none';
  updateDynamicInputs();
  updateCombinedPrompt();
  
  // Persist selections
  localStorage.setItem("ce_selected_prompt_title", title);
  localStorage.setItem("ce_selected_prompt_text", prompt);
}

function updateDynamicInputs() {
  const text = selectedPromptText || "";
  const placeholders = [...new Set(text.match(/{[^{}]+}/g) || [])];

  dynamicInputsContainer.innerHTML = "";
  placeholders.forEach(placeholder => {
    const key = placeholder.slice(1, -1);
    const row = document.createElement("div");
    row.className = "dynamic-input-row";

    const label = document.createElement("label");
    label.textContent = key.charAt(0).toUpperCase() + key.slice(1) + ":";

    const input = document.createElement("input");
    input.type = "text";
    input.dataset.placeholder = placeholder;
    
    // Check if we have a cached value for this placeholder
    const cachedVal = localStorage.getItem(`ce_val_${key.toLowerCase()}`);
    if (cachedVal !== null) {
      input.value = cachedVal;
    } else if (key.toLowerCase() === "weeks") {
      input.value = "1";
    }

    input.addEventListener('input', () => {
      localStorage.setItem(`ce_val_${key.toLowerCase()}`, input.value);
      updateCombinedPrompt();
    });

    row.appendChild(label);
    row.appendChild(input);
    dynamicInputsContainer.appendChild(row);
  });
}

function updateCombinedPrompt() {
  const selectedRole = roleSelect.value.trim();
  const selectedPrompt = selectedPromptText.trim();
  const typedPrompt = promptBox.dataset.customText || "";

  let lines = [];
  if (selectedRole) lines.push(`Act as ${selectedRole}`);
  if (selectedPrompt) lines.push(selectedPrompt);
  if (typedPrompt) lines.push(typedPrompt);

  let combined = lines.join('\n');

  // Replace dynamic placeholders
  const inputs = dynamicInputsContainer.querySelectorAll("input");
  inputs.forEach(input => {
    const placeholder = input.dataset.placeholder;
    let value = input.value.trim();

    if (placeholder === "{weeks}") {
      const v = parseInt(value, 10) || 1;
      value = v === 1 ? '1 week' : `${v} weeks`;
    } else if (!value) {
      value = placeholder; // Fallback to placeholder name if empty
    }

    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    combined = combined.replace(regex, value);
  });

  promptBox.value = combined;
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
  // Hide doc select container initially
  if (docSelectContainer) docSelectContainer.style.display = 'none';

  // 1. Load roles from Roles.txt
  try {
    const res = await fetch('Roles.txt');
    if (res.ok) {
      const text = await res.ok ? await res.text() : "";
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

  // 2. Load initial prompts from Google Drive Folder URL
  const folderUrl = window.ENV ? window.ENV.FOLDER_URL : null;
  if (folderUrl) {
    try {
      allPrompts = await parsePrompts(`##url## ${folderUrl}`);
      renderComboboxOptions(allPrompts);
      
      // Restore cached prompt selection if available
      const cachedTitle = localStorage.getItem("ce_selected_prompt_title");
      const cachedText = localStorage.getItem("ce_selected_prompt_text");
      if (cachedTitle && cachedText && allPrompts.some(p => p.title === cachedTitle)) {
        selectPrompt(cachedTitle, cachedText);
      }
    } catch (err) {
      console.error("Error fetching prompts folder:", err);
    }
  } else {
    console.error("No Google Drive folder URL found in window.ENV. Make sure env.js is properly created or loaded.");
  }
});

// --- UI EVENT LISTENERS ---

roleSelect.addEventListener('change', () => {
  localStorage.setItem("ce_selected_role", roleSelect.value);
  updateCombinedPrompt();
});

promptSearch.addEventListener('input', () => {
  const query = promptSearch.value.toLowerCase().trim();
  const filtered = allPrompts.filter(p =>
    p.title.toLowerCase().includes(query) ||
    p.prompt.toLowerCase().includes(query)
  );
  renderComboboxOptions(filtered);
  promptDropdown.style.display = 'block';
});

promptSearch.addEventListener('focus', () => {
  if (allPrompts.length > 0) {
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
  // Try to keep what user typed separate
  const baseCombined = getBaseCombinedWithoutManual();
  const currentVal = promptBox.value;
  
  if (currentVal.startsWith(baseCombined)) {
    // Save any manual text appended at the end
    const manualAppended = currentVal.substring(baseCombined.length).trim();
    promptBox.dataset.customText = manualAppended;
  } else {
    // If they did a major edit, save the whole edit as the custom text
    promptBox.dataset.customText = currentVal;
  }
});

function getBaseCombinedWithoutManual() {
  const selectedRole = roleSelect.value.trim();
  const selectedPrompt = selectedPromptText.trim();
  let lines = [];
  if (selectedRole) lines.push(`Act as ${selectedRole}`);
  if (selectedPrompt) lines.push(selectedPrompt);
  let combined = lines.join('\n');
  
  const inputs = dynamicInputsContainer.querySelectorAll("input");
  inputs.forEach(input => {
    const placeholder = input.dataset.placeholder;
    let value = input.value.trim();
    if (placeholder === "{weeks}") {
      const v = parseInt(value, 10) || 1;
      value = v === 1 ? '1 week' : `${v} weeks`;
    } else if (!value) {
      value = placeholder;
    }
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    combined = combined.replace(regex, value);
  });
  
  return combined;
}

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
    const placeholder = input.dataset.placeholder;
    const key = placeholder.slice(1, -1);
    localStorage.removeItem(`ce_val_${key.toLowerCase()}`);
  });
  
  localStorage.removeItem("ce_selected_prompt_title");
  localStorage.removeItem("ce_selected_prompt_text");
  
  renderComboboxOptions(allPrompts);
  updateDynamicInputs();
  updateCombinedPrompt();
});
