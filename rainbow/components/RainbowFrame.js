import React, { Component } from "react";

class RainbowFrame extends Component {
  createFrames = (colors, content) => {
    if (colors.length === 0) return <div>{content}</div>;
    const currentColor = colors[0];
    const remainingColors = colors.slice(1);
    return (
      <div
        style={{
          border: `10px solid ${currentColor}`,
          margin: "5px",
          textAlign: "center",
        }}
      >
        {this.createFrames(remainingColors, content)}
      </div>
    );
  };

  render() {
    const { colors, children } = this.props;
    return this.createFrames(colors, children);
  }
}

export default RainbowFrame;
