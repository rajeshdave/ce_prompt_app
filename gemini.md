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

1.  **CORS-Compliant Sync API**:
    *   To bypass standard browser CORS blocks when running on `github.io`, the app connects to a lightweight, free Google Apps Script web app proxy deployed under the owner's Google account.
    *   This API lists files inside the public folder and extracts raw document text directly, adding the necessary `Access-Control-Allow-Origin: *` headers for browser support.
    *   For local or extension-based testing, the app automatically falls back to direct HTML scraping if the API URL is omitted.
2.  **No Maintenance (No Provider APIs)**:
    *   To prevent the app from breaking when AI providers (like OpenAI, Google Gemini, Anthropic Claude, or Perplexity) update their DOM structures, the app does not interact with the providers' pages directly.
    *   Instead, it compiles the prompt and copies it to the browser's clipboard, providing a clean copy-and-paste interface.
3.  **Cross-Platform Persistent Storage & On-Demand Sync (Mobile Tab Discard Resilience)**:
    *   Mobile browsers (iOS Safari, Android Chrome) and laptop browsers with Memory Saver actively evict background tabs to conserve RAM, triggering full page reloads when returning to the tab.
    *   To prevent redundant Google Drive downloads on every tab change or refresh, the app persists parsed prompts (`ce_cached_prompts`), document metadata (`ce_cached_files`), and roles (`ce_cached_roles`) in browser `localStorage`.
    *   On startup or tab switch, data is loaded instantly from `localStorage` in <5ms with 0 network calls.
    *   A dedicated **Refresh** button in the header allows users to pull fresh Google Docs updates on-demand only when templates change in Drive, complete with live relative sync timestamps (e.g., "Synced 5m ago").
    *   Active user drafts (inputs, selected doc filters, search keywords) continue to be saved on every keystroke.
4.  **Automatic Dynamic Forms with Default Values**:
    *   Prompts loaded from Google Docs are parsed for placeholders wrapped in double curly braces (e.g. `{{project}}`, `{{weeks:4}}`, `{{days:15}}`, `{{context:default context}}`).
    *   The app dynamically creates text inputs pre-filled with specified defaults, allowing instant customization without manual editing.
5.  **Multi-Document Indexing & Filter Chips**:
    *   Fetches all Google Docs in the shared folder in parallel on startup.
    *   Replaces single dropdowns with multi-select document filter chips/checkboxes (all active by default), enabling cross-document search across all docs simultaneously.
6.  **Lightweight Header-Only Search & Keyboard Navigation**:
    *   Provides search matching strictly against prompt headers/titles (`### Header`), ensuring light, instant search performance.
    *   Full keyboard navigation with `ArrowUp` / `ArrowDown` scrolling, `Enter` to select, and `Escape` to dismiss.
    *   Includes a quick clear `✕` button directly inside the search input.
7.  **Visual Loading States & Skeleton Placeholders**:
    *   Displays animated skeleton pulse loaders and an input spinner during startup, document fetching, and prompt indexing.

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

## 🔒 Security & Configuration (Passcode-Protected Private Proxy)

To keep private Google Drive documents 100% inaccessible to unauthorized public users in an open-source/public repository:
1.  **Restricted Google Drive**: The Google Drive folder is configured with General access set to **Restricted (Private)**, completely preventing direct web access.
2.  **Private Execution via Apps Script**: The Google Apps Script proxy runs under the owner's Google account (`Execute as: Me`), allowing it to read the restricted folder.
3.  **Strict Folder Scope Guard**: The Apps Script strictly verifies that any requested `docId` is a child of the designated `PROMPT_FOLDER_ID`, preventing access to any other files in Google Drive.
4.  **Client-Side Secret Passcode**: The proxy requires an `ACCESS_KEY` parameter. Users enter this passcode once on their device; it is stored in browser `localStorage` (`ce_access_key`) and sent with requests. Strangers visiting the public repository or GitHub Pages site cannot access or fetch prompt documents without the passcode.

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
