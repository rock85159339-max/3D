import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed', error, info);
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="app-error-screen">
        <section>
          <h1>Print Modeler failed to open</h1>
          <p>程式載入時發生錯誤。請把下面訊息貼給我，我可以直接修。</p>
          <pre>{error.stack || error.message}</pre>
          {info?.componentStack && <pre>{info.componentStack}</pre>}
          <button onClick={() => window.location.reload()}>Reload</button>
        </section>
      </main>
    );
  }
}
