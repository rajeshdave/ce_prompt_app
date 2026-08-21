# 🤖 Gemini Project Documentation: CE Prompt Hub

This project was designed and implemented by **Gemini** (using the human-friendly name of the model version) to create a lightweight, responsive web application for composing, customizing, and copying prompt templates.

---

## 📋 Project Summary

*   **Project Name**: CE Prompt Hub (Web App)
*   **Target Audience**: Multi-device users looking to manage and compose prompts on mobile & desktop browsers.
*   **Creator**: Gemini (Model: Gemini 3.5 Flash)
*   **Development Stack**: HTML5, CSS3, Vanilla ES6 JavaScript (Zero external libraries or frameworks)

---

## 🎨 Key Features & Architecture

During the design phase, the following architectural choices were made to keep the codebase clean, performant, and secure:

1.  **Direct Folder Syncing**:
    *   Unlike traditional solutions that require a Google Cloud Developer account or service keys, this app fetches public Google Drive folders using a lightweight HTML scraper targeting the `embeddedfolderview` endpoint.
    *   It extracts files matching Google Docs URLs, lists them, and populates the **Doc Source** selection dropdown automatically.
2.  **No Maintenance (No Provider APIs)**:
    *   To prevent the app from breaking when AI providers (like OpenAI, Google Gemini, Anthropic Claude, or Perplexity) update their DOM structures, the app does not interact with the providers' pages directly.
    *   Instead, it compiles the prompt and copies it to the browser's clipboard, providing a clean copy-and-paste interface.
3.  **Local Storage Caching (Mobile Resilience)**:
    *   Browsers on mobile platforms are frequently suspended when switching tasks. To ensure the user's active prompt session is not lost, the app auto-saves the active document selection, selected persona/role, search text, and dynamic placeholder values to the browser's `localStorage` on every keystroke.
4.  **Automatic Dynamic Forms**:
    *   Prompts loaded from Google Docs are parsed for placeholders wrapped in curly braces (e.g. `{project}`, `{weeks}`).
    *   The app dynamically creates text inputs in the UI for each placeholder, allowing quick custom replacements without editing the prompt template manually.

---

## 📁 File Structure

The project maintains a zero-dependency static folder structure:

*   **[index.html](file:///home/rajeshkumardave/Rajesh/codebase_other/ce_prompt_app/index.html)**: The single-page layout defining selectors, dropdowns, placeholder area, editor textbox, and clipboard action controls.
*   **[styles.css](file:///home/rajeshkumardave/Rajesh/codebase_other/ce_prompt_app/styles.css)**: Implements mobile-first layouts, form grids, custom checkboxes, and a feedback animation for copy actions.
*   **[app.js](file:///home/rajeshkumardave/Rajesh/codebase_other/ce_prompt_app/app.js)**: Runs the folder and document fetching engine, template rendering, query filtering, and clipboard integration.
*   **[Roles.txt](file:///home/rajeshkumardave/Rajesh/codebase_other/ce_prompt_app/Roles.txt)**: Defines the personas prepended to prompts (e.g., Senior Software Engineer).
*   **[env.js](file:///home/rajeshkumardave/Rajesh/codebase_other/ce_prompt_app/env.js)**: Holds the local environment config (ignored by git to keep folder secrets private).
*   **[.github/workflows/deploy.yml](file:///home/rajeshkumardave/Rajesh/codebase_other/ce_prompt_app/.github/workflows/deploy.yml)**: The automated GitHub Actions deployment script.

---

## 🔒 Security & Configuration (Git Secrets)

To secure the Google Drive URL in a public repository, the following workflow is used:
1.  **Git Ignore**: `env.js` is added to `.gitignore`. It is never pushed to the public git history.
2.  **Deployment Injection**: In GitHub Settings under **Secrets and variables > Actions**, a secret named `PROMPT_FOLDER_URL` is configured.
3.  **Compilation**: During push, the GitHub Actions runner writes the secret URL into the deployment bundle's `env.js` file, keeping the source code public while the deployed site remains functional.

---

## 🔄 Cache-Busting Workflow

To prevent mobile browsers from loading stale code or styles after you make changes:
1.  The HTML source code defines assets with a standard query string: `?v=1.0.0` (e.g. `app.js?v=1.0.0`).
2.  During deployment, the GitHub Action automatically runs a `sed` replacement:
    ```bash
    sed -i 's/?v=1.0.0/?v=${{ github.run_id }}/g' index.html
    ```
3.  This replaces the version number with the unique GitHub Run ID of the build.
4.  Every push generates a unique URL query suffix, forcing mobile browsers to fetch fresh styles and JavaScript.
