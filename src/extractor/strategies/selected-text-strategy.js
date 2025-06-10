// src/extractor/strategies/selected-text-strategy.js
import BaseExtractor from '../base-extractor.js';
import { normalizeText } from '../utils/text-utils.js';

class SelectedTextExtractorStrategy extends BaseExtractor {
  constructor() {
    super('selectedText');
    this.logger.info('SelectedTextExtractorStrategy initialized.');
  }

  /**
   * Orchestrates the extraction of the selected text and saves it to storage.
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('Selected text extraction process started.');
      const pageData = await this.extractData();
      await this.saveToStorage(pageData);
      this.logger.info(
        'Selected text extraction process completed and data saved.'
      );
    } catch (error) {
      this.logger.error(
        'Error during selected text extraction and saving:',
        error
      );
      await this.saveToStorage({
        error: true,
        message: `Extraction failed: ${error.message || 'Unknown error'}`,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      });
    }
  }

  /**
   * Extracts the currently selected text from the window.
   * @returns {Promise<Object>} An object containing the extracted selection data.
   */
  async extractData() {
    const selectedText = window.getSelection().toString();
    const content = normalizeText(selectedText);

    this.logger.info(`Extracted selected text (${content.length} chars).`);

    return {
      pageTitle: document.title || 'Selected Text',
      pageUrl: window.location.href,
      content: content,
      extractedAt: new Date().toISOString(),
      contentType: this.contentType,
    };
  }
}

export default SelectedTextExtractorStrategy;
