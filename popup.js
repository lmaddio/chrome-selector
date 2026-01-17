// Popup Script for Element Selector Extension

class PopupController {
  constructor() {
    this.state = {
      isActive: false,
      selections: [],
      matchingElements: 0,
      finalSelector: '',
      modalOpen: false
    };

    this.elements = {
      status: document.getElementById('status'),
      selectionInfo: document.getElementById('selectionInfo'),
      elementCount: document.getElementById('elementCount'),
      selectorDisplay: document.getElementById('selectorDisplay'),
      startBtn: document.getElementById('startBtn'),
      confirmBtn: document.getElementById('confirmBtn'),
      resetBtn: document.getElementById('resetBtn'),
      cancelBtn: document.getElementById('cancelBtn')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.syncState();
  }

  bindEvents() {
    this.elements.startBtn.addEventListener('click', () => this.startSelection());
    this.elements.confirmBtn.addEventListener('click', () => this.confirmSelection());
    this.elements.resetBtn.addEventListener('click', () => this.resetSelection());
    this.elements.cancelBtn.addEventListener('click', () => this.cancelSelection());

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STATE_UPDATE') {
        this.handleStateUpdate(message.data);
      }
    });
  }

  async syncState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
        if (response) {
          this.handleStateUpdate(response);
        }
      }
    } catch (error) {
      console.log('Could not sync state:', error);
    }
  }

  async sendMessage(type, data = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        return await chrome.tabs.sendMessage(tab.id, { type, data });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  handleStateUpdate(data) {
    this.state = { ...this.state, ...data };
    this.updateUI();
  }

  updateUI() {
    const { isActive, selections, matchingElements, finalSelector, modalOpen } = this.state;

    // If modal is open, show a different message
    if (modalOpen) {
      this.setStatus('📝 Code editor is open on the page. Edit your JavaScript code and click "Run Code" to execute it!', 'success');
      this.elements.startBtn.classList.add('hidden');
      this.elements.cancelBtn.classList.add('hidden');
      this.elements.confirmBtn.classList.add('hidden');
      this.elements.resetBtn.classList.add('hidden');
      this.elements.selectionInfo.classList.add('hidden');
      return;
    }

    // Update status message
    if (!isActive) {
      this.setStatus('Click "Start Selection" to begin selecting elements on the page.', 'info');
      this.elements.startBtn.classList.remove('hidden');
      this.elements.cancelBtn.classList.add('hidden');
      this.elements.confirmBtn.classList.add('hidden');
      this.elements.resetBtn.classList.add('hidden');
      this.elements.selectionInfo.classList.add('hidden');
    } else if (selections.length === 0) {
      this.setStatus('Selection mode active! Hover over elements and click to select the first element.', 'warning');
      this.elements.startBtn.classList.add('hidden');
      this.elements.cancelBtn.classList.remove('hidden');
      this.elements.confirmBtn.classList.add('hidden');
      this.elements.resetBtn.classList.add('hidden');
      this.elements.selectionInfo.classList.add('hidden');
    } else if (selections.length === 1) {
      this.setStatus('First element selected! Now click on a second similar element to find matches.', 'warning');
      this.elements.startBtn.classList.add('hidden');
      this.elements.cancelBtn.classList.remove('hidden');
      this.elements.confirmBtn.classList.add('hidden');
      this.elements.resetBtn.classList.remove('hidden');
      this.elements.selectionInfo.classList.add('hidden');
    } else {
      this.setStatus(`Found ${matchingElements} matching elements! Review the highlighted elements and confirm.`, 'success');
      this.elements.startBtn.classList.add('hidden');
      this.elements.cancelBtn.classList.add('hidden');
      this.elements.confirmBtn.classList.remove('hidden');
      this.elements.resetBtn.classList.remove('hidden');
      this.elements.selectionInfo.classList.remove('hidden');
      this.elements.elementCount.textContent = matchingElements;
      
      if (finalSelector) {
        this.elements.selectorDisplay.textContent = finalSelector;
        this.elements.selectorDisplay.classList.remove('hidden');
      }
    }
  }

  setStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    if (type === 'warning') {
      this.elements.status.classList.add('warning');
    } else if (type === 'success') {
      this.elements.status.classList.add('success');
    }
  }

  async startSelection() {
    await this.sendMessage('START_SELECTION');
  }

  async confirmSelection() {
    const response = await this.sendMessage('CONFIRM_SELECTION');
    if (response && response.modalOpened) {
      // Modal is now open in the content script
      this.setStatus('📝 Code editor is open on the page. Edit your code and click "Run Code" to execute!', 'success');
      this.elements.confirmBtn.classList.add('hidden');
      this.elements.resetBtn.classList.add('hidden');
    }
  }

  async resetSelection() {
    await this.sendMessage('RESET_SELECTION');
  }

  async cancelSelection() {
    await this.sendMessage('CANCEL_SELECTION');
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
