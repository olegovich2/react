import React, { Component } from "react";
import PropTypes from "prop-types";
import DoubleButton from "./DoubleButton";
import withRainbowFrame from "./withRainbowFrame";

const FramedDoubleButton = withRainbowFrame(DoubleButton);

class RainbowFrameHOC extends Component {
  static propTypes = {
    colors: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  handleButtonClick = (num) => {
    alert(num);
  };

  render() {
    const { colors } = this.props;

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
          colors={colors}
        >
          вышел, был сильный
        </FramedDoubleButton>
      </div>
    );
  }
}

export default RainbowFrameHOC;
