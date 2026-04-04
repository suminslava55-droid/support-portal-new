import React from 'react';
import { Button, Result } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40 }}>
          <Result
            status="error"
            title="Что-то пошло не так"
            subTitle="Произошла ошибка при загрузке страницы. Попробуйте обновить или вернитесь назад."
            extra={[
              <Button
                type="primary"
                key="reload"
                onClick={() => window.location.reload()}
              >
                Обновить страницу
              </Button>,
              <Button
                key="back"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.history.back();
                }}
              >
                Назад
              </Button>,
            ]}
          />
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              marginTop: 24, padding: 16, background: '#fff2f0',
              border: '1px solid #ffccc7', borderRadius: 8,
              fontSize: 12, overflow: 'auto', color: '#a8071a',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
