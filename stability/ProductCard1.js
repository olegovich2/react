import React, { Component } from "react";
import PropTypes from "prop-types";

class ProductCard extends Component {
  static propTypes = {
    // Текущий товар для отображения/редактирования
    product: PropTypes.shape({
      code: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      name: PropTypes.string,
      price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      residual: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      url: PropTypes.string,
    }).isRequired,
    // Режим работы: просмотр, редактирование, добавление
    mode: PropTypes.oneOf([false, "edit", "add"]),
    // Колбэк для сохранения товара
    onSave: PropTypes.func.isRequired,
    // Колбэк для отмены редактирования
    onCancel: PropTypes.func.isRequired,
    // Колбэк для отслеживания изменений в форме
    onFormChange: PropTypes.func.isRequired,
  };

  static defaultProps = {
    mode: false,
  };

  state = {
    editedProduct: { ...this.props.product },
    errors: {},
  };

  /**
   * Обновляем локальное состояние при получении новых props
   */
  componentDidUpdate(prevProps) {
    if (prevProps.product !== this.props.product) {
      this.setState({
        editedProduct: { ...this.props.product }, // Копируем новый товар
        errors: {}, // Сбрасываем ошибки
      });
    }
  }

  /**
   * Проверяет, были ли изменения в форме
   * updatedProduct - Обновленный товар
   * boolean - true если есть изменения
   */
  checkForChanges = (updatedProduct) => {
    const { mode, product } = this.props;

    // В режиме добавления всегда считаем что есть изменения (форма не пустая по ТЗ)
    if (mode === "add") return true;

    // В режиме редактирования сравниваем с оригиналом
    return (
      product &&
      updatedProduct &&
      JSON.stringify(product) !== JSON.stringify(updatedProduct)
    );
  };

  /**
   * Валидирует поле формы
   * name - Имя поля
   * value - Значение поля
   * Object - Объект с ошибками
   */
  validateField = (name, value) => {
    const errors = { ...this.state.errors };
    if (!value || value.toString().trim() === "") {
      errors[name] = "Поле не может быть пустым";
    } else {
      delete errors[name]; // Удаляем ошибку если поле заполнено
    }
    return errors;
  };

  /**
   * Обработчик изменения полей ввода
   * field - Имя поля
   * value - Новое значение
   */
  handleInputChange = (field, value) => {
    // Обновляем товар с новым значением поля
    const updatedProduct = { ...this.state.editedProduct, [field]: value };

    // Валидируем поле
    const errors = this.validateField(field, value);

    // Проверяем есть ли изменения
    const hasChanges = this.checkForChanges(updatedProduct);

    // Обновляем состояние
    this.setState({ editedProduct: updatedProduct, errors });

    // Сообщаем родителю об изменениях
    this.props.onFormChange(hasChanges);
  };

  /**
   * Обработчик сохранения товара
   */
  handleSave = () => {
    const { editedProduct } = this.state;
    const errors = {};

    // Валидация обязательных полей
    if (!editedProduct.name || editedProduct.name.trim() === "")
      errors.name = "Поле не может быть пустым";
    if (!editedProduct.price || editedProduct.price.toString().trim() === "")
      errors.price = "Поле не может быть пустым";
    if (
      !editedProduct.residual ||
      editedProduct.residual.toString().trim() === ""
    )
      errors.residual = "Поле не может быть пустым";

    // Если есть ошибки - показываем их и не сохраняем
    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      return;
    }

    // Сохраняем товар
    this.props.onSave(editedProduct);
  };

  /**
   * Обработчик отмены редактирования
   */
  handleCancel = () => {
    this.props.onCancel();
  };

  /**
   * Проверяет есть ли ошибки валидации
   * boolean - true если есть ошибки
   */
  hasErrors = () => Object.keys(this.state.errors).length > 0;

  render() {
    const { mode } = this.props;
    const { editedProduct, errors } = this.state;
    const isViewMode = !mode; // Режим просмотра (не редактирование и не добавление)

    return (
      <div className="product-card">
        {/* Заголовок карточки в зависимости от режима */}
        <h3>
          {mode === "add"
            ? "Добавление товара"
            : mode === "edit"
            ? "Редактирование товара"
            : "Просмотр товара"}
        </h3>

        {/* ID товара (не показывается в режиме добавления) */}
        {mode !== "add" && (
          <div className="form-field">
            <label>ID товара: </label>
            <span className="product-id">{editedProduct.code}</span>
          </div>
        )}

        {/* Поле "Название" */}
        <div className="form-field">
          <label>Название: </label>
          {!isViewMode ? (
            // Режим редактирования/добавления - поле ввода
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
            // Режим просмотра - просто текст
            <span>{editedProduct.name}</span>
          )}
        </div>

        {/* Поле "Цена" */}
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

        {/* Поле "Остаток" */}
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

        {/* Поле "URL изображения" */}
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

        {/* Кнопки управления (только в режиме редактирования/добавления) */}
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
