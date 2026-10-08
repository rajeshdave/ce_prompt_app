# CE Prompt Hub (Web App)

CE Prompt Hub is a responsive, mobile-first static web application that lets you browse, compose, customize, and copy prompt templates from your Google Drive folder. 

Designed for quick mobile and desktop access, it operates entirely in the browser and is built for free, secure hosting on **GitHub Pages**.

---

## 🚀 Key Features

* **Cross-Doc Header Search**: Lightning-fast, lightweight search across all Google Docs in your folder by prompt title/header.
* **Doc Source Filter Chips / Checkboxes**: Multi-select document filter pills with all docs selected by default for seamless cross-doc querying.
* **Keyboard Navigation**: Navigate dropdown results with `ArrowUp` / `ArrowDown`, press `Enter` to select, and `Escape` to close.
* **Quick Clear Search (`✕`)**: 1-click button inside the search box to clear filters and reset selection.
* **Loading Spinner & Skeletons**: Visual loading indicators and skeleton placeholders during startup and file indexing.
* **Dynamic Placeholders with Defaults**: Automatically parses parameters like `{{weeks:4}}`, `{{days:15}}`, `{{context:default context}}`, or `{{project}}` with pre-filled defaults and real-time editing.
* **Role/Persona Selection**: Prepend agent instructions dynamically from `Roles.txt`.
* **One-Click Copy**: Renders a large button to compile and copy the final formatted prompt directly to your clipboard.
* **No Maintenance**: Purely static layout with no third-party libraries or API configurations to maintain.
* **Instant Persistent Caching**: Caches documents and parsed prompts directly in `localStorage` across iOS, Android, and laptops/desktops, preventing unwanted downloads from Google Drive on tab switches or page reloads.
* **On-Demand Drive Sync Button**: Dedicated header "Refresh" button with live sync status timestamps, allowing you to update prompts from Google Drive only when you edit templates.

---

## 🛠️ Local Development & Running

1. **Create the Environment Config**:
   Since the repository is public and `env.js` is ignored in Git, create a file named `env.js` in the root of the project:
   ```javascript
   window.ENV = {
     FOLDER_URL: "https://drive.google.com/drive/folders/YOUR_SHARED_FOLDER_ID"
   };
   ```
2. **Launch the App**:
   Simply open `index.html` in your browser (double-click it, or use a lightweight local server like VS Code Live Server or python `http.server`).

---

## 📦 CORS & GitHub Pages Deployment

Standard web browsers restrict cross-origin requests (CORS). When your static app runs on `github.io`, it cannot directly fetch your files listing or text contents from Google Drive's private/export URLs.

To resolve this completely and securely, you can deploy a **free, personal Google Apps Script Web App** under your Google Account to act as a CORS-compliant proxy API.

### Step 1: Create & Deploy the Secure Apps Script
1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Replace all the code in `Code.gs` with the following:
   ```javascript
   // ====================================================
   // CE PROMPT APP - SECURE GOOGLE APPS SCRIPT API
   // ====================================================

   // 1. Paste your private/restricted Google Drive Folder ID:
   const PROMPT_FOLDER_ID = "YOUR_RESTRICTED_FOLDER_ID_HERE";

   // 2. Choose your own Secret Access Passcode:
   const ACCESS_KEY = "CHOOSE_YOUR_SECRET_PASSCODE_HERE";

   function doGet(e) {
     var params = e.parameter || {};
     var userKey = params.key;

     // Verify access passcode
     var validKey = PropertiesService.getScriptProperties().getProperty("ACCESS_KEY") || ACCESS_KEY;
     if (!userKey || userKey !== validKey) {
       return createJsonResponse({ error: "Unauthorized: Invalid or missing access key" });
     }

     var action = params.action;

     // Action 1: List all Google Docs inside the private folder
     if (action === "list") {
       try {
         var folder = DriveApp.getFolderById(PROMPT_FOLDER_ID);
         var files = folder.getFiles();
         var result = [];
         while (files.hasNext()) {
           var file = files.next();
           if (file.getMimeType() === "application/vnd.google-apps.document") {
             result.push({ id: file.getId(), name: file.getName() });
           }
         }
         result.sort(function(a, b) { return a.name.localeCompare(b.name); });
         return createJsonResponse(result);
       } catch (err) {
         return createJsonResponse({ error: err.toString() });
       }
     }

     // Action 2: Fetch raw text of a specific Google Doc
     if (action === "get") {
       var docId = params.docId;
       if (!docId) return createJsonResponse({ error: "Missing docId" });

       try {
         // Security guard: verify the requested doc belongs to your prompt folder
         var file = DriveApp.getFileById(docId);
         var parents = file.getParents();
         var isAllowed = false;
         while (parents.hasNext()) {
           if (parents.next().getId() === PROMPT_FOLDER_ID) {
             isAllowed = true;
             break;
           }
         }

         if (!isAllowed) {
           return createJsonResponse({ error: "Access denied: Document is not in prompt folder" });
         }

         var doc = DocumentApp.openById(docId);
         return createTextResponse(doc.getBody().getText());
       } catch (err) {
         return createJsonResponse({ error: err.toString() });
       }
     }

     return createJsonResponse({ error: "Invalid action" });
   }

   function createJsonResponse(data) {
     return ContentService.createTextOutput(JSON.stringify(data))
       .setMimeType(ContentService.MimeType.JSON);
   }

   function createTextResponse(text) {
     return ContentService.createTextOutput(text)
       .setMimeType(ContentService.MimeType.TEXT);
   }
   ```
3. Click **Save** (disk icon).
4. Click **Deploy** -> **New deployment** (top right).
5. Click the gear icon (**Select type**) and select **Web app**.
6. Fill in the deployment details:
   * **Description**: `CE Prompt App API`
   * **Execute as**: **Me (your-email@gmail.com)**
   * **Who has access**: **Anyone** *(Required to allow CORS fetches from your GitHub Pages URL)*
7. Click **Deploy**. Authorize permissions when prompted.
8. Copy the **Web App URL** generated (it will look like `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 2: Configure GitHub Secrets & Deploy
1. Push this codebase to your public GitHub repository.
2. In your repository on GitHub, navigate to **Settings** -> **Secrets and variables** -> **Actions**.
3. Create two **Repository Secrets**:
   * **Secret 1**:
     * **Name**: `PROMPT_FOLDER_URL`
     * **Value**: `https://drive.google.com/drive/folders/YOUR_RESTRICTED_FOLDER_ID` (Your folder link)
   * **Secret 2**:
     * **Name**: `SCRIPT_API_URL`
     * **Value**: `https://script.google.com/macros/s/.../exec` (The Web App URL you copied in Step 1)
4. Push any change to your `main` or `master` branch to trigger a deploy. The action will build `env.js` using both secrets and deploy to `gh-pages`.
5. Under **Settings** -> **Pages**, make sure **Build and deployment** is set to pull from the **`gh-pages`** branch (root folder).

### Step 3: Enter Passcode in App
When opening your deployed app for the first time, click the **Key (🔑)** button in the header (or enter it when prompted). Enter your secret passcode. It will be saved securely in your browser's `localStorage` and automatically sent with future sync requests!

Your app will be live and loading prompts correctly at `https://<your-username>.github.io/ce_prompt_app/`!
