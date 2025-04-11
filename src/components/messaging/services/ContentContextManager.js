// src/components/messaging/services/ContentContextManager.js

/**
 * State machine managing contextual transitions between math and code content
 * Implements asymmetric transition thresholds to address persistent context issues
 */
export class ContentContextManager {
  constructor() {
    this.contextWindow = [];             // Contextual history buffer
    this.windowSize = 10;                 // Maximum history entries
    this.mathProbability = 0.5;          // Initial classification probability
    this.lastExplicitCodeBlock = null;   // Tracks recent code block encounters
    this.codeToMathThreshold = 0.3;      // Lower threshold to transition back to math
    this.mathToCodeThreshold = 0.3;      // Higher threshold to transition to code
  }
  
  /**
   * Records a new content classification and updates the contextual probability
   * @param {string} contentType - Type classification identifier
   * @param {string} content - The classified content
   */
  recordClassification(contentType, content) {
    // Add new classification with timestamp
    this.contextWindow.push({
      type: contentType,
      content: content.length > 100 ? content.substring(0, 100) + '...' : content,
      timestamp: Date.now()
    });
    
    // Maintain window size
    if (this.contextWindow.length > this.windowSize) {
      this.contextWindow.shift();
    }
    
    // Update probability based on recent history
    this._updateProbability();
  }
  
  /**
   * Returns the current contextual probability of mathematical content
   */
  getMathProbability() {
    return this.mathProbability;
  }
  
  /**
   * Detects context breaks that would reset the classification state
   * @param {string} content - Content to check for context breaks
   * @param {string|null} language - Explicit language if specified
   * @returns {boolean} - Whether a context break was detected
   */
  detectContextBreak(content, language) {
    const programmingTerms = [
      'javascript', 'python', 'function', 'class', 'const', 'var', 'let',
      'def ', 'import ', 'from ', 'return ', 'if ', 'for ', 'while '
    ];
    
    // Explicit language context break
    if (language && language !== 'text' && language !== 'math') {
      this.resetContext(0.1); // Strong bias toward code
      return true;
    }
    
    // Programming term context break
    for (const term of programmingTerms) {
      if (content.trimStart().toLowerCase().startsWith(term)) {
        this.resetContext(0.2); // Bias toward code
        return true;
      }
    }
    
    // Math environment context break
    if (content.includes('\\begin{') || content.includes('$$')) {
      this.resetContext(0.9); // Strong bias toward math
      return true;
    }
    
    return false;
  }
  
  /**
   * Explicitly records a code block encounter with additional metadata
   * @param {string} language - The programming language if specified
   */
  recordCodeBlockEncounter(language = null) {
    this.lastExplicitCodeBlock = {
      timestamp: Date.now(),
      language: language
    };
    
    // Force probability toward code context with preservation of differential
    const previousProbability = this.mathProbability;
    this.mathProbability = Math.min(previousProbability, 0.2);
  }
  
  /**
   * Determines if content should be classified as math using asymmetric thresholds
   * @param {string} content - The content to evaluate
   * @param {boolean} hasExplicitMathIndicators - Whether content has clear math markers
   * @returns {boolean} - Classification decision
   */
  shouldClassifyAsMath(content, hasExplicitMathIndicators) {
    // Clear math indicators override context
    if (hasExplicitMathIndicators) {
      return true;
    }
    
    // Check for transition from code to math context
    const isRecentlyAfterCodeBlock = this.lastExplicitCodeBlock && 
      (Date.now() - this.lastExplicitCodeBlock.timestamp < 5000); // 5 second window
    
    if (isRecentlyAfterCodeBlock) {
      // Use reduced threshold for math detection after code blocks
      return this.mathProbability > this.codeToMathThreshold;
    }
    
    // Standard contextual threshold
    return this.mathProbability > 0.5;
  }
  
  /**
   * Detects strong mathematical indicators that override context
   * @param {string} content - Content to analyze
   * @returns {boolean} - Whether strong indicators are present
   */
  hasStrongMathematicalIndicators(content) {
    const strongMathPatterns = [
      // Mathematical operators rarely used in code
      /[∫∬∭∮∯∰∇∆∂]/,
      
      // Greek letters
      /[αβγδεζηθικλμνξοπρστυφχψω]/i,
      
      // Mathematical symbols
      /[±∓×÷⋅∙∘∝∞≠≈≤≥≪≫⊂⊃⊆⊇⊄⊅⊕⊗]/,
      
      // Complex mathematical expressions
      /e\^[\(\{][a-zA-Z0-9i\+\-\*\/\s]+[\)\}]/,
      /\b(sin|cos|tan)\s*\([a-zA-Z0-9\+\-\*\/\s]+\)/,
      
      // Function patterns that are clearly mathematical
      /^[a-zA-Z]\([a-zA-Z]\)$/,
      /^Res\(f,\s*[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+\)$/,
      /q\s*≡\s*\d+\s*\(mod\s*\d+\)/
    ];
    
    return strongMathPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Resets context with a specific probability
   * @param {number} initialProbability - New probability value
   */
  resetContext(initialProbability = 0.5) {
    this.contextWindow = [];
    this.mathProbability = initialProbability;
  }
  
  /**
   * Updates internal probability based on context window with asymmetric weighting
   * @private
   */
  _updateProbability() {
    if (this.contextWindow.length === 0) return;
    
    // Count classifications with recency weighting
    let mathWeight = 0;
    let codeWeight = 0;
    let totalWeight = 0;
    
    this.contextWindow.forEach((item, index) => {
      // Linear recency weighting
      const weight = index + 1;
      totalWeight += weight;
      
      if (item.type.startsWith('MATH_')) {
        mathWeight += weight;
      } else if (item.type.startsWith('CODE_')) {
        codeWeight += weight;
      }
    });
    
    if (totalWeight > 0) {
      const rawProbability = mathWeight / totalWeight;
      
      // Apply asymmetric smoothing based on current state
      if (this.mathProbability < 0.5) {
        // In code context - use more aggressive transition to math
        this.mathProbability = 0.15 + (rawProbability * 0.7);
      } else {
        // In math context - more conservative transition to code
        this.mathProbability = 0.25 + (rawProbability * 0.5);
      }
    }
  }
}

// Singleton instance for application-wide access
export const contentContext = new ContentContextManager();