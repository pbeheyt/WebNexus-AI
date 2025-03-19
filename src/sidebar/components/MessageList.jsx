// src/sidebar/components/MessageList.jsx
import { h, Component } from 'preact';
import MessageItem from './MessageItem';

export default class MessageList extends Component {
  constructor(props) {
    super(props);
    this.messagesEndRef = null;
  }
  
  componentDidMount() {
    this.scrollToBottom();
  }
  
  componentDidUpdate() {
    this.scrollToBottom();
  }
  
  scrollToBottom() {
    if (this.messagesEndRef) {
      this.messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  render() {
    const { messages, loading } = this.props;
    
    return (
      <div class="message-list">
        {messages.map((message, index) => (
          <MessageItem 
            key={index}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
        ))}
        
        {loading && (
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">AI is thinking...</div>
          </div>
        )}
        
        <div ref={el => { this.messagesEndRef = el; }}></div>
      </div>
    );
  }
}