import React from "react";
import ProductLink from "../ishop3/components/ProductLink";
import "./Product.css";

class Product extends React.Component {
  /**
   * Обработчик кнопки "Удалить"
   */
  deleteProduct = (eo) => {
    eo.stopPropagation(); // Предотвращаем всплытие события (чтобы не сработал клик по строке)
    return this.props.cbDeleteProduct(this.props.data.code);
  };

  /**
   * Обработчик кнопки "Редактировать"
   */
  editProduct = (eo) => {
    eo.stopPropagation(); // Предотвращаем всплытие события
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
