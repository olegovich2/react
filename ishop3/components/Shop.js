import React from "react";
import "./Shop.css";
import ShopCaption from "./ShopCaption";
import Product from "./Product";

class Shop extends React.Component {
  state = {
    selectedProductCode: null,
    listProducts: this.props.listProducts || [],
    disabled: false,
    editMode: false, // false, 'edit', 'add'
    editedProduct: null,
    errors: {},
    originalProduct: null,
  };

  // Проверяем, были ли изменения в форме
  hasChanges = () => {
    if (!this.state.originalProduct || !this.state.editedProduct) {
      return false;
    }
    return (
      JSON.stringify(this.state.originalProduct) !==
      JSON.stringify(this.state.editedProduct)
    );
  };

  // Валидация при изменении полей
  validateField = (name, value) => {
    const errors = { ...this.state.errors };
    if (!value || value.toString().trim() === "") {
      errors[name] = "Поле не может быть пустым";
    } else {
      delete errors[name];
    }
    return errors;
  };

  // Обработчик изменения полей
  handleInputChange = (field, value) => {
    const updatedProduct = {
      ...this.state.editedProduct,
      [field]: value,
    };
    const errors = this.validateField(field, value);
    this.setState({
      editedProduct: updatedProduct,
      errors,
    });
  };

  // Метод выбора товара
  selectProduct = (code) => {
    // В режиме добавления клики по строкам игнорируются
    if (this.state.editMode === "add") {
      return;
    }

    // Если есть несохраненные изменения - игнорируем клик
    if (this.state.editMode === "edit" && this.hasChanges()) {
      alert(
        "Есть несохраненные изменения. Сохраните или отмените редактирование."
      );
      return;
    }

    const product = this.state.listProducts.find((p) => p.code === code);

    // Если в режиме редактирования - переходим в просмотр и разблокируем кнопки
    if (this.state.editMode === "edit") {
      this.setState({
        selectedProductCode: code,
        editMode: false,
        disabled: false,
        editedProduct: product,
        originalProduct: product,
        errors: {},
      });
    }
    // Обычный режим просмотра
    else {
      if (this.state.selectedProductCode === code) {
        this.setState({
          selectedProductCode: null,
          editMode: false,
          editedProduct: null,
          originalProduct: null,
        });
      } else {
        this.setState({
          selectedProductCode: code,
          editMode: false,
          editedProduct: product,
          originalProduct: product,
        });
      }
    }
  };

  // Метод редактирования
  cbEditButton = (code) => {
    // В режиме добавления кнопки редактирования заблокированы
    if (this.state.editMode === "add") {
      return;
    }

    // Если есть несохраненные изменения - игнорируем
    if (this.state.editMode === "edit" && this.hasChanges()) {
      alert(
        "Есть несохраненные изменения. Сохраните или отмените редактирование."
      );
      return;
    }

    const product = this.state.listProducts.find((p) => p.code === code);
    this.setState({
      disabled: true,
      selectedProductCode: code,
      editMode: "edit",
      editedProduct: { ...product },
      originalProduct: product,
      errors: {},
    });
  };

  // Метод добавления нового товара
  cbAddNewProduct = () => {
    this.setState({
      selectedProductCode: null, // снимаем выделение с товаров
      disabled: true, // блокируем все кнопки
      editMode: "add", // режим добавления
      editedProduct: {
        code: Date.now(), // временный код
        name: "",
        price: "",
        residual: "",
        url: "",
      },
      originalProduct: null,
      errors: {},
    });
  };

  cbDeleteProduct = (code) => {
    // В режиме добавления кнопки удаления заблокированы
    if (this.state.editMode === "add") {
      return;
    }

    const agree = confirm("Вы действительно хотите удалить товар?");
    if (agree === true) {
      const newListProducts = this.state.listProducts.filter((item) => {
        return item.code !== code;
      });
      return this.setState({
        disabled: false,
        listProducts: newListProducts,
        selectedProductCode: null,
        editMode: false,
        editedProduct: null,
        originalProduct: null,
      });
    }
  };

  cbSaveProduct = () => {
    // Финальная проверка перед сохранением
    const errors = {};
    if (
      !this.state.editedProduct.name ||
      this.state.editedProduct.name.trim() === ""
    ) {
      errors.name = "Поле не может быть пустым";
    }
    if (
      !this.state.editedProduct.price ||
      this.state.editedProduct.price.toString().trim() === ""
    ) {
      errors.price = "Поле не может быть пустым";
    }
    if (
      !this.state.editedProduct.residual ||
      this.state.editedProduct.residual.toString().trim() === ""
    ) {
      errors.residual = "Поле не может быть пустым";
    }

    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      return;
    }

    if (this.state.editMode === "edit") {
      // Сохраняем редактирование существующего товара
      const newListProducts = this.state.listProducts.map((product) =>
        product.code === this.state.editedProduct.code
          ? this.state.editedProduct
          : product
      );

      this.setState({
        listProducts: newListProducts,
        disabled: false,
        editMode: false,
        editedProduct: null,
        originalProduct: null,
        errors: {},
      });
    } else if (this.state.editMode === "add") {
      // Добавляем новый товар
      const newProduct = {
        ...this.state.editedProduct,
        code: Date.now(), // генерируем постоянный код
      };

      this.setState({
        listProducts: [...this.state.listProducts, newProduct],
        disabled: false,
        editMode: false,
        editedProduct: null,
        originalProduct: null,
        errors: {},
      });
    }
  };

  cbCancelEdit = () => {
    this.setState({
      disabled: false,
      editMode: false,
      editedProduct: null,
      originalProduct: null,
      errors: {},
    });
  };

  hasErrors = () => {
    return Object.keys(this.state.errors).length > 0;
  };

  render() {
    const listProducts = this.state.listProducts || [];

    const productsCode = listProducts.map((v) => (
      <Product
        data={v}
        isSelected={
          v.code === this.state.selectedProductCode &&
          this.state.editMode !== "add"
        } // в режиме добавления нет выделения
        cbSelectProduct={this.selectProduct}
        cbDeleteProduct={this.cbDeleteProduct}
        cbEditButton={this.cbEditButton}
        key={v.code}
        name={v.name}
        price={v.price}
        residual={v.residual}
        url={v.url}
        dataId={v.code}
        disabled={this.state.disabled}
        editMode={this.state.editMode}
        hasChanges={this.state.editMode === "edit" && this.hasChanges()}
      />
    ));

    return (
      <div>
        <table>
          <ShopCaption caption={this.props.caption} />
          <thead>
            <tr>
              <th>Название товара</th>
              <th>Цена товара</th>
              <th>Остаток на складе</th>
              <th>Изображение</th>
              <th colSpan="2">Функционал</th>
            </tr>
          </thead>
          <tbody>
            {productsCode.length > 0 ? (
              productsCode
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  Нет товаров для отображения
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <input
          className="deleteButton"
          type="button"
          value="Новый продукт"
          disabled={this.state.disabled}
          onClick={this.cbAddNewProduct}
        />

        {/* Карточка товара - показываем в режиме просмотра, редактирования ИЛИ добавления */}
        {(this.state.selectedProductCode || this.state.editMode) &&
          this.state.editedProduct && (
            <div className="product-card">
              <h3>
                {this.state.editMode === "add"
                  ? "Добавление товара"
                  : this.state.editMode === "edit"
                  ? "Редактирование товара"
                  : "Просмотр товара"}
              </h3>

              <div className="form-field">
                <label>Название: </label>
                {this.state.editMode ? (
                  <div>
                    <input
                      type="text"
                      value={this.state.editedProduct.name || ""}
                      onChange={(e) =>
                        this.handleInputChange("name", e.target.value)
                      }
                    />
                    {this.state.errors.name && (
                      <span className="error-message">
                        {this.state.errors.name}
                      </span>
                    )}
                  </div>
                ) : (
                  <span>{this.state.editedProduct.name}</span>
                )}
              </div>

              <div className="form-field">
                <label>Цена: </label>
                {this.state.editMode ? (
                  <div>
                    <input
                      type="number"
                      value={this.state.editedProduct.price || ""}
                      onChange={(e) =>
                        this.handleInputChange("price", e.target.value)
                      }
                    />
                    {this.state.errors.price && (
                      <span className="error-message">
                        {this.state.errors.price}
                      </span>
                    )}
                  </div>
                ) : (
                  <span>{this.state.editedProduct.price}</span>
                )}
              </div>

              <div className="form-field">
                <label>Остаток: </label>
                {this.state.editMode ? (
                  <div>
                    <input
                      type="number"
                      value={this.state.editedProduct.residual || ""}
                      onChange={(e) =>
                        this.handleInputChange("residual", e.target.value)
                      }
                    />
                    {this.state.errors.residual && (
                      <span className="error-message">
                        {this.state.errors.residual}
                      </span>
                    )}
                  </div>
                ) : (
                  <span>{this.state.editedProduct.residual}</span>
                )}
              </div>

              <div className="form-field">
                <label>URL изображения: </label>
                {this.state.editMode ? (
                  <input
                    type="text"
                    value={this.state.editedProduct.url || ""}
                    onChange={(e) =>
                      this.handleInputChange("url", e.target.value)
                    }
                  />
                ) : (
                  <span>
                    {this.state.editedProduct.url || "Нет изображения"}
                  </span>
                )}
              </div>

              {/* Кнопки управления показываем в режиме редактирования ИЛИ добавления */}
              {(this.state.editMode === "edit" ||
                this.state.editMode === "add") && (
                <div className="card-controls">
                  <button
                    onClick={this.cbSaveProduct}
                    disabled={this.hasErrors()}
                  >
                    {this.state.editMode === "add" ? "Добавить" : "Сохранить"}
                  </button>
                  <button onClick={this.cbCancelEdit}>Отмена</button>
                </div>
              )}
            </div>
          )}
      </div>
    );
  }
}

export default Shop;
