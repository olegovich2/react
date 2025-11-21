import React, { Component } from "react";
import PropTypes from "prop-types";

class ProductCard extends Component {
  static propTypes = {
    product: PropTypes.shape({
      code: PropTypes.number.isRequired,
      name: PropTypes.string,
      price: PropTypes.number,
      residual: PropTypes.number,
      url: PropTypes.string,
    }).isRequired,
    mode: PropTypes.oneOf([false, "edit", "add"]),
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onFormChange: PropTypes.func.isRequired,
  };

  static defaultProps = {
    mode: false,
  };

  state = {
    editedProduct: { ...this.props.product },
    errors: {},
  };

  componentDidUpdate(prevProps) {
    if (prevProps.product !== this.props.product) {
      this.setState({
        editedProduct: { ...this.props.product },
        errors: {},
      });
    }
  }

  checkForChanges = (updatedProduct) => {
    const { mode, product } = this.props;

    if (mode === "add") return true;

    return (
      product &&
      updatedProduct &&
      JSON.stringify(product) !== JSON.stringify(updatedProduct)
    );
  };

  validateField = (name, value) => {
    const errors = { ...this.state.errors };
    if (!value || value.toString().trim() === "") {
      errors[name] = "Поле не может быть пустым";
    } else {
      delete errors[name];
    }
    return errors;
  };

  handleInputChange = (field, value) => {
    const updatedProduct = { ...this.state.editedProduct, [field]: value };
    const errors = this.validateField(field, value);
    const hasChanges = this.checkForChanges(updatedProduct);

    this.setState({ editedProduct: updatedProduct, errors });
    this.props.onFormChange(hasChanges);
  };

  handleSave = () => {
    const { editedProduct } = this.state;
    const errors = {};

    if (!editedProduct.name || editedProduct.name.trim() === "")
      errors.name = "Поле не может быть пустым";
    if (!editedProduct.price || editedProduct.price.toString().trim() === "")
      errors.price = "Поле не может быть пустым";
    if (
      !editedProduct.residual ||
      editedProduct.residual.toString().trim() === ""
    )
      errors.residual = "Поле не может быть пустым";

    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      return;
    }

    this.props.onSave(editedProduct);
  };

  handleCancel = () => {
    this.props.onCancel();
  };

  hasErrors = () => Object.keys(this.state.errors).length > 0;

  render() {
    const { mode } = this.props;
    const { editedProduct, errors } = this.state;
    const isViewMode = !mode;

    return (
      <div className="product-card">
        <h3>
          {mode === "add"
            ? "Добавление товара"
            : mode === "edit"
            ? "Редактирование товара"
            : "Просмотр товара"}
        </h3>

        {mode !== "add" && (
          <div className="form-field">
            <label>ID товара: </label>
            <span className="product-id">{editedProduct.code}</span>
          </div>
        )}

        <div className="form-field">
          <label>Название: </label>
          {!isViewMode ? (
            <div>
              <input
                type="text"
                value={editedProduct.name || ""}
                onChange={(e) => this.handleInputChange("name", e.target.value)}
              />
              {errors.name && (
                <span className="error-message">{errors.name}</span>
              )}
            </div>
          ) : (
            <span>{editedProduct.name}</span>
          )}
        </div>

        <div className="form-field">
          <label>Цена: </label>
          {!isViewMode ? (
            <div>
              <input
                type="number"
                value={editedProduct.price || ""}
                onChange={(e) =>
                  this.handleInputChange("price", e.target.value)
                }
              />
              {errors.price && (
                <span className="error-message">{errors.price}</span>
              )}
            </div>
          ) : (
            <span>{editedProduct.price}</span>
          )}
        </div>

        <div className="form-field">
          <label>Остаток: </label>
          {!isViewMode ? (
            <div>
              <input
                type="number"
                value={editedProduct.residual || ""}
                onChange={(e) =>
                  this.handleInputChange("residual", e.target.value)
                }
              />
              {errors.residual && (
                <span className="error-message">{errors.residual}</span>
              )}
            </div>
          ) : (
            <span>{editedProduct.residual}</span>
          )}
        </div>

        <div className="form-field">
          <label>URL изображения: </label>
          {!isViewMode ? (
            <input
              type="text"
              value={editedProduct.url || ""}
              onChange={(e) => this.handleInputChange("url", e.target.value)}
            />
          ) : (
            <span>{editedProduct.url || "Нет изображения"}</span>
          )}
        </div>

        {!isViewMode && (
          <div className="card-controls">
            <button onClick={this.handleSave} disabled={this.hasErrors()}>
              {mode === "add" ? "Добавить" : "Сохранить"}
            </button>
            <button onClick={this.handleCancel}>Отмена</button>
          </div>
        )}
      </div>
    );
  }
}

export default ProductCard;
