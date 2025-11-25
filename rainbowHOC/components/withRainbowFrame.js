import React from "react";

const withRainbowFrame = (colors) => (WrappedComponent) => {
  class WithRainbowFrame extends React.Component {
    render() {
      let content = <WrappedComponent {...this.props} />;

      if (!colors || colors.length === 0) {
        return content;
      }

      for (let i = 0; i < colors.length; i++) {
        content = (
          <div
            style={{
              border: `10px solid ${colors[i]}`,
              padding: "10px",
              margin: "5px",
              textAlign: "center",
              borderRadius: "5px",
            }}
          >
            {content}
          </div>
        );
      }

      return content;
    }
  }

  // displayName для удобной отладки в Components
  const wrappedComponentName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";
  WithRainbowFrame.displayName = `WithRainbowFrame(${wrappedComponentName})`;

  return WithRainbowFrame;
};

export default withRainbowFrame;
