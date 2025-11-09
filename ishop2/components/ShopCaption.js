import React from "react";
import PropTypes from "prop-types";

class ShopCaption extends React.Component {
  static propTypes = {
    caption: PropTypes.string.isRequired,
  };

  render() {
    return <caption>{this.props.caption}</caption>;
  }
}

export default ShopCaption;
