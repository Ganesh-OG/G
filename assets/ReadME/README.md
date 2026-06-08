# Project Prompt Pages

This repo supports file-backed project pages that open in the popup and render like a document.

The new preferred setup is:

- One shared viewer: `project-view.html`
- One shared renderer: `assets/js/project-document.js`
- One shared stylesheet: `assets/CSS/project-document.css`
- One dedicated fallback page: `404.html`
- One JSON file per project

The repo is now JSON-first. The old per-project `.HTML` files have been removed.

Shared viewer assets and project JSON files live in the `assets/json/` folder.

## How It Works

1. In the admin/projects table, set `project_type` to `file`.
2. Put the project data file name in `project_file_name`.
3. If the file name ends with `.json`, the popup opens the shared viewer and loads that JSON.
4. If the file name is missing, the popup falls back to `404.html`, which centers `assets/images/404.gif`.

## The Main Flow

- The project card is clicked.
- `components/project-popup.js` opens the popup.
- The popup loads the shared viewer and passes the JSON file name to it.
- The viewer reads the project data and renders the document.

## How To Edit JSON

Each project is a single JSON file. You only change the data, not the shared viewer.

### Top-Level Fields

These fields control the document header and summary area:

- `badge`: Small label shown above the title
- `title`: Main page title
- `eyebrow`: Short section label below the title area
- `subtitle`: Small subtitle under the main title
- `summary`: Main paragraph shown near the top
- `prompt`: Optional prompt box text
- `backHref`: Link used by the back button when opened directly
- `backLabel`: Text for the back button
- `meta`: Small info cards under the summary
- `blocks`: Main content sections

Example:

```json
{
  "badge": "File-backed Prompt",
  "title": "Bulk AD User Creation",
  "eyebrow": "Automating User Provisioning in Active Directory",
  "subtitle": "A PowerShell workflow for creating multiple accounts from a CSV source.",
  "summary": "User onboarding often requires creating multiple Active Directory accounts within a short period.",
  "prompt": "Open this page to present the workflow, benefits, and script.",
  "backHref": "index.html",
  "backLabel": "Back to portfolio",
  "meta": [
    { "label": "Scenario", "value": "Active Directory onboarding" },
    { "label": "Input", "value": "CSV-driven user list" },
    { "label": "Output", "value": "Users created and logged" }
  ],
  "blocks": []
}
```

### Meta Cards

Use `meta` when you want small summary cards at the top of the page.

```json
{
  "meta": [
    { "label": "Scenario", "value": "Active Directory onboarding" },
    { "label": "Input", "value": "CSV-driven user list" },
    { "label": "Output", "value": "Users created and logged" }
  ]
}
```

### Blocks

`blocks` is the main content area. Add as many blocks as you want, in any order.

Supported block types:

- `text`
- `image`
- `code`
- `list`
- `quote`
- `divider`
- `html`

Common block fields:

- `type`: Required block type
- `title`: Block heading
- `text`: Paragraph text or short description
- `paragraphs`: Array of paragraphs for text blocks
- `href`: Makes the heading or image clickable
- `linkLabel`: Adds a button link under a text block
- `target`: Link target, for example `_blank`
- `rel`: Link rel value, for example `noopener noreferrer`

### Text Block

Use this for headings and paragraphs.

```json
{
  "type": "text",
  "title": "Overview",
  "paragraphs": [
    "First paragraph.",
    "Second paragraph."
  ]
}
```

Short form:

```json
{
  "type": "text",
  "title": "Overview",
  "text": "Single paragraph text is also supported."
}
```

### Image Block

Use this for one image or many images.

Single image:

```json
{
  "type": "image",
  "title": "Screenshot",
  "location": "local",
  "folder": "assets/images",
  "file": "dashboard.png",
  "alt": "Dashboard screenshot",
  "caption": "Main dashboard view"
}
```

Multiple images:

```json
{
  "type": "image",
  "title": "Screenshots",
  "images": [
    {
      "location": "local",
      "folder": "assets/images",
      "file": "img1.png",
      "alt": "First screenshot",
      "caption": "Login screen"
    },
    {
      "location": "supabase",
      "folder": "Projects",
      "file": "img2.png",
      "alt": "Second screenshot",
      "caption": "Dashboard screen"
    }
  ]
}
```

Image fields:

- `location: "local"` builds a path like `./assets/images/file.png`
- `location: "supabase"` builds a public Supabase storage URL
- `folder`: Folder name or bucket folder
- `file`: File name with extension
- `src`: Optional direct URL if you want to bypass folder/file
- `alt`: Alt text
- `caption`: Caption below the image
- `href`: Makes the image clickable

### Code Block

Use this for PowerShell, JSON, or any other code sample.

```json
{
  "type": "code",
  "title": "Sample Script",
  "language": "powershell",
  "code": "Write-Host \"Hello\""
}
```

Code fields:

- `code`: The code text
- `language`: Optional label for the block
- `title`: Heading shown above the code

### List Block

Use this for benefits, bullet points, or feature lists.

```json
{
  "type": "list",
  "title": "Key Benefits",
  "text": "This section explains the value.",
  "items": [
    "Reduced manual effort",
    "Consistent account configuration",
    "Automated logging"
  ]
}
```

### Quote Block

Use this for notes or callouts.

```json
{
  "type": "quote",
  "title": "Note",
  "text": "Each block is independent."
}
```

### Divider Block

Use this when you want a visual separator.

```json
{ "type": "divider" }
```

### HTML Block

Use this only when you need custom HTML inside a block.

```json
{
  "type": "html",
  "title": "Custom Section",
  "html": "<strong>Anything you want here.</strong>"
}
```

### Links

You can attach links to:

- a text block heading
