const BasePlatform = require('../platform-base');

class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }

  findEditorElement() {
    // Updated selector based on actual textarea attributes
    return document.querySelector('textarea[name="message.text"][placeholder="Demander au Chat ou @mentionner un agent"]') ||
           document.querySelector('textarea.border-default.ring-offset-background');
  }

  findSubmitButton() {
    // More specific selector including aria-label and class structure
    return document.querySelector('button[aria-label="Send question"].bg-inverted.text-inverted-default');
  }

  async insertAndSubmitText(text) {
    const editorElement = this.findEditorElement();
    
    if (!editorElement) {
      this.logger.error('Mistral editor element not found');
      return false;
    }

    try {
      // Focus first to ensure proper state
      editorElement.focus();
      
      // Set value directly
      editorElement.value = text;
      
      // Trigger comprehensive set of events to ensure React state updates
      const events = ['input', 'change', 'keydown', 'keyup', 'keypress'];
      events.forEach(eventType => {
        editorElement.dispatchEvent(new Event(eventType, {
          bubbles: true,
          cancelable: true
        }));
      });

      // Additional blur/focus cycle to trigger validation
      editorElement.blur();
      editorElement.focus();

      return new Promise((resolve) => {
        const attemptSubmission = (retries = 5) => {
          setTimeout(() => {
            const sendButton = this.findSubmitButton();
            
            if (!sendButton) {
              this.logger.error('Send button not found');
              return resolve(false);
            }

            // Remove disabled attribute if present
            if (sendButton.disabled) {
              sendButton.removeAttribute('disabled');
              this.logger.info('Removed disabled attribute from button');
            }

            // Create full click simulation
            if (!sendButton.disabled) {
              const mouseEvents = ['mousedown', 'mouseup', 'click'];
              mouseEvents.forEach(eventType => {
                const event = new MouseEvent(eventType, {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  buttons: 1
                });
                sendButton.dispatchEvent(event);
              });
              
              this.logger.info('Text submitted to Mistral successfully');
              return resolve(true);
            }

            // Retry mechanism
            if (retries > 0) {
              this.logger.info(`Retrying submission (${retries} attempts remaining)`);
              return attemptSubmission(retries - 1);
            }

            this.logger.error('Submit button remained disabled after retries');
            resolve(false);
          }, 500); // Reduced delay between checks
        };

        // Initial attempt with retries
        attemptSubmission();
      });
    } catch (error) {
      this.logger.error('Error inserting text into Mistral:', error);
      return false;
    }
  }
}

module.exports = MistralPlatform;