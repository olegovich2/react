import React from "react";

import ProductLink from "./ProductLink";
import "./Product.css";

class Product extends React.Component {
  deleteProduct = (eo) => {
    eo.stopPropagation();
    return this.props.cbDeleteProduct(this.props.data.code);
  };

  render() {
    return (
      <tr
        style={{ backgroundColor: this.props.isSelected ? "yellow" : "white" }}
        onClick={() => {
          this.props.cbSelectProduct(this.props.data.code);
        }}
      >
        <td>{this.props.name}</td>
        <td>{this.props.price}</td>
        <td>{this.props.residual}</td>
        <td>
          <ProductLink url={this.props.url} title={this.props.name} />
        </td>
        <td>
          <input
            className="deleteButton"
            type="button"
            value="Удалить"
            onClick={this.deleteProduct}
          />
        </td>
      </tr>
    );
  }
}

export default Product;
