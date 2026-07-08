import { useState, useEffect } from 'react';

function Toast({ feedback, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (feedback.message) {
      setExiting(false);
      setVisible(true);
      const timer = setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          setVisible(false);
          setExiting(false);
          if (onDismiss) onDismiss();
        }, 300);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [feedback.message, feedback.type]);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      if (onDismiss) onDismiss();
    }, 300);
  };

  if (!visible || !feedback.message) return null;

  const icon = feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '✕' : 'ℹ';
  const title = feedback.type === 'success' ? 'Success' : feedback.type === 'error' ? 'Error' : 'Info';
  const type = feedback.type || 'info';

  return (
    <div className="toast-container">
      <div className={`toast ${type} ${exiting ? 'exiting' : ''}`} role="alert">
        <div className="toast-icon">{icon}</div>
        <div className="toast-content">
          <div className="toast-title">{title}</div>
          <div className="toast-message">{feedback.message}</div>
        </div>
        <button className="toast-close" onClick={dismiss} aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}

export default Toast;
