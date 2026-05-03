import React from "react";
import { fullEvictPlugin } from "../loader";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

class PluginErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      mountKey: 0,
    };
    this._retryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[PluginErrorBoundary] Caught render error:", error, info);
    const { retryCount } = this.state;

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(
        `[PluginErrorBoundary] Retrying (${retryCount + 1}/${MAX_RETRIES}) in ${delay}ms...`,
      );

      this._retryTimer = setTimeout(async () => {
        const { pluginId, componentName, remoteUrl } = this.props;
        if (pluginId && componentName && remoteUrl) {
          await fullEvictPlugin(pluginId, componentName, remoteUrl);
        }
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
          mountKey: prev.mountKey + 1,
        }));
      }, delay);
    }
  }

  handleManualReset = async () => {
    clearTimeout(this._retryTimer);
    const { pluginId, componentName, remoteUrl } = this.props;
    if (pluginId && componentName && remoteUrl) {
      await fullEvictPlugin(pluginId, componentName, remoteUrl);
    }
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      mountKey: this.state.mountKey + 1,
    });
  };

  componentWillUnmount() {
    clearTimeout(this._retryTimer);
  }

  render() {
    const { hasError, error, retryCount, mountKey } = this.state;

    if (hasError) {
      const exhausted = retryCount >= MAX_RETRIES;
      return (
        <div
          style={{
            padding: "20px",
            border: "1px solid #fca5a5",
            backgroundColor: "#fef2f2",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <h3 style={{ color: "#991b1b", margin: "0 0 8px 0" }}>
            Plugin Load Error
          </h3>
          {!exhausted ? (
            <p style={{ color: "#b91c1c", fontSize: "14px" }}>
              Retrying... ({retryCount}/{MAX_RETRIES})
            </p>
          ) : (
            <>
              <p style={{ color: "#b91c1c", fontSize: "14px" }}>
                This plugin failed to load after {MAX_RETRIES} attempts.
              </p>
              {error && (
                <pre
                  style={{
                    fontSize: "11px",
                    color: "#7f1d1d",
                    marginTop: "8px",
                    textAlign: "left",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {error.message}
                </pre>
              )}
              <button
                onClick={this.handleManualReset}
                style={{
                  marginTop: "10px",
                  padding: "8px 16px",
                  backgroundColor: "#991b1b",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </>
          )}
        </div>
      );
    }

    return (
      <React.Fragment key={mountKey}>{this.props.children}</React.Fragment>
    );
  }
}

export default PluginErrorBoundary;
