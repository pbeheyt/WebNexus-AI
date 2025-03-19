// src/sidebar/components/Sidebar.jsx
import { h, Component } from 'preact';
import Header from './Header';
import MessageList from './MessageList';
import InputArea from './InputArea';

export default class Sidebar extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      conversation: props.initialConversation || [],
      status: 'ready', // ready, loading, error
      errorMessage: '',
      platformInfo: props.platformInfo || {
        platformId: 'unknown',
        platformName: 'AI Platform',
        modelId: 'unknown'
      }
    };
    
    // Bind methods
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleUpdateConversation = this.handleUpdateConversation.bind(this);
    this.handleAppendMessage = this.handleAppendMessage.bind(this);
    this.handleStatusUpdate = this.handleStatusUpdate.bind(this);
    
    // Reference to port for messaging
    this.port = props.port;
  }
  
  componentDidMount() {
    // Add event listeners for sidebar events
    window.addEventListener('sidebar:updateConversation', (e) => this.handleUpdateConversation(e.detail));
    window.addEventListener('sidebar:appendMessage', (e) => this.handleAppendMessage(e.detail));
    window.addEventListener('sidebar:updateStatus', (e) => this.handleStatusUpdate(e.detail));
    
    // Request initial data if conversation is empty
    if (this.state.conversation.length === 0) {
      this.port.postMessage({ action: 'getConversation' });
    }
  }
  
  componentWillUnmount() {
    // Remove event listeners
    window.removeEventListener('sidebar:updateConversation', this.handleUpdateConversation);
    window.removeEventListener('sidebar:appendMessage', this.handleAppendMessage);
    window.removeEventListener('sidebar:updateStatus', this.handleStatusUpdate);
  }
  
  handleUpdateConversation(conversation) {
    this.setState({ conversation });
  }
  
  handleAppendMessage(message) {
    this.setState(prevState => ({
      conversation: [...prevState.conversation, message],
      status: 'ready'
    }));
  }
  
  handleStatusUpdate(status) {
    this.setState({ 
      status: status.state,
      errorMessage: status.error || ''
    });
  }
  
  handleSubmit(text) {
    if (!text.trim()) return;
    
    // Add user message to conversation immediately
    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    
    this.handleAppendMessage(userMessage);
    
    // Set loading status
    this.setState({ status: 'loading' });
    
    // Send message to background script
    this.port.postMessage({
      action: 'sendMessage',
      message: text
    });
  }
  
  render() {
    const { conversation, status, errorMessage, platformInfo } = this.state;
    
    return (
      <div class="sidebar-container">
        <Header 
          platformName={platformInfo.platformName}
          modelId={platformInfo.modelId}
        />
        
        <MessageList 
          messages={conversation}
          loading={status === 'loading'}
        />
        
        <InputArea 
          onSubmit={this.handleSubmit}
          disabled={status === 'loading'}
          errorMessage={errorMessage}
        />
      </div>
    );
  }
}