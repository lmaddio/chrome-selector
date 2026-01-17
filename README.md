# 🎯 Element Selector Chrome Extension

A powerful Chrome extension that helps you select HTML elements and find similar elements sharing the same depth within their common ancestor. Perfect for web scraping, testing, and DOM analysis.

## Features

- **Visual Element Selection**: Hover over elements to preview them with a highlighted border
- **Two-Click Pattern Matching**: Select two similar elements to find all matching elements
- **Smart Ancestor Detection**: Automatically finds the common ancestor and matching pattern
- **Visual Highlighting**: All matching elements are highlighted with numbered badges
- **Selector Copying**: Copy the generated CSS selector to clipboard with one click

## Installation

### From Source (Developer Mode)

1. **Generate Icons** (Required first time):
   - Open `icons/generate-icons.html` in your browser
   - Click each download button to save the icons
   - Save them as `icon16.png`, `icon48.png`, and `icon128.png` in the `icons/` folder

2. **Load the Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right corner)
   - Click "Load unpacked"
   - Select the `chrome-selector` folder

3. **Pin the Extension** (Optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Element Selector" and click the pin icon

## Usage

### Basic Workflow

1. **Start Selection Mode**
   - Click the extension icon in your toolbar
   - Click "🖱️ Start Selection Mode"
   - Your cursor will change to a crosshair

2. **Select First Element**
   - Hover over elements on the page - they'll be highlighted in blue
   - Click on the first element you want to match
   - The element will be marked with an orange border

3. **Select Second Element**
   - Click on a second, similar element (e.g., another item in the same list)
   - The extension will analyze both elements

4. **Review Matches**
   - All matching elements at the same depth will be highlighted in green
   - Each match is numbered for easy identification
   - The popup shows the total count and generated selector

5. **Confirm & Edit Selection**
   - Review the highlighted elements
   - Click "✓ Confirm & Copy Selector" to open the editor modal
   - The modal shows the generated selector with live validation
   - Edit the selector as needed - validation runs 500ms after you stop typing
   - Click "Show/Update Preview" to see which elements match your edited selector
   - Click "Copy Selector" to copy and close the modal
   - Use "↺ Reset Selection" to start over

### Keyboard Shortcuts

- **Escape**: Cancel selection mode or close the editor modal

### Selector Editor Modal

After confirming your selection, a modal editor appears allowing you to:

- **View** the generated CSS selector
- **Edit** the selector with syntax highlighting
- **Live Validation** - The selector is validated 500ms after you stop typing
  - ✓ Green: Valid selector with matching elements
  - ⚠ Yellow: Valid selector but no elements matched  
  - ✗ Red: Invalid CSS selector syntax
- **Preview** - Click "Show/Update Preview" to highlight elements matching your edited selector

### JavaScript Code Execution

The modal includes a JavaScript code editor with powerful features:

- **Pre-filled Code**: Automatically generates code like:
  ```javascript
  [...document.querySelectorAll('your-selector')]
  ```
- **Edit & Customize**: Modify the code to extract specific data, e.g.:
  ```javascript
  [...document.querySelectorAll('.product-title')].map(el => el.textContent)
  ```
- **Run Code**: Click "▶ Run Code" to execute your JavaScript
- **Auto-Copy Results**: If your code returns a value, it's automatically copied to clipboard
- **Error Handling**: Errors are logged to the browser console for debugging
- **Feedback Messages**:
  - ✅ "Return content copied to clipboard!" - Success with return value
  - ℹ️ "Code executed successfully (no return value)" - Success without return
  - ❌ "There's an error, please check web console" - Error occurred

## How It Works

The extension uses a smart algorithm to find matching elements:

1. **Common Ancestor Detection**: When you select two elements, the extension finds their lowest common ancestor in the DOM tree.

2. **Path Analysis**: It analyzes the relative path from the common ancestor to each selected element.

3. **Pattern Matching**: Based on common tag names, classes, and structure, it generates a CSS selector pattern.

4. **Depth Filtering**: Only elements at the same depth (relative to the common ancestor) are included.

### Example

If you have a list like:
```html
<ul class="items">
  <li class="item"><span>Item 1</span></li>
  <li class="item"><span>Item 2</span></li>
  <li class="item"><span>Item 3</span></li>
</ul>
```

Clicking on two `<span>` elements will:
- Find `<ul class="items">` as the common ancestor
- Generate a selector like `ul.items > li.item > span`
- Highlight all 3 span elements

## File Structure

```
chrome-selector/
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI
├── popup.js           # Popup logic
├── content.js         # Content script (DOM interaction)
├── styles.css         # Injected styles for highlighting
├── background.js      # Service worker
├── icons/
│   ├── generate-icons.html  # Icon generator tool
│   ├── icon16.png     # 16x16 toolbar icon
│   ├── icon48.png     # 48x48 icon
│   └── icon128.png    # 128x128 Chrome Web Store icon
└── README.md          # This file
```

## Technical Details

### Permissions Used

- `activeTab`: Access the current tab when the extension is clicked
- `scripting`: Inject content scripts
- `clipboardWrite`: Copy selectors to clipboard
- `userScripts`: Execute user-provided JavaScript code (required for code execution feature)
- `host_permissions`: Access to all URLs for element selection

### Browser Compatibility

- Chrome 120+ (for userScripts API)
- Edge 120+ (Chromium-based)

**Note**: The `userScripts` API requires:
1. Chrome/Edge version 120 or later
2. Developer mode enabled in `chrome://extensions/`

If the userScripts API is not available, the extension will log a warning to the console and attempt to use fallback execution methods.

## Troubleshooting

### Extension not working on a page?

- Some pages (like `chrome://` URLs) restrict extensions
- Try refreshing the page after installing
- Check if another extension is conflicting

### Selector not matching expected elements?

- The algorithm favors precision over recall
- Try selecting elements that are more structurally similar
- Reset and try with different element pairs

### Highlights not visible?

- Some pages may override styles with `!important`
- Try inspecting the elements to see if classes are applied

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use and modify as needed.
