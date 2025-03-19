// src/sidebar/components/InputArea.jsx
import { h, Component } from 'preact';

export default class InputArea extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      inputValue: ''
    };
    
    this.textareaRef = null;
    
    // Bind methods
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }
  
  componentDidMount() {
    // Focus textarea on mount
    if (this.textareaRef) {
      this.textareaRef.focus();
    }
  }
  
  handleChange(e) {
    this.setState({ inputValue: e.target.value });
    
    // Auto-grow the textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  }
  
  handleSubmit() {
    if (!this.state.inputValue.trim() || this.props.disabled) return;
    
    // Call parent's submit handler
    this.props.onSubmit(this.state.inputValue);
    
    // Clear input and reset height
    this.setState({ inputValue: '' });
    if (this.textareaRef) {
      this.textareaRef.style.height = 'auto';
    }
  }
  
  handleKeyDown(e) {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSubmit();
    }
  }
  
  render() {
    const { disabled, errorMessage } = this.props;
    const { inputValue } = this.state;
    
    return (
      <div class="input-area">
        {errorMessage && (
          <div class="error-message">{errorMessage}</div>
        )}
        
        <div class="input-container">
          <textarea
            ref={el => { this.textareaRef = el; }}
            class="message-input"
            placeholder="Type a message..."
            value={inputValue}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyDown}
            disabled={disabled}
            rows="1"
          />
          
          <button
            class="submit-button"
            onClick={this.handleSubmit}
            disabled={!inputValue.trim() || disabled}
            title="Send message"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }
}