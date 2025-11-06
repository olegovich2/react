import React from "react";

import ProductLink from "./ProductLink";

class TableContent extends React.Component {
  render() {
    if (this.props.isLink) {
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
    } else {
      return (
        <thead>
          <tr>
            <td>{this.props.name}</td>
            <td>{this.props.price}</td>
            <td>{this.props.residual}</td>
            <td>{this.props.url}</td>
          </tr>
        </thead>
      );
    }
  }
}

export default TableContent;
