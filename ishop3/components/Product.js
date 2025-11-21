import React from "react";
import PropTypes from "prop-types";
import ProductLink from "./ProductLink";
import "./Product.css";

class Product extends React.Component {
  static propTypes = {
    data: PropTypes.shape({
      code: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
      price: PropTypes.number.isRequired,
      residual: PropTypes.number.isRequired,
      url: PropTypes.string,
    }).isRequired,
    isSelected: PropTypes.bool,
    cbSelectProduct: PropTypes.func.isRequired,
    cbDeleteProduct: PropTypes.func.isRequired,
    cbEditButton: PropTypes.func.isRequired,
    dataId: PropTypes.number.isRequired,
    buttonsDisabled: PropTypes.bool,
    name: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    residual: PropTypes.number.isRequired,
    url: PropTypes.string,
  };

  static defaultProps = {
    isSelected: false,
    buttonsDisabled: false,
    url: "",
  };

  deleteProduct = (eo) => {
    eo.stopPropagation();
    return this.props.cbDeleteProduct(this.props.data.code);
  };

  editProduct = (eo) => {
    eo.stopPropagation();
    return this.props.cbEditButton(this.props.data.code);
  };

  render() {
    return (
      <tr
        data-id={this.props.dataId}
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
            className="editButton"
            type="button"
            value="Редактировать"
            onClick={this.editProduct}
            disabled={this.props.buttonsDisabled}
          />
        </td>
        <td>
          <input
            className="deleteButton"
            type="button"
            value="Удалить"
            onClick={this.deleteProduct}
            disabled={this.props.buttonsDisabled}
          />
        </td>
      </tr>
    );
  }
}

export default Product;
