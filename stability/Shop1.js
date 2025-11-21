import React from "react";
import PropTypes from "prop-types";
import "./Shop.css";
import ShopCaption from "./ShopCaption";
import Product from "./Product";
import ProductCard from "./ProductCard";

class Shop extends React.Component {
  static propTypes = {
    // Обязательный заголовок таблицы
    caption: PropTypes.string.isRequired,
    // Массив товаров, по умолчанию пустой массив
    listProducts: PropTypes.arrayOf(
      PropTypes.shape({
        code: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
          .isRequired,
        name: PropTypes.string.isRequired,
        price: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
          .isRequired,
        residual: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
          .isRequired,
        url: PropTypes.string,
      })
    ),
  };

  static defaultProps = {
    listProducts: [],
  };

  state = {
    selectedProductCode: null,
    listProducts: this.props.listProducts,
    buttonsDisabled: false,
    editMode: false,
    editedProduct: null,
  };

  /**
   * Создает пустой объект товара для режима добавления
   */
  getEmptyProduct = () => ({
    code: Date.now(), // Временный ID, при сохранении заменится на постоянный
    name: "",
    price: "",
    residual: "",
    url: "",
  });

  /**
   * Обработчик клика по строке товара
   *  code - ID товара
   */
  selectProduct = (code) => {
    // Если кликаем на уже выделенный товар - снимаем выделение
    if (this.state.selectedProductCode === code) {
      this.setState({
        selectedProductCode: null,
        editMode: false,
        buttonsDisabled: false,
        editedProduct: null,
      });
      return;
    }

    // Находим товар и переходим в режим просмотра
    const product = this.state.listProducts.find((p) => p.code === code);
    this.setState({
      selectedProductCode: code,
      editMode: false, // Режим просмотра
      buttonsDisabled: false, // Разблокируем кнопки
      editedProduct: product, // Показываем карточку товара
    });
  };

  cbEditButton = (code) => {
    // Находим товар и переходим в режим редактирования
    const product = this.state.listProducts.find((p) => p.code === code);
    this.setState({
      buttonsDisabled: false, // Кнопки разблокированы (блокируются только при изменениях)
      selectedProductCode: code, // Выделяем строку
      editMode: "edit", // Режим редактирования
      editedProduct: { ...product }, // Создаем копию для редактирования
    });
  };

  // Обработчик кнопки "Новый продукт"
  cbAddNewProduct = () => {
    // Переходим в режим добавления
    this.setState({
      selectedProductCode: null, // Выделенной строки не должно быть (по ТЗ)
      buttonsDisabled: true, // Все кнопки должны быть запрещены (по ТЗ)
      editMode: "add", // Режим добавления
      editedProduct: this.getEmptyProduct(), // Пустая форма
    });
  };

  /**
   * Обработчик кнопки "Удалить"
   * code - ID товара
   */
  cbDeleteProduct = (code) => {
    // Подтверждение удаления
    const agree = confirm("Вы действительно хотите удалить товар?");
    if (agree === true) {
      // Удаляем товар из списка
      const newListProducts = this.state.listProducts.filter(
        (item) => item.code !== code
      );

      // Определяем новое состояние выделения и карточки
      let newSelectedProductCode = this.state.selectedProductCode;
      let newEditedProduct = this.state.editedProduct;

      // Если удаляем выделенный товар - снимаем выделение
      if (this.state.selectedProductCode === code) {
        newSelectedProductCode = null;
        newEditedProduct = null;
      }
      // Если удаляем товар, который отображается в карточке - закрываем карточку
      else if (
        this.state.editedProduct &&
        this.state.editedProduct.code === code
      ) {
        newEditedProduct = null;
      }

      // Обновляем состояние
      this.setState({
        buttonsDisabled: false,
        listProducts: newListProducts,
        selectedProductCode: newSelectedProductCode,
        editMode: false,
        editedProduct: newEditedProduct,
      });
    }
  };

  /**
   * Обработчик сохранения товара (вызывается из ProductCard)
   * updatedProduct - Обновленный товар
   */
  handleSaveProduct = (updatedProduct) => {
    if (this.state.editMode === "edit") {
      // Обновляем существующий товар в списке
      const newListProducts = this.state.listProducts.map((product) =>
        product.code === updatedProduct.code ? updatedProduct : product
      );
      this.setState({
        listProducts: newListProducts,
        buttonsDisabled: false, // Разблокируем кнопки
        editMode: false, // Выходим из режима редактирования
        editedProduct: null, // Закрываем карточку
      });
    } else if (this.state.editMode === "add") {
      // Добавляем новый товар в список
      const newProduct = { ...updatedProduct, code: Date.now() }; // Генерируем постоянный ID
      this.setState({
        listProducts: [...this.state.listProducts, newProduct],
        buttonsDisabled: false, // Разблокируем кнопки
        editMode: false, // Выходим из режима добавления
        editedProduct: null, // Закрываем карточку
      });
    }
  };

  /**
   * Обработчик отмены редактирования/добавления
   */
  handleCancelEdit = () => {
    this.setState({
      buttonsDisabled: false, // Разблокируем кнопки
      editMode: false, // Выходим из режима редактирования/добавления
      editedProduct: null, // Закрываем карточку
    });
  };

  /**
   * Обработчик изменений в форме (вызывается из ProductCard)
   * hasChanges - Есть ли несохраненные изменения
   */
  handleFormChange = (hasChanges) => {
    // В режиме редактирования блокируем кнопки при изменениях
    if (this.state.editMode === "edit") {
      this.setState({ buttonsDisabled: hasChanges });
    }
  };

  render() {
    // Деструктуризация для удобства
    const {
      listProducts,
      selectedProductCode,
      editMode,
      editedProduct,
      buttonsDisabled,
    } = this.state;
    const productsList = listProducts || [];

    // Генерируем строки таблицы с товарами
    const productsCode = productsList.map((v) => (
      <Product
        data={v}
        isSelected={v.code === selectedProductCode && editMode !== "add"} // Выделяем если товар выбран и не в режиме добавления
        cbSelectProduct={this.selectProduct}
        cbDeleteProduct={this.cbDeleteProduct}
        cbEditButton={this.cbEditButton}
        key={v.code}
        name={v.name}
        price={v.price}
        residual={v.residual}
        url={v.url}
        dataId={v.code}
        buttonsDisabled={buttonsDisabled}
      />
    ));

    return (
      <div>
        {/* Таблица с товарами */}
        <table>
          <ShopCaption caption={this.props.caption} />
          <thead>
            <tr>
              <th>Название</th>
              <th>Цена</th>
              <th>Остаток</th>
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
                  Нет товаров
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Кнопка "Новый продукт" */}
        <input
          className="addButton"
          type="button"
          value="Новый продукт"
          disabled={buttonsDisabled}
          onClick={this.cbAddNewProduct}
        />

        {/* Карточка товара (показывается при выделении товара или в режиме редактирования/добавления) */}
        {(selectedProductCode || editMode) && editedProduct && (
          <ProductCard
            product={editedProduct}
            mode={editMode}
            onSave={this.handleSaveProduct}
            onCancel={this.handleCancelEdit}
            onFormChange={this.handleFormChange}
          />
        )}
      </div>
    );
  }
}

export default Shop;
