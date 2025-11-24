import React, { Component } from "react";
import DoubleButton from "./DoubleButton";
import withRainbowFrame from "./withRainbowFrame";
import arrayColors from "../colors.json";

const FramedDoubleButton = withRainbowFrame(arrayColors)(DoubleButton);

class RainbowFrameHOC extends Component {
  handleButtonClick = (num) => {
    alert(num);
  };

  render() {
    return (
      <div style={{ padding: "20px" }}>
        <DoubleButton
          caption1="однажды"
          caption2="пору"
          cbPressed={this.handleButtonClick}
        >
          в студёную зимнюю
        </DoubleButton>

        <FramedDoubleButton
          caption1="я из лесу"
          caption2="мороз"
          cbPressed={this.handleButtonClick}
        >
          вышел, был сильный
        </FramedDoubleButton>
      </div>
    );
  }
}

export default RainbowFrameHOC;
