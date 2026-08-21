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

## 📦 Deployment on GitHub Pages

This project is set up with **GitHub Actions** to automate building and deploying to GitHub Pages while keeping your Google Drive folder URL private.

### Steps to Deploy:

1. **Create a Public GitHub Repository** and push this codebase to it.
2. **Configure your Secret URL**:
   * Navigate to your repository settings page: **Settings** -> **Secrets and variables** -> **Actions**.
   * Click **New repository secret**.
   * Name: `PROMPT_FOLDER_URL`.
   * Value: `https://drive.google.com/drive/folders/1BuXKld5F82Z54qBNwMtIOLk_30lRAUSI?usp=sharing` (or your folder URL).
   * Click **Add secret**.
3. **Trigger Deploy**:
   * Any push to the `main` or `master` branch will trigger the workflow inside `.github/workflows/deploy.yml`.
   * The workflow will construct `env.js` with your secret URL, build the site, and push the static files to the `gh-pages` branch.
4. **Enable Pages in GitHub Settings**:
   * Navigate to **Settings** -> **Pages**.
   * Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
   * Select **`gh-pages`** as the branch and **`/ (root)`** as the folder, then click **Save**.
   * After a minute, your app will be live at `https://<your-username>.github.io/<your-repo-name>/`!
