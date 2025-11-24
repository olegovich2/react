import React, { Component } from "react";
import PropTypes from "prop-types";

class DoubleButton extends Component {
  static propTypes = {
    caption1: PropTypes.string.isRequired,
    caption2: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    cbPressed: PropTypes.func.isRequired,
  };

  handleClick1 = () => {
    this.props.cbPressed(1);
  };

  handleClick2 = () => {
    this.props.cbPressed(2);
  };

  render() {
    const { caption1, caption2, children } = this.props;

    return (
      <div style={{ textAlign: "center", padding: "20px" }}>
        <input
          type="button"
          value={caption1}
          onClick={this.handleClick1}
          style={{ margin: "5px", padding: "10px" }}
        />
        <span style={{ margin: "0 15px", fontSize: "16px" }}>{children}</span>
        <input
          type="button"
          value={caption2}
          onClick={this.handleClick2}
          style={{ margin: "5px", padding: "10px" }}
        />
      </div>
    );
  }
}

export default DoubleButton;
