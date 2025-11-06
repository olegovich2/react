import React from "react";

import ProductLink from "./ProductLink";

class Product extends React.Component {
  render() {
    return (
      <tr>
        <td>{this.props.name}</td>
        <td>{this.props.price}</td>
        <td>{this.props.residual}</td>
        <td>
          <ProductLink url={this.props.url} title={this.props.name} />
        </td>
      </tr>
    );
  }
}

export default Product;
