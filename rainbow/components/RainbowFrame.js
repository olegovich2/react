import React, { Component } from "react";

class RainbowFrame extends Component {
  render() {
    const { colors, children } = this.props;

    if (!colors || colors.length === 0) {
      return <div>{children}</div>;
    }

    let content = children;

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

export default RainbowFrame;
