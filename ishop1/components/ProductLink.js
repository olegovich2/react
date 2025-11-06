import React from "react";

import "./ProductLink.css";

class ProductLink extends React.Component {
  render() {
    return (
      <img
        class="image"
        src={this.props.url}
        title={this.props.title}
        alt={this.props.title}
      ></img>
    );
  }
}

export default ProductLink;
