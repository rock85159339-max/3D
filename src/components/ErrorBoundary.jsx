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
          <h1>3D 列印建模器無法開啟</h1>
          <p>程式載入時發生錯誤。請把下方錯誤訊息提供給我，我可以直接協助修正。</p>
          <pre>{error.stack || error.message}</pre>
          {info?.componentStack && <pre>{info.componentStack}</pre>}
          <button onClick={() => window.location.reload()}>重新載入</button>
        </section>
      </main>
    );
  }
}
