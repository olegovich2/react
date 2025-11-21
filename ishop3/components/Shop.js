import React from "react";
import PropTypes from "prop-types";
import "./Shop.css";
import ShopCaption from "./ShopCaption";
import Product from "./Product";
import ProductCard from "./ProductCard";

class Shop extends React.Component {
  static propTypes = {
    caption: PropTypes.string.isRequired,
    listProducts: PropTypes.arrayOf(
      PropTypes.shape({
        code: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        price: PropTypes.number.isRequired,
        residual: PropTypes.number.isRequired,
        url: PropTypes.string,
      })
    ),
  };

  static defaultProps = {
    listProducts: [],
  };

  normalizeProducts = (products) => {
    if (!products || !Array.isArray(products)) return [];

    return products.map((product) => ({
      ...product,
      code: Number(product.code) || Date.now(),
      price: Number(product.price) || 0,
      residual: Number(product.residual) || 0,
    }));
  };

  state = {
    selectedProductCode: null,
    listProducts: this.normalizeProducts(this.props.listProducts),
    buttonsDisabled: false,
    editMode: false,
    editedProduct: null,
  };

  componentDidUpdate(prevProps) {
    if (prevProps.listProducts !== this.props.listProducts) {
      this.setState({
        listProducts: this.normalizeProducts(this.props.listProducts),
      });
    }
  }

  getEmptyProduct = () => ({
    code: Date.now(),
    name: "",
    price: 0,
    residual: 0,
    url: "",
  });

  selectProduct = (code) => {
    if (this.state.selectedProductCode === code) {
      this.setState({
        selectedProductCode: null,
        editMode: false,
        buttonsDisabled: false,
        editedProduct: null,
      });
      return;
    }

    const product = this.state.listProducts.find((p) => p.code === code);
    this.setState({
      selectedProductCode: code,
      editMode: false,
      buttonsDisabled: false,
      editedProduct: product,
    });
  };

  cbEditButton = (code) => {
    const product = this.state.listProducts.find((p) => p.code === code);
    this.setState({
      buttonsDisabled: false,
      selectedProductCode: code,
      editMode: "edit",
      editedProduct: { ...product },
    });
  };

  cbAddNewProduct = () => {
    this.setState({
      selectedProductCode: null,
      buttonsDisabled: true,
      editMode: "add",
      editedProduct: this.getEmptyProduct(),
    });
  };

  cbDeleteProduct = (code) => {
    const agree = confirm("Вы действительно хотите удалить товар?");
    if (agree === true) {
      const newListProducts = this.state.listProducts.filter(
        (item) => item.code !== code
      );

      let newSelectedProductCode = this.state.selectedProductCode;
      let newEditedProduct = this.state.editedProduct;

      if (this.state.selectedProductCode === code) {
        newSelectedProductCode = null;
        newEditedProduct = null;
      } else if (
        this.state.editedProduct &&
        this.state.editedProduct.code === code
      ) {
        newEditedProduct = null;
      }

      this.setState({
        buttonsDisabled: false,
        listProducts: newListProducts,
        selectedProductCode: newSelectedProductCode,
        editMode: false,
        editedProduct: newEditedProduct,
      });
    }
  };

  handleSaveProduct = (updatedProduct) => {
    const normalizedProduct = {
      ...updatedProduct,
      price: Number(updatedProduct.price) || 0,
      residual: Number(updatedProduct.residual) || 0,
    };

    if (this.state.editMode === "edit") {
      const newListProducts = this.state.listProducts.map((product) =>
        product.code === normalizedProduct.code ? normalizedProduct : product
      );
      this.setState({
        listProducts: newListProducts,
        buttonsDisabled: false,
        editMode: false,
        editedProduct: null,
      });
    } else if (this.state.editMode === "add") {
      const newProduct = {
        ...normalizedProduct,
        code: Date.now(),
      };
      this.setState({
        listProducts: [...this.state.listProducts, newProduct],
        buttonsDisabled: false,
        editMode: false,
        editedProduct: null,
      });
    }
  };

  handleCancelEdit = () => {
    this.setState({
      buttonsDisabled: false,
      editMode: false,
      editedProduct: null,
    });
  };

  handleFormChange = (hasChanges) => {
    if (this.state.editMode === "edit") {
      this.setState({ buttonsDisabled: hasChanges });
    }
  };

  render() {
    const {
      listProducts,
      selectedProductCode,
      editMode,
      editedProduct,
      buttonsDisabled,
    } = this.state;

    const productsCode = listProducts.map((v) => (
      <Product
        data={v}
        isSelected={v.code === selectedProductCode && editMode !== "add"}
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

        <input
          className="addButton"
          type="button"
          value="Новый продукт"
          disabled={buttonsDisabled}
          onClick={this.cbAddNewProduct}
        />

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
