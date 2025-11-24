import React from "react";
import PropTypes from "prop-types";

const withRainbowFrame = (WrappedComponent) => {
  class WithRainbowFrame extends React.Component {
    static propTypes = {
      colors: PropTypes.arrayOf(PropTypes.string),
    };

    static defaultProps = {
      colors: [],
    };

    render() {
      const { colors, ...otherProps } = this.props;

      let content = <WrappedComponent {...otherProps} />;

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
            key={i}
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
