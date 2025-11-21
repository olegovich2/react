import React, { Component } from "react";

class Br2jsx extends Component {
  parseText = (text) => {
    const lines = text.split(/<\s*br\s*\/?\s*>/gi);
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        result.push(lines[i]);
      }
      if (i < lines.length - 1) {
        result.push(<br key={`br-${i}`} />);
      }
    }
    return result;
  };

  render() {
    const { text } = this.props;

    if (!text) {
      console.log("Нет текста для отображения");
    }

    return !text ? (
      <div></div>
    ) : (
      <div
        style={{
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "5px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {this.parseText(text)}
      </div>
    );
  }
}

export default Br2jsx;
