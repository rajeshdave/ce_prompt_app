# CE Prompt Hub (Web App)

CE Prompt Hub is a responsive, mobile-first static web application that lets you browse, compose, customize, and copy prompt templates from your Google Drive folder. 

Designed for quick mobile and desktop access, it operates entirely in the browser and is built for free, secure hosting on **GitHub Pages**.

---

## 🚀 Key Features

* **Doc Folder Syncing**: Automatically reads all prompt Google Docs inside a shared Google Drive folder.
* **Doc Selection Dropdown**: Switch between backup docs (e.g. main prompts, GPT backups, Gems) on the fly.
* **Role/Persona Selection**: Prepend agent instructions dynamically from `Roles.txt`.
* **Dynamic Placeholders**: Automatically parses parameters like `{weeks}` or `{project}` inside templates and displays touch-friendly inputs.
* **One-Click Copy**: Renders a large button to compile and copy the final formatted prompt directly to your clipboard.
* **No Maintenance**: Purely static layout with no third-party libraries or API configurations to maintain.
* **Local Caching**: Remembers your selected role, document, active prompt, and inputs using browser `localStorage` in case of accidental refreshes or app switches on mobile.

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

### Step 1: Create & Deploy the Apps Script
1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Replace all the code in `Code.gs` with the following:
   ```javascript
   function doGet(e) {
     var action = e.parameter.action;
     
     if (action === "list") {
       var folderId = e.parameter.folderId;
       if (!folderId) return createJsonResponse({ error: "Missing folderId" });
       try {
         var folder = DriveApp.getFolderById(folderId);
         var files = folder.getFiles();
         var result = [];
         while (files.hasNext()) {
           var file = files.next();
           if (file.getMimeType() === "application/vnd.google-apps.document") {
             result.push({ id: file.getId(), name: file.getName() });
           }
         }
         result.sort((a, b) => a.name.localeCompare(b.name));
         return createJsonResponse(result);
       } catch (err) {
         return createJsonResponse({ error: err.toString() });
       }
     }
     
     if (action === "get") {
       var docId = e.parameter.docId;
       if (!docId) return createJsonResponse({ error: "Missing docId" });
       try {
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
   * **Who has access**: **Anyone** *(This is essential to allow CORS fetches from your GitHub Pages URL)*
7. Click **Deploy**. Authorize permissions when prompted.
8. Copy the **Web App URL** generated (it will look like `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 2: Configure GitHub Secrets & Deploy
1. Push this codebase to your public GitHub repository.
2. In your repository on GitHub, navigate to **Settings** -> **Secrets and variables** -> **Actions**.
3. Create two **Repository Secrets**:
   * **Secret 1**:
     * **Name**: `PROMPT_FOLDER_URL`
     * **Value**: `https://drive.google.com/drive/folders/1BuXKld5F82Z54qBNwMtIOLk_30lRAUSI?usp=sharing` (Your folder link)
   * **Secret 2**:
     * **Name**: `SCRIPT_API_URL`
     * **Value**: `https://script.google.com/macros/s/.../exec` (The Web App URL you copied in Step 1)
4. Push any change to your `main` or `master` branch to trigger a deploy. The action will build `env.js` using both secrets and deploy to `gh-pages`.
5. Under **Settings** -> **Pages**, make sure **Build and deployment** is set to pull from the **`gh-pages`** branch (root folder).

Your app will be live and loading prompts correctly at `https://<your-username>.github.io/ce_prompt_app/`!
