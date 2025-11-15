import React from "react";

import "./ProductLink.css";

class ProductLink extends React.Component {
  render() {
    return (
      <img
        className="image"
        src={this.props.url}
        title={this.props.title}
        alt={this.props.title}
      ></img>
    );
  }
}

export default ProductLink;
