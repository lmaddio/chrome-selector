// Content Script for Element Selector Extension

(function() {
  'use strict';

  // Avoid multiple injections
  if (window.__elementSelectorInjected) return;
  window.__elementSelectorInjected = true;

  class ElementSelector {
    constructor() {
      this.state = {
        isActive: false,
        selections: [],
        matchingElements: [],
        finalSelector: '',
        hoveredElement: null,
        modalOpen: false
      };

      this.boundHandleMouseOver = this.handleMouseOver.bind(this);
      this.boundHandleMouseOut = this.handleMouseOut.bind(this);
      this.boundHandleClick = this.handleClick.bind(this);
      this.boundHandleKeyDown = this.handleKeyDown.bind(this);
      
      this.validationTimeout = null;
      this.modal = null;
      this.floatingButton = null;

      this.init();
    }

    init() {
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
          case 'GET_STATE':
            sendResponse(this.getStateForPopup());
            break;
          case 'START_SELECTION':
            this.startSelection();
            sendResponse({ success: true });
            break;
          case 'CONFIRM_SELECTION':
            const result = this.confirmSelection();
            sendResponse(result);
            break;
          case 'RESET_SELECTION':
            this.resetSelection();
            sendResponse({ success: true });
            break;
          case 'CANCEL_SELECTION':
            this.cancelSelection();
            sendResponse({ success: true });
            break;
        }
        return true;
      });
    }

    getStateForPopup() {
      return {
        isActive: this.state.isActive,
        selections: this.state.selections.length,
        matchingElements: this.state.matchingElements.length,
        finalSelector: this.state.finalSelector,
        modalOpen: this.state.modalOpen
      };
    }

    notifyPopup() {
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        data: this.getStateForPopup()
      }).catch(() => {});
    }

    startSelection() {
      this.state.isActive = true;
      this.state.selections = [];
      this.state.matchingElements = [];
      this.state.finalSelector = '';

      document.addEventListener('mouseover', this.boundHandleMouseOver, true);
      document.addEventListener('mouseout', this.boundHandleMouseOut, true);
      document.addEventListener('click', this.boundHandleClick, true);
      document.addEventListener('keydown', this.boundHandleKeyDown, true);

      document.body.classList.add('element-selector-active');
      
      // Create floating button
      this.createFloatingButton();
      
      this.notifyPopup();
    }

    createFloatingButton() {
      // Remove existing button if any
      if (this.floatingButton) {
        this.floatingButton.remove();
      }

      const button = document.createElement('div');
      button.className = 'element-selector-floating-btn';
      button.innerHTML = `
        <div class="element-selector-floating-btn-content">
          <span class="element-selector-floating-btn-icon">🎯</span>
          <span class="element-selector-floating-btn-count">0</span>
          <span class="element-selector-floating-btn-label">elements</span>
        </div>
        <div class="element-selector-floating-btn-hint">Click to open editor</div>
      `;

      // Click handler
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onFloatingButtonClick();
      });

      document.body.appendChild(button);
      this.floatingButton = button;
      
      // Update initial count
      this.updateFloatingButtonCount();
    }

    updateFloatingButtonCount() {
      if (!this.floatingButton) return;

      const countEl = this.floatingButton.querySelector('.element-selector-floating-btn-count');
      const labelEl = this.floatingButton.querySelector('.element-selector-floating-btn-label');
      const hintEl = this.floatingButton.querySelector('.element-selector-floating-btn-hint');
      const count = this.state.matchingElements.length;
      const selectionsCount = this.state.selections.length;

      countEl.textContent = count;
      labelEl.textContent = count === 1 ? 'element' : 'elements';

      // Update button state based on selection progress
      this.floatingButton.classList.remove(
        'element-selector-floating-btn-empty',
        'element-selector-floating-btn-partial',
        'element-selector-floating-btn-ready'
      );

      if (selectionsCount === 0) {
        this.floatingButton.classList.add('element-selector-floating-btn-empty');
        hintEl.textContent = 'Select first element';
      } else if (selectionsCount === 1) {
        this.floatingButton.classList.add('element-selector-floating-btn-partial');
        hintEl.textContent = 'Select second element';
      } else {
        this.floatingButton.classList.add('element-selector-floating-btn-ready');
        hintEl.textContent = 'Click to open editor';
      }
    }

    onFloatingButtonClick() {
      // Only open modal if we have 2 selections and matching elements
      if (this.state.selections.length >= 2 && this.state.matchingElements.length > 0) {
        this.hideFloatingButton();
        this.showModal(this.state.finalSelector, this.state.matchingElements.length);
      }
    }

    hideFloatingButton() {
      if (this.floatingButton) {
        this.floatingButton.classList.add('element-selector-floating-btn-hidden');
      }
    }

    showFloatingButton() {
      if (this.floatingButton) {
        this.floatingButton.classList.remove('element-selector-floating-btn-hidden');
      }
    }

    removeFloatingButton() {
      if (this.floatingButton) {
        this.floatingButton.remove();
        this.floatingButton = null;
      }
    }

    stopSelection() {
      this.state.isActive = false;

      document.removeEventListener('mouseover', this.boundHandleMouseOver, true);
      document.removeEventListener('mouseout', this.boundHandleMouseOut, true);
      document.removeEventListener('click', this.boundHandleClick, true);
      document.removeEventListener('keydown', this.boundHandleKeyDown, true);

      document.body.classList.remove('element-selector-active');
      this.clearHighlights();
      this.removeFloatingButton();
      this.notifyPopup();
    }

    handleMouseOver(event) {
      if (!this.state.isActive) return;
      if (this.state.selections.length >= 2) return;

      event.target.classList.add('element-selector-hover');
      this.state.hoveredElement = event.target;
    }

    handleMouseOut(event) {
      if (!this.state.isActive) return;

      event.target.classList.remove('element-selector-hover');
      if (this.state.hoveredElement === event.target) {
        this.state.hoveredElement = null;
      }
    }

    handleClick(event) {
      if (!this.state.isActive) return;
      if (this.state.selections.length >= 2) return;

      // Ignore clicks on our own UI elements
      if (event.target.closest('.element-selector-overlay')) return;

      event.preventDefault();
      event.stopPropagation();

      const element = event.target;
      element.classList.remove('element-selector-hover');

      // Store selection info
      const selectionInfo = {
        element: element,
        path: this.getElementPath(element),
        depth: this.getElementDepth(element),
        tagName: element.tagName.toLowerCase(),
        classes: Array.from(element.classList).filter(c => !c.startsWith('element-selector-')),
        attributes: this.getRelevantAttributes(element)
      };

      this.state.selections.push(selectionInfo);

      // Mark as selected
      element.classList.add('element-selector-selected');

      if (this.state.selections.length === 2) {
        this.findMatchingElements();
      }

      // Update floating button after each selection
      this.updateFloatingButtonCount();
      
      this.notifyPopup();
    }

    handleKeyDown(event) {
      if (event.key === 'Escape') {
        this.cancelSelection();
      }
    }

    getElementPath(element) {
      const path = [];
      let current = element;

      while (current && current !== document.body && current !== document.documentElement) {
        path.unshift(current);
        current = current.parentElement;
      }

      return path;
    }

    getElementDepth(element) {
      let depth = 0;
      let current = element;

      while (current && current !== document.body && current !== document.documentElement) {
        depth++;
        current = current.parentElement;
      }

      return depth;
    }

    getRelevantAttributes(element) {
      const attrs = {};
      const relevantAttrs = ['id', 'class', 'data-testid', 'data-id', 'role', 'type', 'name', 'href'];

      for (const attr of relevantAttrs) {
        if (element.hasAttribute(attr)) {
          attrs[attr] = element.getAttribute(attr);
        }
      }

      return attrs;
    }

    findCommonAncestor(el1, el2) {
      const path1 = this.getElementPath(el1);
      const path2 = this.getElementPath(el2);

      let commonAncestor = document.body;
      const minLength = Math.min(path1.length, path2.length);

      for (let i = 0; i < minLength; i++) {
        if (path1[i] === path2[i]) {
          commonAncestor = path1[i];
        } else {
          break;
        }
      }

      return commonAncestor;
    }

    getRelativePath(element, ancestor) {
      const path = [];
      let current = element;

      while (current && current !== ancestor) {
        const parent = current.parentElement;
        if (!parent) break;

        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current);
        const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
        const tagIndex = sameTagSiblings.indexOf(current);

        path.unshift({
          tagName: current.tagName.toLowerCase(),
          index: index,
          tagIndex: tagIndex,
          totalSameTag: sameTagSiblings.length,
          classes: Array.from(current.classList).filter(c => !c.startsWith('element-selector-'))
        });

        current = parent;
      }

      return path;
    }

    findMatchingElements() {
      const [sel1, sel2] = this.state.selections;
      const el1 = sel1.element;
      const el2 = sel2.element;

      // Find common ancestor
      const commonAncestor = this.findCommonAncestor(el1, el2);

      // Get relative paths from common ancestor
      const path1 = this.getRelativePath(el1, commonAncestor);
      const path2 = this.getRelativePath(el2, commonAncestor);

      // Find the common pattern (same depth, same structure)
      const commonDepth = Math.min(path1.length, path2.length);

      // Build a selector pattern based on common structure
      const selectorParts = [];
      let currentLevel = commonAncestor;

      // Determine the pattern depth where elements diverge
      let divergeIndex = 0;
      for (let i = 0; i < commonDepth; i++) {
        if (path1[i].tagName !== path2[i].tagName) break;
        divergeIndex = i;
      }

      // Build selector from the pattern
      const pattern = this.buildSelectorPattern(path1, path2, commonAncestor);

      // Query for matching elements
      let matchingElements = [];
      try {
        matchingElements = Array.from(commonAncestor.querySelectorAll(pattern.selector));
        
        // Filter to only include elements at the same depth
        const targetDepth = path1.length;
        matchingElements = matchingElements.filter(elem => {
          return this.getRelativePath(elem, commonAncestor).length === targetDepth;
        });
      } catch (e) {
        console.error('Invalid selector:', pattern.selector, e);
        // Fallback: just include the two selected elements
        matchingElements = [el1, el2];
      }

      this.state.matchingElements = matchingElements;
      this.state.finalSelector = pattern.fullSelector;

      // Highlight all matching elements
      this.highlightMatchingElements();
      
      // Update floating button count
      this.updateFloatingButtonCount();
      
      this.notifyPopup();
    }

    buildSelectorPattern(path1, path2, commonAncestor) {
      // Find common classes and structure
      const parts = [];
      let currentSelector = '';

      // Get a unique selector for the common ancestor
      const ancestorSelector = this.getUniqueSelector(commonAncestor);

      for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
        const p1 = path1[i];
        const p2 = path2[i];

        if (p1.tagName === p2.tagName) {
          let part = p1.tagName;

          // Find common classes
          const commonClasses = p1.classes.filter(c => p2.classes.includes(c));
          if (commonClasses.length > 0) {
            part += '.' + commonClasses.join('.');
          }

          parts.push(part);
        } else {
          // Different tags at this level - use wildcard
          parts.push('*');
        }
      }

      // Build the relative selector for descendants
      const relativeSelector = parts.length > 0 ? parts.join(' > ') : '*';

      // The selector to query within common ancestor
      const selector = relativeSelector;

      // Full selector including ancestor path
      const fullSelector = ancestorSelector + ' > ' + relativeSelector;

      return { selector, fullSelector };
    }

    getUniqueSelector(element) {
      if (element === document.body) return 'body';
      if (element === document.documentElement) return 'html';

      const parts = [];
      let current = element;

      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();

        if (current.id) {
          selector = '#' + CSS.escape(current.id);
          parts.unshift(selector);
          break;
        }

        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }

        // Add classes for specificity (limited to avoid overly specific selectors)
        const classes = Array.from(current.classList)
          .filter(c => !c.startsWith('element-selector-'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }

        parts.unshift(selector);
        current = parent;
      }

      return parts.join(' > ');
    }

    highlightMatchingElements() {
      // Clear previous highlights
      document.querySelectorAll('.element-selector-match').forEach(el => {
        el.classList.remove('element-selector-match');
      });

      // Add highlight to matching elements
      this.state.matchingElements.forEach((el, index) => {
        el.classList.add('element-selector-match');
        
        // Add index label
        this.addIndexLabel(el, index + 1);
      });
    }

    addIndexLabel(element, index) {
      // Remove existing label
      const existingLabel = element.querySelector('.element-selector-label');
      if (existingLabel) {
        existingLabel.remove();
      }

      const label = document.createElement('span');
      label.className = 'element-selector-label';
      label.textContent = index;
      label.style.cssText = `
        position: absolute;
        top: -10px;
        left: -10px;
        background: #2196f3;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        z-index: 10001;
        pointer-events: none;
      `;

      // Ensure element has relative positioning for label
      const originalPosition = getComputedStyle(element).position;
      if (originalPosition === 'static') {
        element.style.position = 'relative';
        element.dataset.elementSelectorOriginalPosition = 'static';
      }

      element.appendChild(label);
    }

    clearHighlights() {
      document.querySelectorAll('.element-selector-hover').forEach(el => {
        el.classList.remove('element-selector-hover');
      });

      document.querySelectorAll('.element-selector-selected').forEach(el => {
        el.classList.remove('element-selector-selected');
      });

      document.querySelectorAll('.element-selector-match').forEach(el => {
        el.classList.remove('element-selector-match');
        
        // Remove index labels
        const label = el.querySelector('.element-selector-label');
        if (label) label.remove();

        // Restore original position
        if (el.dataset.elementSelectorOriginalPosition === 'static') {
          el.style.position = '';
          delete el.dataset.elementSelectorOriginalPosition;
        }
      });
    }

    confirmSelection() {
      const selector = this.state.finalSelector;
      const count = this.state.matchingElements.length;

      // Show the modal for editing instead of immediately stopping
      this.showModal(selector, count);

      return {
        selector: selector,
        count: count,
        success: true,
        modalOpened: true
      };
    }

    createModal() {
      // Remove existing modal if any
      if (this.modal) {
        this.modal.remove();
      }

      const modal = document.createElement('div');
      modal.className = 'element-selector-modal-overlay';
      modal.innerHTML = `
        <div class="element-selector-modal">
          <div class="element-selector-modal-header">
            <h2>📋 Edit Selector</h2>
            <button class="element-selector-modal-close" title="Close">&times;</button>
          </div>
          <div class="element-selector-modal-body">
            <div class="element-selector-modal-section">
              <label for="element-selector-input">CSS Selector:</label>
              <textarea 
                id="element-selector-input" 
                class="element-selector-input"
                spellcheck="false"
              ></textarea>
            </div>
            <div class="element-selector-validation">
              <div class="element-selector-validation-status">
                <span class="element-selector-status-icon"></span>
                <span class="element-selector-status-text">Validating...</span>
              </div>
              <div class="element-selector-match-count">
                <span class="element-selector-count-number">0</span>
                <span class="element-selector-count-label">elements matched</span>
              </div>
            </div>
            <div class="element-selector-modal-preview">
              <div class="element-selector-preview-header">
                <span>Preview matched elements</span>
                <button class="element-selector-preview-btn">Show/Update Preview</button>
              </div>
            </div>
            
            <div class="element-selector-code-section">
              <div class="element-selector-code-header">
                <label for="element-selector-code">JavaScript Code:</label>
                <span class="element-selector-code-hint">
                  💡 Edit the code below and click "Run Code" to execute it. If the code returns a value, it will be copied to your clipboard.
                </span>
              </div>
              <textarea 
                id="element-selector-code" 
                class="element-selector-code-input"
                spellcheck="false"
              ></textarea>
            </div>
            
            <div class="element-selector-result hidden">
              <div class="element-selector-result-content">
                <span class="element-selector-result-icon"></span>
                <span class="element-selector-result-message"></span>
              </div>
            </div>
          </div>
          <div class="element-selector-modal-footer">
            <button class="element-selector-btn element-selector-btn-secondary element-selector-cancel-btn">
              Cancel
            </button>
            <button class="element-selector-btn element-selector-btn-primary element-selector-run-btn">
              ▶ Run Code
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this.modal = modal;

      // Bind modal events
      this.bindModalEvents();

      return modal;
    }

    bindModalEvents() {
      const modal = this.modal;
      const input = modal.querySelector('#element-selector-input');
      const codeInput = modal.querySelector('#element-selector-code');
      const closeBtn = modal.querySelector('.element-selector-modal-close');
      const cancelBtn = modal.querySelector('.element-selector-cancel-btn');
      const runBtn = modal.querySelector('.element-selector-run-btn');
      const previewBtn = modal.querySelector('.element-selector-preview-btn');
      const overlay = modal;

      // Input change with debounced validation
      input.addEventListener('input', (e) => {
        this.debouncedValidate(e.target.value);
        // Update the code textarea with new selector
        this.updateCodeWithSelector(e.target.value);
      });

      // Close button
      closeBtn.addEventListener('click', () => {
        this.closeModal();
      });

      // Cancel button
      cancelBtn.addEventListener('click', () => {
        this.closeModal();
      });

      // Run button - execute JavaScript code
      runBtn.addEventListener('click', () => {
        this.executeCode();
      });

      // Preview button
      previewBtn.addEventListener('click', () => {
        const currentSelector = input.value.trim();
        this.updatePreviewHighlights(currentSelector);
      });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal();
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', this.handleModalKeyDown = (e) => {
        if (e.key === 'Escape' && this.state.modalOpen) {
          this.closeModal();
        }
      });
    }

    updateCodeWithSelector(selector) {
      const codeInput = this.modal.querySelector('#element-selector-code');
      const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      codeInput.value = `[...document.querySelectorAll('${escapedSelector}')]`;
    }

    async executeCode() {
      const codeInput = this.modal.querySelector('#element-selector-code');
      const code = codeInput.value.trim();
      const runBtn = this.modal.querySelector('.element-selector-run-btn');

      if (!code) {
        this.showResult('warning', '⚠️ Please enter some code to execute.');
        return;
      }

      // Show loading state
      runBtn.disabled = true;
      runBtn.textContent = '⏳ Running...';

      try {
        // First check if userScripts API is available
        const permCheck = await chrome.runtime.sendMessage({ type: 'CHECK_USERSCRIPTS' });
        
        if (!permCheck.available) {
          console.warn('[Element Selector] userScripts API not available:', permCheck.reason);
          console.warn('[Element Selector] Falling back to MAIN world execution...');
        }

        // Execute code via background script
        const response = await chrome.runtime.sendMessage({ 
          type: 'EXECUTE_CODE', 
          code: code 
        });

        if (response.success) {
          const result = response.result;
          
          if (result !== undefined && result !== null) {
            // Convert result to string for clipboard
            let resultString;
            
            if (typeof result === 'object') {
              try {
                resultString = JSON.stringify(result, null, 2);
              } catch (e) {
                resultString = String(result);
              }
            } else {
              resultString = String(result);
            }

            // Copy to clipboard
            this.copyToClipboard(resultString);
            
            // Show success message
            this.showResult('success', '✅ Return content copied to clipboard!');
            
            console.log('[Element Selector] Code executed successfully. Result:', result);
          } else {
            // Code executed but returned nothing
            this.showResult('info', 'ℹ️ Code executed successfully (no return value).');
            console.log('[Element Selector] Code executed successfully (no return value).');
          }
        } else {
          // Execution failed
          console.error('[Element Selector] Error executing code:', response.error);
          this.showResult('error', "❌ There's an error, please check web console");
        }

      } catch (error) {
        // Log error to console
        console.error('[Element Selector] Error executing code:', error);
        
        // Show error message
        this.showResult('error', "❌ There's an error, please check web console");
      }

      // Reset button state
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Code';
    }

    showResult(type, message) {
      const resultDiv = this.modal.querySelector('.element-selector-result');
      const resultMessage = this.modal.querySelector('.element-selector-result-message');

      // Remove existing type classes
      resultDiv.classList.remove(
        'element-selector-result-success',
        'element-selector-result-error',
        'element-selector-result-warning',
        'element-selector-result-info'
      );

      // Add appropriate class
      resultDiv.classList.add(`element-selector-result-${type}`);
      resultDiv.classList.remove('hidden');
      
      resultMessage.textContent = message;
    }

    showModal(selector, count) {
      this.state.modalOpen = true;
      
      // Hide floating button when modal opens
      this.hideFloatingButton();
      
      const modal = this.createModal();
      
      const input = modal.querySelector('#element-selector-input');
      const codeInput = modal.querySelector('#element-selector-code');
      
      input.value = selector;
      
      // Set initial code value
      const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      codeInput.value = `[...document.querySelectorAll('${escapedSelector}')]`;
      
      // Initial validation
      this.validateSelector(selector);

      // Focus the input and select all text
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);

      this.notifyPopup();
    }

    closeModal() {
      if (this.modal) {
        this.modal.remove();
        this.modal = null;
      }
      
      if (this.handleModalKeyDown) {
        document.removeEventListener('keydown', this.handleModalKeyDown);
      }

      this.state.modalOpen = false;
      this.clearHighlights();
      this.stopSelection();
    }

    debouncedValidate(selector) {
      // Clear existing timeout
      if (this.validationTimeout) {
        clearTimeout(this.validationTimeout);
      }

      // Update status to show validating
      this.updateValidationStatus('validating', 'Validating...', 0);

      // Set new timeout for 500ms after last input
      this.validationTimeout = setTimeout(() => {
        this.validateSelector(selector);
      }, 500);
    }

    validateSelector(selector) {
      const trimmedSelector = selector.trim();
      
      if (!trimmedSelector) {
        this.updateValidationStatus('invalid', 'Selector cannot be empty', 0);
        return { valid: false, count: 0, error: 'Empty selector' };
      }

      try {
        // Test if the selector is valid by attempting to use it
        const elements = document.querySelectorAll(trimmedSelector);
        const count = elements.length;

        if (count === 0) {
          this.updateValidationStatus('warning', 'Valid selector, but no elements matched', 0);
          return { valid: true, count: 0, error: null };
        }

        this.updateValidationStatus('valid', `Valid selector`, count);
        
        // Store the validated selector and elements
        this.state.finalSelector = trimmedSelector;
        this.state.matchingElements = Array.from(elements);

        return { valid: true, count: count, error: null };

      } catch (error) {
        // Invalid CSS selector syntax
        let errorMessage = 'Invalid CSS selector syntax';
        
        // Try to provide more specific error messages
        if (error.message) {
          if (error.message.includes('not a valid selector')) {
            errorMessage = 'Invalid selector syntax';
          } else if (error.message.includes('identifier')) {
            errorMessage = 'Invalid identifier in selector';
          }
        }

        this.updateValidationStatus('invalid', errorMessage, 0);
        return { valid: false, count: 0, error: errorMessage };
      }
    }

    updateValidationStatus(status, message, count) {
      if (!this.modal) return;

      const statusIcon = this.modal.querySelector('.element-selector-status-icon');
      const statusText = this.modal.querySelector('.element-selector-status-text');
      const countNumber = this.modal.querySelector('.element-selector-count-number');
      const countLabel = this.modal.querySelector('.element-selector-count-label');
      const runBtn = this.modal.querySelector('.element-selector-run-btn');
      const validationDiv = this.modal.querySelector('.element-selector-validation');

      // Update count
      countNumber.textContent = count;
      countLabel.textContent = count === 1 ? 'element matched' : 'elements matched';

      // Remove existing status classes
      validationDiv.classList.remove(
        'element-selector-status-valid',
        'element-selector-status-invalid',
        'element-selector-status-warning',
        'element-selector-status-validating'
      );

      // Update based on status
      switch (status) {
        case 'valid':
          statusIcon.textContent = '✓';
          validationDiv.classList.add('element-selector-status-valid');
          runBtn.disabled = false;
          break;
        case 'invalid':
          statusIcon.textContent = '✗';
          validationDiv.classList.add('element-selector-status-invalid');
          runBtn.disabled = true;
          break;
        case 'warning':
          statusIcon.textContent = '⚠';
          validationDiv.classList.add('element-selector-status-warning');
          runBtn.disabled = false;
          break;
        case 'validating':
          statusIcon.textContent = '⟳';
          validationDiv.classList.add('element-selector-status-validating');
          runBtn.disabled = true;
          break;
      }

      statusText.textContent = message;
    }

    updatePreviewHighlights(selector) {
      // Clear previous highlights
      this.clearHighlights();

      if (!selector.trim()) return;

      try {
        const elements = document.querySelectorAll(selector);
        this.state.matchingElements = Array.from(elements);
        
        // Highlight all matching elements
        this.highlightMatchingElements();
      } catch (e) {
        console.log('Invalid selector for preview:', e);
      }
    }

    copyToClipboard(text) {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
          this.fallbackCopyToClipboard(text);
        });
      } else {
        this.fallbackCopyToClipboard(text);
      }
    }

    fallbackCopyToClipboard(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        console.error('Copy failed:', e);
      }
      document.body.removeChild(textarea);
    }

    resetSelection() {
      this.clearHighlights();
      this.state.selections = [];
      this.state.matchingElements = [];
      this.state.finalSelector = '';
      this.notifyPopup();
    }

    cancelSelection() {
      this.stopSelection();
    }
  }

  // Initialize
  window.__elementSelector = new ElementSelector();
})();
