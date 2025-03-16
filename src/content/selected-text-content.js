// src/content/selected-text-content.js
const ExtractorFactory = require('../extractor/extractor-factory');
const SelectedTextExtractorStrategy = require('../extractor/strategies/selected-text-strategy');

// Initialize the selected text extractor specifically
const extractor = new SelectedTextExtractorStrategy();
extractor.initialize();